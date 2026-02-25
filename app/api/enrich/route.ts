import { NextRequest, NextResponse } from 'next/server';
import {
  lookupCompanyDomain,
  brandfetchDomain,
  googleSearchDomain,
  heuristicDomainGuess
} from '@/lib/domain-lookup';
import { predictDomainWithLLM } from '@/lib/llm-domain-prediction';
import { verifyDomainMX } from '@/lib/mx-verification';
import {
  generateSmartEmailPatternsCached,
  estimateCompanySize,
  getKnownDomain,
  type EmailPattern,
} from '@/lib/enhanced-email-patterns';
import { getLearnedPatterns, applyLearning } from '@/lib/learning-system';
import { EnrichSchema, formatZodError } from '@/lib/validation/schemas';
import {
  logDomainResolution,
  type LayerAttempt,
  type DomainSource,
} from '@/lib/domain-resolution-analytics';
import { ApiCallError } from '@/lib/api-circuit-breaker';
import { captureApiException } from '@/lib/monitoring/sentry';
import { getGeminiClient } from '@/lib/gemini';
import { verifyEmailZeroBounce } from '@/lib/zerobounce';

/**
 * Use Gemini Flash to rank the 6 candidate email patterns and return the top 2.
 * Falls back to the top 2 by confidence score if Gemini is unavailable.
 */
async function rankWithGemini(
  candidates: EmailPattern[],
  context: {
    firstName: string
    lastName: string
    domain: string
    companySize: string
    emailProvider: string
    role: string | undefined
  }
): Promise<[EmailPattern, EmailPattern]> {
  const first = candidates[0] as EmailPattern;
  const second = (candidates[1] ?? candidates[0]) as EmailPattern;
  const fallback: [EmailPattern, EmailPattern] = [first, second];

  if (candidates.length < 2) return fallback;

  const candidateList = candidates
    .map((c, i) => `${i + 1}. ${c.email} (pattern: ${c.pattern}, confidence: ${c.confidence})`)
    .join('\n');

  const prompt = `You are an expert at predicting professional email addresses.

Context:
- Name: ${context.firstName} ${context.lastName}
- Domain: ${context.domain}
- Company size: ${context.companySize}
- Email provider: ${context.emailProvider || 'unknown'}
- Role: ${context.role || 'unknown'}

Candidate emails:
${candidateList}

Select the 2 most probable email addresses for this person. Consider name conventions for the company size and email provider.

Return ONLY valid JSON, no markdown:
{"ranked": ["most_probable_email@domain.com", "second_most_probable@domain.com"]}`;

  try {
    const gemini = getGeminiClient();
    const response = await gemini.generateText({
      prompt,
      maxTokens: 100,
      temperature: 0,
      action: 'email-ranking',
    });

    const cleaned = response.text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) return fallback;

    const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as { ranked?: unknown };
    if (!Array.isArray(parsed.ranked) || parsed.ranked.length < 2) return fallback;

    const rank1Email = String(parsed.ranked[0]).toLowerCase();
    const rank2Email = String(parsed.ranked[1]).toLowerCase();

    const rank1 = (candidates.find(c => c.email === rank1Email) ?? candidates[0]) as EmailPattern;
    const rank2 = (candidates.find(c => c.email === rank2Email) ?? candidates[1] ?? candidates[0]) as EmailPattern;

    return [rank1, rank2];
  } catch (err) {
    console.warn('[Enrich] Gemini ranking failed, using confidence fallback:', err instanceof Error ? err.message : err);
    return fallback;
  }
}

function buildFailureSuggestion(layers: LayerAttempt[]): string {
  if (layers.some(l => l.errorType === 'circuit_open'))
    return 'Some lookup services are temporarily unavailable â€” please try again in a few minutes'
  const errors = layers.filter(l => l.result === 'error').map(l => l.errorType)
  if (errors.includes('rate_limit'))
    return 'API rate limits reached â€” please wait a moment and try again'
  if (errors.includes('timeout'))
    return 'Domain lookup timed out â€” try using the full legal company name'
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

    // Step 3.5: LLM prediction (Claude Haiku â€” cheap, fast, handles acronyms/rebrands)
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

    // 7. Gemini Flash ranking — select top 2 from the 6 candidates
    const top2 = await rankWithGemini(
      emailPatterns,
      { firstName, lastName, domain, companySize: companyProfile.estimatedSize, emailProvider: mxInfo.provider || '', role }
    );

    // 8. Sequential ZeroBounce SMTP verification (max 2 checks per request)
    let topResult: EmailPattern & { verified: boolean; verificationSource: 'zerobounce' | null; badge: 'verified' | 'most_probable' } = {
      ...top2[0],
      verified: false,
      verificationSource: null,
      badge: 'most_probable',
    };
    let emailsChecked = 0;

    if (process.env.ZEROBOUNCE_API_KEY) {
      // Check rank #1
      const r1 = await verifyEmailZeroBounce(top2[0].email);
      emailsChecked++;
      if (r1.deliverability === 'DELIVERABLE') {
        topResult = {
          ...top2[0],
          confidence: Math.min(95, top2[0].confidence + 20),
          verified: true,
          verificationSource: 'zerobounce',
          badge: 'verified',
        };
      } else if (top2[1]) {
        // Check rank #2 only if rank #1 is not deliverable
        const r2 = await verifyEmailZeroBounce(top2[1].email);
        emailsChecked++;
        if (r2.deliverability === 'DELIVERABLE') {
          topResult = {
            ...top2[1],
            confidence: Math.min(95, top2[1].confidence + 20),
            verified: true,
            verificationSource: 'zerobounce',
            badge: 'verified',
          };
        }
      }
    }

    // 9. Log resolution outcome asynchronously (non-blocking)
    logDomainResolution({
      companyName,
      domain,
      domainSource,
      mxValid: mxInfo.hasMX,
      confidenceScore,
      attemptedLayers,
    });

    // 10. Return enriched data
    return NextResponse.json({
      success: true,
      cost: 0,
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
      topResult,
      verification: {
        mxVerified: mxInfo.verified,
        smtpVerified: topResult.verified,
        emailsChecked,
      },
      confidence: {
        domainAccuracy: confidenceScore,
        learningApplied: learnedPatterns.length > 0,
        learnedPatternCount: learnedPatterns.length
      }
    });

  } catch (error) {
    console.error('[Enrich] Error:', error);
    captureApiException(error, { route: '/api/enrich', method: 'POST' })
    return NextResponse.json(
      { error: 'Enrichment failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
