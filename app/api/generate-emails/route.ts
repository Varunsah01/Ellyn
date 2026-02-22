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
  calculateDeliverabilityConfidence,
  getVerificationStatusDisplay,
  getProviderDisplayName,
} from '@/lib/email-verification';
import { getLearnedPatterns, applyLearnedBoosts } from '@/lib/pattern-learning';
import { supabase } from '@/lib/supabase';
import { EmailGenerateSchema, formatZodError } from '@/lib/validation/schemas';
import { getAuthenticatedUser } from '@/lib/auth/helpers';
import { incrementEmailGeneration, QuotaExceededError } from '@/lib/quota';
import { getDailyVerificationQuota } from '@/lib/verification-quota';
import { captureApiException } from '@/lib/monitoring/sentry';

type EmailVerificationStatus = 'verified' | 'invalid' | 'unverified';

const ABSTRACT_API_URL = 'https://emailvalidation.abstractapi.com/v1/';
const ABSTRACT_VERIFY_TIMEOUT_MS = 10_000;
const TOP_N_TO_VERIFY = 3;

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
    // Quota enforcement (auth required)
    // Declared here so `user` is in scope for the rest of the handler.
    let user: Awaited<ReturnType<typeof getAuthenticatedUser>>;
    try {
      user = await getAuthenticatedUser();
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
      if (quotaErr instanceof Error && quotaErr.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      throw quotaErr;
    }

    const parsed = EmailGenerateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodError(parsed.error) },
        { status: 400 }
      );
    }
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

    // Step 7.5: Verify top N email addresses via Abstract API (parallel, non-blocking)
    // Skip entirely if the user has exhausted their daily verification quota.
    const verificationQuota = domainVerification.hasMxRecords
      ? await getDailyVerificationQuota(user.id)
      : null;
    const canVerify = verificationQuota?.allowed ?? false;

    if (verificationQuota && !canVerify) {
      console.log(
        `[generate-emails] Skipping verification — quota exhausted for user ${user.id} ` +
        `(${verificationQuota.used}/${verificationQuota.limit} today)`
      );
    }

    const verifiedPatterns = await verifyTopPatterns(
      enhancedPatterns,
      canVerify,
      user.id
    );

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
      emails: verifiedPatterns,
      message: `Generated ${verifiedPatterns.length} email patterns with verification`,
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

// ─── Email address verification helpers ───────────────────────────────────────

type AbstractDeliveryLabel = 'DELIVERABLE' | 'UNDELIVERABLE' | 'RISKY' | 'UNKNOWN';

type AddressVerificationResult = {
  deliverability: AbstractDeliveryLabel | null; // null = API unavailable / error
  smtpScore: number;
};

async function verifyEmailAddress(
  email: string,
  userId: string
): Promise<AddressVerificationResult> {
  const apiKey = process.env.ABSTRACT_API_KEY?.trim();
  if (!apiKey) {
    console.warn('[generate-emails] ABSTRACT_API_KEY not set; skipping address verification');
    return { deliverability: null, smtpScore: 0 };
  }

  try {
    const url = `${ABSTRACT_API_URL}?${new URLSearchParams({ api_key: apiKey, email }).toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(ABSTRACT_VERIFY_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!res.ok) {
      console.warn(`[generate-emails] Abstract API returned ${res.status} for ${email}`);
      return { deliverability: null, smtpScore: 0 };
    }

    const data = await res.json() as { deliverability?: string; quality_score?: number | string };
    const rawLabel = String(data?.deliverability ?? '').toUpperCase();
    const smtpScore = Math.min(1, Math.max(0, Number(data?.quality_score) || 0));

    const validLabels = new Set<AbstractDeliveryLabel>(['DELIVERABLE', 'UNDELIVERABLE', 'RISKY', 'UNKNOWN']);
    const deliverability = validLabels.has(rawLabel as AbstractDeliveryLabel)
      ? (rawLabel as AbstractDeliveryLabel)
      : 'UNKNOWN';

    console.log(`[generate-emails] Abstract verification ${email}: ${deliverability} (smtp=${smtpScore})`);

    // Fire-and-forget cost record — keeps this call non-blocking
    void recordAddressVerificationCost(userId, email, deliverability);

    return { deliverability, smtpScore };
  } catch (err) {
    const isTimeout =
      err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError');
    console.warn(
      `[generate-emails] verifyEmailAddress failed for ${email}:`,
      isTimeout ? 'timeout (>10s)' : err
    );
    return { deliverability: null, smtpScore: 0 };
  }
}

async function recordAddressVerificationCost(
  userId: string,
  email: string,
  deliverability: AbstractDeliveryLabel
): Promise<void> {
  try {
    const { createServiceRoleClient } = await import('@/lib/supabase/server');
    const serviceClient = await createServiceRoleClient();
    await serviceClient.from('api_costs').insert({
      user_id: userId,
      service: 'abstract',
      cost_usd: 0.001,
      metadata: {
        endpoint: 'verify-email',
        email,
        domain: email.split('@')[1]?.toLowerCase() ?? 'unknown',
        deliverability,
        source: 'abstract',
        costModel: '$0.001 per verification',
        calledFrom: 'generate-emails',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    // Non-fatal: cost recording failure should never surface to the user
    console.warn('[generate-emails] Cost recording failed:', err);
  }
}

async function verifyTopPatterns(
  patterns: Array<{
    email: string;
    pattern: string;
    confidence: number;
    learned: boolean;
    verification: { domainVerified: boolean; formatValid: boolean; emailProvider: string | null };
  }>,
  canVerify: boolean,
  userId: string
) {
  // Sort descending by confidence so we verify the most-likely candidates first
  const sorted = [...patterns].sort((a, b) => b.confidence - a.confidence);

  // Skip address-level verification if disabled (no MX records or quota exhausted)
  const toVerify = canVerify ? sorted.slice(0, TOP_N_TO_VERIFY) : [];

  const results = await Promise.allSettled(
    toVerify.map(p => verifyEmailAddress(p.email, userId))
  );

  // Build email -> { status, confidence } map from settled results.
  // calculateDeliverabilityConfidence handles the scoring; all values are 0-100.
  const updates = new Map<string, { status: EmailVerificationStatus; confidence: number }>();
  toVerify.forEach((p, i) => {
    const result = results[i];
    if (!result) {
      updates.set(p.email, { status: 'unverified', confidence: p.confidence });
      return;
    }

    if (result.status === 'fulfilled') {
      const { deliverability, smtpScore } = result.value;
      if (deliverability && deliverability !== 'UNKNOWN') {
        const confidence = calculateDeliverabilityConfidence(p.confidence, deliverability, smtpScore);
        // RISKY is not confirmed invalid - show as 'unverified' so users still consider it.
        const status: EmailVerificationStatus =
          deliverability === 'DELIVERABLE' ? 'verified' :
          deliverability === 'UNDELIVERABLE' ? 'invalid' :
          'unverified'; // RISKY
        updates.set(p.email, { status, confidence });
      } else {
        // UNKNOWN or API unavailable - keep pattern score, mark unverified
        updates.set(p.email, { status: 'unverified', confidence: p.confidence });
      }
      return;
    }

    if (result.status === 'rejected') {
      console.warn('[generate-emails] Verification promise rejected for', p.email, result.reason);
      updates.set(p.email, { status: 'unverified', confidence: p.confidence });
    }
  });

  return sorted
    .map(p => {
      const update = updates.get(p.email);
      return {
        ...p,
        confidence: update ? update.confidence : p.confidence,
        verificationStatus: (update?.status ?? 'unverified') as EmailVerificationStatus,
      };
    })
    .sort((a, b) => b.confidence - a.confidence);
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
