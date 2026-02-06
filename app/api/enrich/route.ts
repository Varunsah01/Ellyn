import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  lookupCompanyDomain,
  brandfetchDomain,
  googleSearchDomain,
  heuristicDomainGuess
} from '@/lib/domain-lookup';
import { verifyDomainMX } from '@/lib/mx-verification';
import { validateEmailAbstract } from '@/lib/abstract-email-validation';
import {
  generateSmartEmailPatterns,
  estimateCompanySize,
  getKnownDomain
} from '@/lib/enhanced-email-patterns';
import { getLearnedPatterns, applyLearning } from '@/lib/learning-system';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate (optional - can be made public or require auth later)
    const authHeader = request.headers.get('authorization');

    // For now, allow unauthenticated access for testing
    // In production, uncomment this block:
    /*
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    */

    // 2. Parse request
    const { firstName, lastName, companyName, role } = await request.json();

    if (!firstName || !lastName || !companyName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 3. Find company domain (FREE CASCADE)
    let domain: string | null = null;
    let domainSource = 'unknown';

    console.log('[Enrich] Looking up domain for:', companyName);

    // Step 1: Check known domains
    domain = getKnownDomain(companyName);
    if (domain) {
      domainSource = 'known_database';
      console.log('[Enrich] Found in known domains:', domain);
    }

    // Step 2: Try Clearbit (free)
    if (!domain) {
      domain = await lookupCompanyDomain(companyName);
      if (domain) domainSource = 'clearbit';
    }

    // Step 3: Try Brandfetch (free)
    if (!domain) {
      domain = await brandfetchDomain(companyName);
      if (domain) domainSource = 'brandfetch';
    }

    // Step 4: Try Google Search (free 100/day)
    if (!domain) {
      domain = await googleSearchDomain(companyName);
      if (domain) domainSource = 'google_search';
    }

    // Step 5: Heuristic fallback
    if (!domain) {
      domain = heuristicDomainGuess(companyName);
      domainSource = 'heuristic';
      console.log('[Enrich] Using heuristic guess:', domain);
    }

    // 4. Verify domain MX records (ALWAYS ON, FREE)
    console.log('[Enrich] Verifying MX records for:', domain);
    const mxInfo = await verifyDomainMX(domain);

    if (!mxInfo.hasMX) {
      return NextResponse.json({
        success: false,
        error: 'Invalid domain - no email servers found',
        suggestion: 'Please verify the company name is correct',
        attempted: {
          companyName,
          domain,
          source: domainSource
        }
      }, { status: 400 });
    }

    // 5. Build company profile
    const companyProfile = {
      domain,
      estimatedSize: estimateCompanySize(domain),
      emailProvider: mxInfo.provider
    };

    console.log('[Enrich] Company profile:', companyProfile);

    // 6. Generate smart email patterns
    let emailPatterns = generateSmartEmailPatterns(
      firstName,
      lastName,
      companyProfile,
      role
    );

    // 7. Apply learning from past successes
    const learnedPatterns = await getLearnedPatterns(domain);
    if (learnedPatterns.length > 0) {
      console.log('[Enrich] Applying learning from', learnedPatterns.length, 'patterns');
      emailPatterns = applyLearning(emailPatterns, learnedPatterns);
    }

    // 8. Optional: Abstract Email Validation
    // Only runs if ABSTRACT_EMAIL_VALIDATION_API_KEY is set
    const abstractEnabled = !!process.env.ABSTRACT_EMAIL_VALIDATION_API_KEY;
    let abstractValidations: Map<string, any> | null = null;

    if (abstractEnabled) {
      console.log('[Enrich] Running Abstract email validation...');
      abstractValidations = new Map();

      // Validate top 3 patterns only (to save costs)
      const topPatterns = emailPatterns.slice(0, 3);

      for (const pattern of topPatterns) {
        const validation = await validateEmailAbstract(pattern.email);
        if (validation) {
          abstractValidations.set(pattern.email, validation);

          // Apply confidence boost
          pattern.confidence = Math.max(0, Math.min(95,
            pattern.confidence + validation.confidenceBoost
          ));
        }
      }

      // Re-sort after validation adjustments
      emailPatterns.sort((a, b) => b.confidence - a.confidence);
    }

    // 9. Return enriched data
    return NextResponse.json({
      success: true,
      cost: abstractEnabled ? emailPatterns.slice(0, 3).length * 0.001 : 0,
      source: domainSource,
      enrichment: {
        domain,
        companyName,
        size: companyProfile.estimatedSize,
        emailProvider: mxInfo.provider,
        mxRecords: mxInfo.mxCount,
        mxServers: mxInfo.mxServers
      },
      emails: emailPatterns,
      verification: {
        mxVerified: mxInfo.verified,
        abstractEnabled,
        abstractValidated: abstractEnabled ? emailPatterns.slice(0, 3).length : 0
      },
      confidence: {
        domainAccuracy:
          domainSource === 'known_database' ? 95 :
          domainSource === 'clearbit' ? 90 :
          domainSource === 'brandfetch' ? 85 :
          domainSource === 'google_search' ? 75 :
          50, // heuristic
        learningApplied: learnedPatterns.length > 0,
        learnedPatternCount: learnedPatterns.length
      }
    });

  } catch (error) {
    console.error('[Enrich] Error:', error);
    return NextResponse.json(
      { error: 'Enrichment failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
