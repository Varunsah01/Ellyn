/**
 * LLM-powered domain prediction using Gemini Flash / Mistral 3B / DeepSeek R1 fallback chain.
 * Layer 3.5 in the domain resolution cascade — runs after Brandfetch fails,
 * before falling back to Google Search.
 *
 * Cost target: <$0.0002 per call (Gemini Flash primary)
 * Output cap: 200 tokens
 * Cache: 30 days for positive hits, 1 hour for misses
 */

import { callLLMWithFallback } from '@/lib/llm-client'
import { batchVerifyDomains } from '@/lib/mx-verification'
import { buildCacheKey, getOrSet } from '@/lib/cache/redis'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { createLogger, sanitizeLogFields } from '@/lib/logger'

export interface LlmDomainPrediction {
  domain: string
  confidence: number    // 0–1 as returned by the LLM
  reasoning: string
}

const domainLog = createLogger('LLMDomain')

export interface LlmDomainResult {
  domain: string
  confidence: number    // rescaled to 0–100 for the cascade
  predictions: LlmDomainPrediction[]
  inputTokens: number
  outputTokens: number
  costUsd: number
}

function buildPrompt(companyName: string): string {
  return `You are an expert at identifying the official email domain for companies.

Company: ${companyName}
Task: Predict the official email domain used by employees of this company.

Consider:
- Common acronyms (e.g. "Tata Consultancy Services" → tcs.com)
- Parent company relationships
- Industry conventions (tech startups often use .io or .ai)
- Geographic TLD patterns (India → .in, UK → .co.uk, Germany → .de)
- Rebrands and subsidiary naming patterns

Return ONLY a valid JSON array (no markdown, no explanation outside JSON) of up to 3 predictions, ordered by confidence:
[
  {"domain": "example.com", "confidence": 0.95, "reasoning": "Brief reason"},
  {"domain": "example.io", "confidence": 0.3, "reasoning": "Brief reason"}
]`
}

function parsePredictions(text: string): LlmDomainPrediction[] {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()

  // Find the JSON array
  const arrayStart = cleaned.indexOf('[')
  const arrayEnd   = cleaned.lastIndexOf(']')
  if (arrayStart === -1 || arrayEnd === -1) return []

  try {
    const parsed = JSON.parse(cleaned.slice(arrayStart, arrayEnd + 1))
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter(
        (item): item is LlmDomainPrediction =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.domain === 'string' &&
          item.domain.length > 0 &&
          typeof item.confidence === 'number' &&
          typeof item.reasoning === 'string'
      )
      .map(item => ({
        domain: item.domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, ''),
        confidence: Math.max(0, Math.min(1, item.confidence)),
        reasoning: item.reasoning,
      }))
      .slice(0, 3)
  } catch {
    return []
  }
}

/**
 * Ask the LLM to predict candidate domains, then MX-verify them.
 * Returns the first MX-verified prediction, or null if none pass.
 *
 * Uses Gemini Flash 2.0 → Mistral 3B → DeepSeek R1 fallback chain.
 */
export async function predictDomainWithLLM(
  companyName: string
): Promise<LlmDomainResult | null> {
  if (!process.env.GOOGLE_AI_API_KEY && !process.env.MISTRAL_API_KEY && !process.env.DEEPSEEK_API_KEY) {
    domainLog.warn('No LLM API keys set — skipping LLM layer')
    return null
  }

  const cacheKey = buildCacheKey(['llm-domain-prediction', companyName.toLowerCase().replace(/\s+/g, '-')])

  return getOrSet<LlmDomainResult | null>({
    key: cacheKey,
    ttlSeconds: 30 * 24 * 60 * 60,  // 30 days for positive hits
    cacheNull: true,
    nullTtlSeconds: 60 * 60,          // 1 hour for misses
    tags: [CACHE_TAGS.domainLookup],
    fetcher: async () => {
      let llmResult: { text: string; inputTokens: number; outputTokens: number; costUsd: number }
      try {
        const response = await callLLMWithFallback({
          systemPrompt: buildPrompt(companyName),
          userPrompt: '',
          maxTokens: 200,
          temperature: 0,
          action: 'domain-prediction',
        })
        llmResult = {
          text: response.text,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          costUsd: response.costUsd,
        }
      } catch (err) {
        domainLog.error('All LLM tiers failed', sanitizeLogFields({ error: err instanceof Error ? err.message : String(err) }))
        return null
      }

      const { text, inputTokens, outputTokens, costUsd } = llmResult

      domainLog.debug('LLM token usage', sanitizeLogFields({ companyId: companyName.toLowerCase().replace(/\s+/g, '-'), inputTokens, outputTokens, costUsd }))

      const predictions = parsePredictions(text)
      if (predictions.length === 0) {
        domainLog.warn('No parseable predictions', sanitizeLogFields({ companyId: companyName.toLowerCase().replace(/\s+/g, '-') }))
        return null
      }

      domainLog.debug('Predictions generated', sanitizeLogFields({ companyId: companyName.toLowerCase().replace(/\s+/g, '-'), predictionCount: predictions.length }))

      // MX-verify all predictions in parallel
      const candidates = predictions.map(p => p.domain)
      let mxResults: Map<string, { hasMX: boolean }>
      try {
        mxResults = await Promise.race([
          batchVerifyDomains(candidates),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('LLMDomain MX timeout')), 3000)
          ),
        ])
      } catch {
        domainLog.warn('MX verification timed out', sanitizeLogFields({ companyId: companyName.toLowerCase().replace(/\s+/g, '-') }))
        return null
      }

      // Return the highest-confidence MX-verified prediction
      for (const prediction of predictions) {
        if (mxResults.get(prediction.domain)?.hasMX) {
          domainLog.info('Prediction verified', sanitizeLogFields({ domain: prediction.domain, confidence: prediction.confidence }))
          return {
            domain: prediction.domain,
            confidence: Math.round(prediction.confidence * 100),  // rescale to 0–100
            predictions,
            inputTokens,
            outputTokens,
            costUsd,
          }
        }
      }

      domainLog.info('No MX-verified predictions', sanitizeLogFields({ companyId: companyName.toLowerCase().replace(/\s+/g, '-') }))
      return null
    },
  })
}
