import { NextRequest, NextResponse } from 'next/server';
import {
  lookupCompanyDomain,
  brandfetchDomain,
  googleSearchDomain,
  heuristicDomainGuess
} from '@/lib/domain-lookup';
import { predictDomainWithLLM } from '@/lib/llm-domain-prediction';
import { verifyDomainMX } from '@/lib/mx-verification';
import { validateEmailAbstract } from '@/lib/abstract-email-validation';
import {
  generateSmartEmailPatternsCached,
  estimateCompanySize,
  getKnownDomain
} from '@/lib/enhanced-email-patterns';
import { getLearnedPatterns, applyLearning } from '@/lib/learning-system';
import { EnrichSchema, formatZodError } from '@/lib/validation/schemas';
import {
  logDomainResolution,
  type LayerAttempt,
  type DomainSource,
} from '@/lib/domain-resolution-analytics';
import { ApiCallError } from '@/lib/api-circuit-breaker';

function buildFailureSuggestion(layers: LayerAttempt[]): string {
  if (layers.some(l => l.errorType === 'circuit_open'))
    return 'Some lookup services are temporarily unavailable — please try again in a few minutes'
  const errors = layers.filter(l => l.result === 'error').map(l => l.errorType)
  if (errors.includes('rate_limit'))
    return 'API rate limits reached — please wait a moment and try again'
  if (errors.includes('timeout'))
    return 'Domain lookup timed out — try using the full legal company name'
  return 'Please provide the company website URL directly (e.g. "acme.com")'
}

/**
 * Handle POST requests for `/api/enrich`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the POST /api/enrich request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/enrich
 * fetch('/api/enrich', { method: 'POST' })
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = EnrichSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodError(parsed.error) },
        { status: 400 }
      );
    }
    const { firstName, lastName, companyName, role } = parsed.data;

    // 2. Find company domain (FREE CASCADE)
    let domain: string | null = null;
    let domainSource: DomainSource = 'unknown';
    const attemptedLayers: LayerAttempt[] = [];

    console.log('[Enrich] Looking up domain for:', companyName);

    // Step 1: Check known domains
    domain = await getKnownDomain(companyName);
    if (domain) {
      domainSource = 'known_database';
      attemptedLayers.push({ layer: 'known_database', result: 'hit' });
      console.log('[Enrich] Found in known domains:', domain);
    } else {
      attemptedLayers.push({ layer: 'known_database', result: 'miss' });
    }

    // Step 2: Try Clearbit (free)
    if (!domain) {
      try {
        domain = await lookupCompanyDomain(companyName);
        if (domain) {
          domainSource = 'clearbit';
          attemptedLayers.push({ layer: 'clearbit', result: 'hit' });
        } else {
          attemptedLayers.push({ layer: 'clearbit', result: 'miss' });
        }
      } catch (err) {
        const errorType = err instanceof ApiCallError ? err.errorType : 'api_error';
        attemptedLayers.push({ layer: 'clearbit', result: 'error', error: String(err), errorType });
        console.error('[Enrich] Clearbit failed:', errorType, err);
      }
    }

    // Step 3: Try Brandfetch (free)
    if (!domain) {
      try {
        domain = await brandfetchDomain(companyName);
        if (domain) {
          domainSource = 'brandfetch';
          attemptedLayers.push({ layer: 'brandfetch', result: 'hit' });
        } else {
          attemptedLayers.push({ layer: 'brandfetch', result: 'miss' });
        }
      } catch (err) {
        const errorType = err instanceof ApiCallError ? err.errorType : 'api_error';
        attemptedLayers.push({ layer: 'brandfetch', result: 'error', error: String(err), errorType });
        console.error('[Enrich] Brandfetch failed:', errorType, err);
      }
    }

    // Step 3.5: LLM prediction (Claude Haiku — cheap, fast, handles acronyms/rebrands)
    if (!domain) {
      try {
        const llmResult = await predictDomainWithLLM(companyName);
        if (llmResult) {
          domain = llmResult.domain;
          domainSource = 'llm_prediction';
          attemptedLayers.push({ layer: 'llm_prediction', result: 'hit' });
          console.log('[Enrich] LLM predicted:', domain, `($${llmResult.costUsd.toFixed(6)})`);
        } else {
          attemptedLayers.push({ layer: 'llm_prediction', result: 'miss' });
        }
      } catch (err) {
        const errorType = err instanceof ApiCallError ? err.errorType : 'api_error';
        attemptedLayers.push({ layer: 'llm_prediction', result: 'error', error: String(err), errorType });
        console.error('[Enrich] LLM prediction failed:', errorType, err);
      }
    }

    // Step 4: Try Google Search (free 100/day)
    if (!domain) {
      try {
        domain = await googleSearchDomain(companyName);
        if (domain) {
          domainSource = 'google_search';
          attemptedLayers.push({ layer: 'google_search', result: 'hit' });
        } else {
          attemptedLayers.push({ layer: 'google_search', result: 'miss' });
        }
      } catch (err) {
        const errorType = err instanceof ApiCallError ? err.errorType : 'api_error';
        attemptedLayers.push({ layer: 'google_search', result: 'error', error: String(err), errorType });
        console.error('[Enrich] Google search failed:', errorType, err);
      }
    }

    // Step 5: Smart heuristic fallback (last resort)
    if (!domain) {
      const heuristicResult = await heuristicDomainGuess(companyName);
      if (heuristicResult) {
        domain = heuristicResult;
        domainSource = 'heuristic';
        attemptedLayers.push({ layer: 'heuristic', result: 'hit' });
        console.log('[Enrich] Smart TLD resolved:', domain);
      } else {
        attemptedLayers.push({ layer: 'heuristic', result: 'miss' });
        logDomainResolution({ companyName, domain: '', domainSource: 'unknown', mxValid: false, confidenceScore: 0, attemptedLayers });
        return NextResponse.json({
          success: false,
          error: 'Could not determine company domain',
          suggestion: buildFailureSuggestion(attemptedLayers),
        }, { status: 400 });
      }
    }

    // 3. Verify domain MX records (ALWAYS ON, FREE)
    console.log('[Enrich] Verifying MX records for:', domain);
    const mxInfo = await verifyDomainMX(domain);

    // Confidence score mirrors the return value logic below
    const confidenceScore =
      domainSource === 'known_database' ? 95 :
      domainSource === 'clearbit' ? 90 :
      domainSource === 'brandfetch' ? 85 :
      domainSource === 'llm_prediction' ? 70 :
      domainSource === 'google_search' ? 75 :
      50;

    if (!mxInfo.hasMX) {
      // Log the failed resolution before returning the error
      logDomainResolution({
        companyName,
        domain,
        domainSource,
        mxValid: false,
        confidenceScore,
        attemptedLayers,
      });

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

    // 4. Build company profile
    const companyProfile = {
      domain,
      estimatedSize: estimateCompanySize(domain),
      emailProvider: mxInfo.provider
    };

    console.log('[Enrich] Company profile:', companyProfile);

    // 5. Generate smart email patterns
    let emailPatterns = await generateSmartEmailPatternsCached(
      firstName,
      lastName,
      companyProfile,
      role
    );

    // 6. Apply learning from past successes
    const learnedPatterns = await getLearnedPatterns(domain);
    if (learnedPatterns.length > 0) {
      console.log('[Enrich] Applying learning from', learnedPatterns.length, 'patterns');
      emailPatterns = applyLearning(emailPatterns, learnedPatterns);
    }

    // 7. Optional: Abstract Email Validation
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

    // 8. Log resolution outcome asynchronously (non-blocking)
    logDomainResolution({
      companyName,
      domain,
      domainSource,
      mxValid: mxInfo.hasMX,
      confidenceScore,
      attemptedLayers,
    });

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
        domainAccuracy: confidenceScore,
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
