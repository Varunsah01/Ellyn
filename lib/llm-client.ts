/**
 * Unified LLM client with 3-tier fallback chain.
 *
 * Tier 1 — Gemini Flash 2.0  (primary, cheapest)
 * Tier 2 — Mistral 3B        (ministral-3b-latest)
 * Tier 3 — DeepSeek R1       (deepseek-reasoner, strips <think> blocks)
 *
 * Usage:
 *   const result = await callLLMWithFallback({ systemPrompt, userPrompt, maxTokens: 200 })
 *   console.log(result.text, result.provider)
 */

import { getGeminiClient } from '@/lib/gemini'

export type LLMProvider = 'gemini' | 'mistral' | 'deepseek'

export interface LLMRequest {
  systemPrompt: string
  userPrompt: string
  maxTokens?: number
  temperature?: number
  action?: string
}

export interface LLMResponse {
  text: string
  model: string
  provider: LLMProvider
  inputTokens: number
  outputTokens: number
  costUsd: number
}

// ---------------------------------------------------------------------------
// Mistral 3B
// ---------------------------------------------------------------------------

const MISTRAL_MODEL = 'ministral-3b-latest'
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions'

// Approximate Mistral pricing (per 1K tokens, USD)
const MISTRAL_PRICING_PER_1K = {
  input: 0.00004,
  output: 0.00004,
}

interface OpenAIChatResponse {
  choices: Array<{ message: { content: string } }>
  usage?: { prompt_tokens: number; completion_tokens: number }
}

async function callMistral(request: LLMRequest): Promise<LLMResponse> {
  const apiKey = process.env.MISTRAL_API_KEY?.trim()
  if (!apiKey) throw new Error('MISTRAL_API_KEY not set')

  const body = {
    model: MISTRAL_MODEL,
    messages: [
      ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
      { role: 'user', content: request.userPrompt || request.systemPrompt },
    ],
    max_tokens: request.maxTokens ?? 300,
    temperature: request.temperature ?? 0.1,
  }

  const response = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText)
    throw new Error(`Mistral API error ${response.status}: ${err}`)
  }

  const data = (await response.json()) as OpenAIChatResponse
  const text = data.choices?.[0]?.message?.content?.trim() ?? ''
  if (!text) throw new Error('Mistral returned empty response')

  const inputTokens = data.usage?.prompt_tokens ?? 0
  const outputTokens = data.usage?.completion_tokens ?? 0
  const costUsd =
    (inputTokens / 1000) * MISTRAL_PRICING_PER_1K.input +
    (outputTokens / 1000) * MISTRAL_PRICING_PER_1K.output

  return { text, model: MISTRAL_MODEL, provider: 'mistral', inputTokens, outputTokens, costUsd }
}

// ---------------------------------------------------------------------------
// DeepSeek R1
// ---------------------------------------------------------------------------

const DEEPSEEK_MODEL = 'deepseek-reasoner'
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'

// Approximate DeepSeek R1 pricing (per 1K tokens, USD)
const DEEPSEEK_PRICING_PER_1K = {
  input: 0.00055,
  output: 0.00219,
}

/**
 * Strip DeepSeek R1 chain-of-thought <think>…</think> blocks before
 * returning the final answer text.
 */
function stripThinkingBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}

async function callDeepSeek(request: LLMRequest): Promise<LLMResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim()
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not set')

  const body = {
    model: DEEPSEEK_MODEL,
    messages: [
      ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
      { role: 'user', content: request.userPrompt || request.systemPrompt },
    ],
    max_tokens: request.maxTokens ?? 300,
    temperature: request.temperature ?? 0.1,
  }

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText)
    throw new Error(`DeepSeek API error ${response.status}: ${err}`)
  }

  const data = (await response.json()) as OpenAIChatResponse
  const rawText = data.choices?.[0]?.message?.content ?? ''
  const text = stripThinkingBlocks(rawText)
  if (!text) throw new Error('DeepSeek returned empty response')

  const inputTokens = data.usage?.prompt_tokens ?? 0
  const outputTokens = data.usage?.completion_tokens ?? 0
  const costUsd =
    (inputTokens / 1000) * DEEPSEEK_PRICING_PER_1K.input +
    (outputTokens / 1000) * DEEPSEEK_PRICING_PER_1K.output

  return { text, model: DEEPSEEK_MODEL, provider: 'deepseek', inputTokens, outputTokens, costUsd }
}

// ---------------------------------------------------------------------------
// Gemini Flash 2.0  (uses existing GeminiClient)
// ---------------------------------------------------------------------------

async function callGemini(request: LLMRequest): Promise<LLMResponse> {
  const client = getGeminiClient()
  const response = await client.generateText({
    prompt: request.userPrompt || request.systemPrompt,
    systemPrompt: request.userPrompt ? request.systemPrompt : undefined,
    maxTokens: request.maxTokens,
    temperature: request.temperature,
    action: request.action,
  })

  return {
    text: response.text,
    model: response.model,
    provider: 'gemini',
    inputTokens: response.tokensUsed.input,
    outputTokens: response.tokensUsed.output,
    costUsd: response.cost,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Call the LLM fallback chain: Gemini Flash → Mistral 3B → DeepSeek R1.
 * Returns the first successful response. Throws only if all three fail.
 */
export async function callLLMWithFallback(request: LLMRequest): Promise<LLMResponse> {
  const tiers: Array<{ name: string; fn: (r: LLMRequest) => Promise<LLMResponse> }> = [
    { name: 'gemini', fn: callGemini },
    { name: 'mistral', fn: callMistral },
    { name: 'deepseek', fn: callDeepSeek },
  ]

  const errors: string[] = []

  for (const tier of tiers) {
    try {
      const result = await tier.fn(request)
      if (tier.name !== 'gemini') {
        console.log(`[LLMClient] Fallback succeeded via ${tier.name}`, {
          action: request.action,
          model: result.model,
        })
      }
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${tier.name}: ${msg}`)
      console.warn(`[LLMClient] ${tier.name} failed, trying next tier`, {
        action: request.action,
        error: msg,
      })
    }
  }

  throw new Error(`All LLM tiers failed for action "${request.action}": ${errors.join(' | ')}`)
}
