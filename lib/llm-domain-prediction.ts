/**
 * LLM-powered domain prediction using Claude Haiku.
 * Layer 3.5 in the domain resolution cascade — runs after Brandfetch fails,
 * before falling back to Google Search.
 *
 * Cost target: <$0.0002 per call
 * Model: claude-haiku-4-5-20251001 (cheapest, fastest)
 * Output cap: 200 tokens
 * Cache: 30 days for positive hits, 1 hour for misses
 */

import Anthropic from '@anthropic-ai/sdk'
import { batchVerifyDomains } from '@/lib/mx-verification'
import { buildCacheKey, getOrSet } from '@/lib/cache/redis'
import { CACHE_TAGS } from '@/lib/cache/tags'

// Haiku 4.5 pricing (per million tokens)
const INPUT_COST_PER_M  = 0.80
const OUTPUT_COST_PER_M = 4.00
const MAX_OUTPUT_TOKENS = 200
const MODEL = 'claude-haiku-4-5-20251001'

export interface LlmDomainPrediction {
  domain: string
  confidence: number    // 0–1 as returned by the LLM
  reasoning: string
}

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

function calcCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * INPUT_COST_PER_M +
         (outputTokens / 1_000_000) * OUTPUT_COST_PER_M
}

/**
 * Ask Claude Haiku to predict candidate domains, then MX-verify them.
 * Returns the first MX-verified prediction, or null if none pass.
 */
export async function predictDomainWithLLM(
  companyName: string
): Promise<LlmDomainResult | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[LLMDomain] ANTHROPIC_API_KEY not set — skipping LLM layer')
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
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

      let response: Anthropic.Message
      try {
        response = await client.messages.create({
          model: MODEL,
          max_tokens: MAX_OUTPUT_TOKENS,
          messages: [{ role: 'user', content: buildPrompt(companyName) }],
        })
      } catch (err) {
        console.error('[LLMDomain] Anthropic API error:', err)
        return null
      }

      const inputTokens  = response.usage.input_tokens
      const outputTokens = response.usage.output_tokens
      const costUsd      = calcCost(inputTokens, outputTokens)

      console.log(`[LLMDomain] ${companyName}: ${inputTokens} in / ${outputTokens} out / $${costUsd.toFixed(6)}`)

      const rawText = response.content
        .filter(block => block.type === 'text')
        .map(block => (block as Anthropic.TextBlock).text)
        .join('')

      const predictions = parsePredictions(rawText)
      if (predictions.length === 0) {
        console.warn('[LLMDomain] No parseable predictions for:', companyName)
        return null
      }

      console.log('[LLMDomain] Predictions for', companyName, ':', predictions.map(p => p.domain))

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
        console.warn('[LLMDomain] MX verification timed out for:', companyName)
        return null
      }

      // Return the highest-confidence MX-verified prediction
      for (const prediction of predictions) {
        if (mxResults.get(prediction.domain)?.hasMX) {
          console.log('[LLMDomain] Verified:', prediction.domain, `(LLM confidence: ${prediction.confidence})`)
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

      console.log('[LLMDomain] No MX-verified predictions for:', companyName)
      return null
    },
  })
}
