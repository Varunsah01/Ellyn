import { NextRequest, NextResponse } from 'next/server';
import { generateEmailPatterns, guessDomain } from '@/lib/email-patterns';
import {
  generateSmartEmailPatterns,
  estimateCompanySize,
  getKnownDomain,
} from '@/lib/enhanced-email-patterns';
import {
  verifyDomainMxRecords,
  validateEmailFormat,
  calculateEnhancedConfidence,
  getVerificationStatusDisplay,
  getProviderDisplayName,
} from '@/lib/email-verification';
import { getLearnedPatterns, applyLearnedBoosts } from '@/lib/pattern-learning';
import { supabase } from '@/lib/supabase';

interface GenerateEmailsRequest {
  firstName: string;
  lastName: string;
  companyName: string;
  companyDomain?: string;
  role?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateEmailsRequest = await request.json();
    const { firstName, lastName, companyName, companyDomain, role } = body;

    // Validate inputs
    if (!firstName || !lastName || !companyName) {
      return NextResponse.json(
        { error: 'Missing required fields: firstName, lastName, and companyName are required' },
        { status: 400 }
      );
    }

    // Validate minimum length
    if (firstName.trim().length < 2) {
      return NextResponse.json(
        { error: 'First name must be at least 2 characters' },
        { status: 400 }
      );
    }

    if (lastName.trim().length < 2) {
      return NextResponse.json(
        { error: 'Last name must be at least 2 characters' },
        { status: 400 }
      );
    }

    if (companyName.trim().length < 2) {
      return NextResponse.json(
        { error: 'Company name must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Step 1: Determine domain
    let domain = companyDomain || getKnownDomain(companyName) || guessDomain(companyName);
    let domainSource: 'provided' | 'known' | 'cache' | 'inferred' = companyDomain
      ? 'provided'
      : getKnownDomain(companyName)
      ? 'known'
      : 'inferred';

    // Check domain cache if domain was inferred
    if (domainSource === 'inferred') {
      try {
        const { data: cachedDomain, error: cacheError } = await supabase
          .from('domain_cache')
          .select('domain, last_verified')
          .eq('company_name', companyName.trim().toLowerCase())
          .single();

        // Use cached domain if it exists and was verified within 30 days
        if (cachedDomain && !cacheError) {
          const lastVerified = new Date(cachedDomain.last_verified);
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

          if (lastVerified > thirtyDaysAgo) {
            domain = cachedDomain.domain;
            domainSource = 'cache';
            console.log(`Using cached domain for ${companyName}: ${domain}`);
          }
        }
      } catch (cacheError) {
        console.warn('Cache lookup failed:', cacheError);
      }
    }

    // Step 2: Verify domain with MX records (DNS lookup)
    const domainVerification = await verifyDomainMxRecords(domain);
    const verificationStatus = getVerificationStatusDisplay(
      domainVerification.isValid,
      domainVerification.error
    );

    // Step 3: Estimate company size
    const companySize = estimateCompanySize(domain);

    // Step 4: Get learned patterns for this company
    const learnedPatterns = await getLearnedPatterns(domain);

    // Step 5: Generate smart email patterns
    const smartPatterns = generateSmartEmailPatterns(
      firstName,
      lastName,
      {
        domain,
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
          emailProvider: domainVerification.emailProvider,
        },
      };
    });

    // Step 8: Cache the verified domain
    if (domainVerification.isValid && domainSource !== 'cache') {
      try {
        await supabase
          .from('domain_cache')
          .upsert(
            {
              company_name: companyName.trim().toLowerCase(),
              domain,
              verified: true,
              mx_records: domainVerification.mxRecords,
              email_provider: domainVerification.emailProvider,
              last_verified: new Date().toISOString(),
            },
            {
              onConflict: 'company_name',
            }
          );
        console.log(`Cached verified domain for ${companyName}: ${domain}`);
      } catch (cacheWriteError) {
        console.warn('Failed to write to cache:', cacheWriteError);
      }
    }

    // Step 9: Return enhanced results
    return NextResponse.json({
      success: true,
      domain,
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
      emails: enhancedPatterns,
      message: `Generated ${enhancedPatterns.length} email patterns with verification`,
      metadata: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        companyName: companyName.trim(),
        role: role?.trim(),
      },
    });

  } catch (error) {
    console.error('Error generating emails:', error);
    return NextResponse.json(
      { error: 'Internal server error while generating email patterns' },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to generate email patterns.' },
    { status: 405 }
  );
}
