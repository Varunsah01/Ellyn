import { NextRequest, NextResponse } from 'next/server';
import { guessDomain } from '@/lib/email-patterns';
import {
  generateSmartEmailPatternsCached,
  estimateCompanySize,
  getKnownDomain,
} from '@/lib/enhanced-email-patterns';
import { invalidateCompanyDomainLookupCache } from '@/lib/cache/tags'
import {
  verifyDomainMxRecords,
  validateEmailFormat,
  calculateEnhancedConfidence,
  getVerificationStatusDisplay,
  getProviderDisplayName,
} from '@/lib/email-verification';
import { getLearnedPatterns, applyLearnedBoosts } from '@/lib/pattern-learning';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { EmailGenerateSchema, formatZodError } from '@/lib/validation/schemas';
import { getAuthenticatedUser } from '@/lib/auth/helpers';
import { incrementEmailGeneration, QuotaExceededError } from '@/lib/quota';
import { captureApiException } from '@/lib/monitoring/sentry';

/**
 * Handle POST requests for `/api/generate-emails`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the POST /api/generate-emails request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/generate-emails
 * fetch('/api/generate-emails', { method: 'POST' })
 */
export async function POST(request: NextRequest) {
  try {
    let user: Awaited<ReturnType<typeof getAuthenticatedUser>>;
    try {
      user = await getAuthenticatedUser();
    } catch (authError) {
      if (authError instanceof Error && authError.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      throw authError;
    }

    const parsed = EmailGenerateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    try {
      await incrementEmailGeneration(user.id);
    } catch (quotaErr) {
      if (quotaErr instanceof QuotaExceededError) {
        return NextResponse.json(
          {
            error: 'quota_exceeded',
            feature: quotaErr.feature,
            used: quotaErr.used,
            limit: quotaErr.limit,
            plan_type: quotaErr.plan_type,
            upgrade_url: '/dashboard/upgrade',
          },
          { status: 402 }
        );
      }
      throw quotaErr;
    }

    const supabase = await createServiceRoleClient();
    const body = parsed.data;
    const { firstName, lastName, companyName, companyDomain, role } = body;

    // Step 1: Determine domain
    const _knownDomain = await getKnownDomain(companyName);
    const _guessedDomain = (!companyDomain && !_knownDomain)
      ? await guessDomain(companyName)
      : null;

    let domain: string | null = companyDomain || _knownDomain || _guessedDomain || null;
    let domainSource: 'provided' | 'known' | 'cache' | 'inferred' = companyDomain
      ? 'provided'
      : _knownDomain
      ? 'known'
      : 'inferred';

    if (!domain) {
      return NextResponse.json(
        { error: 'Could not determine company domain', suggestion: 'Please provide companyDomain directly' },
        { status: 400 }
      );
    }

    // domain is guaranteed non-null from here on
    let resolvedDomain: string = domain;

    // Check domain cache if domain was inferred
    if (domainSource === 'inferred') {
      try {
        const { data: cachedDomain, error: cacheError } = await supabase
          .from('domain_cache')
          .select('domain, last_verified')
          .eq('company_name', companyName.trim().toLowerCase())
          .single();

        // Use cached domain if it exists and was verified within 7 days
        if (cachedDomain && !cacheError) {
          const lastVerified = new Date(cachedDomain.last_verified);
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

          if (lastVerified > sevenDaysAgo) {
            resolvedDomain = cachedDomain.domain;
            domain = resolvedDomain;
            domainSource = 'cache';
            console.log(`Using cached domain for ${companyName}: ${resolvedDomain}`);
          }
        }
      } catch (cacheError) {
        console.warn('Cache lookup failed:', cacheError);
      }
    }

    // Step 2: Verify domain with MX records (DNS lookup)
    const domainVerification = await verifyDomainMxRecords(resolvedDomain);
    const verificationStatus = getVerificationStatusDisplay(
      domainVerification.isValid,
      domainVerification.error
    );

    // Step 3: Estimate company size
    const companySize = estimateCompanySize(resolvedDomain);

    // Step 4: Get learned patterns for this company
    const learnedPatterns = await getLearnedPatterns(resolvedDomain);

    // Step 5: Generate smart email patterns
    const smartPatterns = await generateSmartEmailPatternsCached(
      firstName,
      lastName,
      {
        domain: resolvedDomain,
        estimatedSize: companySize,
        emailProvider: domainVerification.emailProvider,
      },
      role
    );

    // Step 6: Apply learned pattern boosts
    const patternsWithLearning = applyLearnedBoosts(smartPatterns, learnedPatterns);

    // Step 7: Enhance confidence scores with verification data
    const enhancedPatterns = patternsWithLearning.map(p => {
      const formatValid = validateEmailFormat(p.email);
      const enhancedConfidence = calculateEnhancedConfidence(
        p.confidence,
        domainVerification.isValid,
        domainVerification.emailProvider,
        p.pattern,
        formatValid
      );

      return {
        email: p.email,
        pattern: p.pattern,
        confidence: enhancedConfidence,
        learned: p.learned || false,
        verification: {
          domainVerified: domainVerification.isValid,
          formatValid,
          emailProvider: domainVerification.emailProvider ?? null,
        },
      };
    });
    // No address-level verification — SMTP probe handles this in the extension pipeline.
    // Return patterns sorted by confidence with verificationStatus: 'unverified'.
    const finalPatterns = enhancedPatterns
      .sort((a, b) => b.confidence - a.confidence)
      .map(p => ({
        ...p,
        verificationStatus: 'unverified' as const,
      }));

    // Step 8: Cache the verified domain
    if (domainVerification.isValid && domainSource !== 'cache') {
      try {
        await supabase
          .from('domain_cache')
          .upsert(
            {
              company_name: companyName.trim().toLowerCase(),
              domain: resolvedDomain,
              verified: true,
              mx_records: domainVerification.mxRecords,
              email_provider: domainVerification.emailProvider,
              last_verified: new Date().toISOString(),
            },
            {
              onConflict: 'company_name',
            }
          );
        console.log(`Cached verified domain for ${companyName}: ${resolvedDomain}`);
        await invalidateCompanyDomainLookupCache(companyName)
      } catch (cacheWriteError) {
        console.warn('Failed to write to cache:', cacheWriteError);
      }
    }

    // Step 9: Return enhanced results
    return NextResponse.json({
      success: true,
      domain: resolvedDomain,
      domainSource,
      companySize,
      verification: {
        verified: domainVerification.isValid,
        hasMxRecords: domainVerification.hasMxRecords,
        mxRecordCount: domainVerification.mxRecords.length,
        emailProvider: domainVerification.emailProvider,
        providerName: domainVerification.emailProvider
          ? getProviderDisplayName(domainVerification.emailProvider)
          : undefined,
        status: verificationStatus,
        error: domainVerification.error,
      },
      learning: {
        hasLearnedPatterns: learnedPatterns.length > 0,
        learnedPatternCount: learnedPatterns.length,
      },
      emails: finalPatterns,
      message: `Generated ${finalPatterns.length} email patterns`,
      metadata: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        companyName: companyName.trim(),
        role: role?.trim(),
      },
    });

  } catch (error) {
    console.error('Error generating emails:', error);
    captureApiException(error, { route: '/api/generate-emails', method: 'POST' });
    return NextResponse.json(
      { error: 'Internal server error while generating email patterns' },
      { status: 500 }
    );
  }
}


// Handle unsupported methods
/**
 * Handle GET requests for `/api/generate-emails`.
 * @returns {unknown} JSON response for the GET /api/generate-emails request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/generate-emails
 * fetch('/api/generate-emails')
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to generate email patterns.' },
    { status: 405 }
  );
}
