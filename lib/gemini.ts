import { GoogleGenerativeAI } from '@google/generative-ai'

export type GeminiModel = 'gemini-2.0-flash-exp' | 'gemini-1.5-flash'

export interface GeminiConfig {
  model: GeminiModel
  maxOutputTokens: number
  temperature: number
  topK: number
  topP: number
}

export interface GeminiRequest {
  prompt: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  action?: string
}

export interface GeminiUsage {
  input: number
  output: number
  total: number
}

export interface GeminiResponse {
  text: string
  tokensUsed: GeminiUsage
  cost: number
  model: GeminiModel
}

type UsageLedger = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: number
  requestCount: number
}

const DEFAULT_CONFIG: GeminiConfig = {
  model: 'gemini-2.0-flash-exp',
  maxOutputTokens: 700,
  temperature: 0.7,
  topK: 32,
  topP: 0.9,
}

const MODEL_PRICING_USD_PER_1K: Record<GeminiModel, { input: number; output: number }> = {
  'gemini-2.0-flash-exp': {
    input: 0.00001875,
    output: 0.000075,
  },
  'gemini-1.5-flash': {
    input: 0.000075,
    output: 0.0003,
  },
}

const MAX_RETRIES = 2
const REQUEST_TIMEOUT_MS = 12_000

/**
 * Gemini API client with retry, cost tracking, and lightweight usage accounting.
 *
 * Example:
 * const client = new GeminiClient(process.env.GOOGLE_AI_API_KEY || '')
 * const out = await client.generateText({ prompt: 'Rewrite this email politely.' })
 */
export class GeminiClient {
  private readonly apiKey: string
  private readonly client: GoogleGenerativeAI
  private readonly config: GeminiConfig

  private static readonly dailyUsage = new Map<string, UsageLedger>()
  private static readonly monthlyUsage = new Map<string, UsageLedger>()

  constructor(apiKey: string, config: Partial<GeminiConfig> = {}) {
    const normalizedKey = apiKey.trim()

    if (!normalizedKey) {
      throw new Error('Gemini API key is missing. Set GOOGLE_AI_API_KEY or GEMINI_API_KEY.')
    }

    this.apiKey = normalizedKey
    this.client = new GoogleGenerativeAI(this.apiKey)
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    }
  }

  /**
   * Generate text output from Gemini with retries and fallback model support.
   */
  async generateText(request: GeminiRequest): Promise<GeminiResponse> {
    const prompt = request.prompt?.trim()
    if (!prompt) {
      throw new Error('Prompt is required for Gemini generation.')
    }

    const requestLabel = request.action || 'unknown-action'
    const startedAt = Date.now()

    console.log('[Gemini] Request started', {
      at: new Date(startedAt).toISOString(),
      action: requestLabel,
      model: this.config.model,
      promptLength: prompt.length,
    })

    try {
      const primary = await this.generateWithRetries(this.config.model, request)
      this.recordUsage(primary.tokensUsed, primary.cost)
      this.logCompletion(requestLabel, startedAt, primary)
      return primary
    } catch (error) {
      const isModelFallbackCandidate = this.config.model === 'gemini-2.0-flash-exp' && isModelNotFoundError(error)

      if (!isModelFallbackCandidate) {
        throw this.toReadableError(error)
      }

      console.warn('[Gemini] Primary model unavailable, retrying with fallback model', {
        primaryModel: this.config.model,
        fallbackModel: 'gemini-1.5-flash',
      })

      const fallback = await this.generateWithRetries('gemini-1.5-flash', request)
      this.recordUsage(fallback.tokensUsed, fallback.cost)
      this.logCompletion(requestLabel, startedAt, fallback)
      return fallback
    }
  }

  /**
   * Basic availability check for health endpoints and diagnostics.
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.generateText({
        prompt: 'Reply with exactly: ok',
        maxTokens: 8,
        temperature: 0,
        action: 'health-check',
      })

      return true
    } catch (error) {
      console.error('[Gemini] Health check failed', {
        error: this.toLoggableError(error),
      })
      return false
    }
  }

  /**
   * Calculates USD cost using model-specific pricing rates.
   */
  calculateCost(inputTokens: number, outputTokens: number, model: GeminiModel = this.config.model): number {
    const pricing = MODEL_PRICING_USD_PER_1K[model]
    const cost = (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output
    return roundToSix(Math.max(0, cost))
  }

  /**
   * Returns aggregated in-memory daily/monthly usage for diagnostics.
   */
  getUsageSnapshot() {
    return {
      daily: Object.fromEntries(GeminiClient.dailyUsage.entries()),
      monthly: Object.fromEntries(GeminiClient.monthlyUsage.entries()),
    }
  }

  private async generateWithRetries(modelName: GeminiModel, request: GeminiRequest): Promise<GeminiResponse> {
    let attempt = 0

    while (attempt <= MAX_RETRIES) {
      try {
        return await this.generateOnce(modelName, request)
      } catch (error) {
        const status = getErrorStatus(error)
        const retryable = status === 429 || status === 500 || status === 503 || isLikelyNetworkError(error)

        if (!retryable || attempt >= MAX_RETRIES) {
          throw error
        }

        const backoffMs = 300 * 2 ** attempt
        console.warn('[Gemini] Retry scheduled', {
          model: modelName,
          attempt: attempt + 1,
          status,
          backoffMs,
        })

        await sleep(backoffMs)
        attempt += 1
      }
    }

    throw new Error('Gemini request failed after retries.')
  }

  private async generateOnce(modelName: GeminiModel, request: GeminiRequest): Promise<GeminiResponse> {
    const model = this.client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        maxOutputTokens: Math.min(request.maxTokens ?? this.config.maxOutputTokens, 1000),
        temperature: request.temperature ?? this.config.temperature,
        topK: this.config.topK,
        topP: this.config.topP,
      },
    })

    const composedPrompt = composePrompt(request.systemPrompt, request.prompt)

    const result = await withTimeout(model.generateContent(composedPrompt), REQUEST_TIMEOUT_MS, 'Gemini request timed out.')
    const response = await result.response
    const text = response.text().trim()

    if (!text) {
      throw new Error('Gemini returned an empty response.')
    }

    const usage = response.usageMetadata
    const inputTokens = usage?.promptTokenCount ?? 0
    const outputTokens = usage?.candidatesTokenCount ?? 0
    const totalTokens = usage?.totalTokenCount ?? inputTokens + outputTokens

    return {
      text,
      tokensUsed: {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens,
      },
      cost: this.calculateCost(inputTokens, outputTokens, modelName),
      model: modelName,
    }
  }

  private logCompletion(action: string, startedAt: number, response: GeminiResponse) {
    const durationMs = Date.now() - startedAt

    console.log('[Gemini] Request completed', {
      action,
      model: response.model,
      durationMs,
      tokens: response.tokensUsed,
      costUsd: response.cost,
    })
  }

  private recordUsage(tokens: GeminiUsage, cost: number) {
    const now = new Date()
    const dailyKey = now.toISOString().slice(0, 10)
    const monthlyKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

    updateLedger(GeminiClient.dailyUsage, dailyKey, tokens, cost)
    updateLedger(GeminiClient.monthlyUsage, monthlyKey, tokens, cost)
  }

  private toReadableError(error: unknown): Error {
    const message = (error as { message?: string })?.message || 'Unknown Gemini error'

    if (isInvalidApiKeyError(error)) {
      return new Error('Invalid Google AI API key. Check GOOGLE_AI_API_KEY and retry.')
    }

    if (getErrorStatus(error) === 429) {
      return new Error('Gemini rate limit reached. Please retry in a few seconds.')
    }

    if (getErrorStatus(error) === 500 || getErrorStatus(error) === 503) {
      return new Error('Gemini service is temporarily unavailable. Please retry.')
    }

    return new Error(message)
  }

  private toLoggableError(error: unknown) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
      }
    }

    return {
      message: String(error),
    }
  }
}

let singletonClient: GeminiClient | null = null

/**
 * Shared singleton client so API routes reuse one initialized SDK client.
 */
export function getGeminiClient(): GeminiClient {
  if (!singletonClient) {
    const apiKey = process.env.GOOGLE_AI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim() || ''
    singletonClient = new GeminiClient(apiKey)
  }

  return singletonClient
}

function composePrompt(systemPrompt: string | undefined, userPrompt: string): string {
  const trimmedSystem = systemPrompt?.trim()
  const trimmedUser = userPrompt.trim()

  if (!trimmedSystem) {
    return trimmedUser
  }

  return `System instructions:\n${trimmedSystem}\n\nUser request:\n${trimmedUser}`
}

function updateLedger(map: Map<string, UsageLedger>, key: string, tokens: GeminiUsage, cost: number): void {
  const current = map.get(key) || {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    requestCount: 0,
  }

  map.set(key, {
    inputTokens: current.inputTokens + tokens.input,
    outputTokens: current.outputTokens + tokens.output,
    totalTokens: current.totalTokens + tokens.total,
    costUsd: roundToSix(current.costUsd + cost),
    requestCount: current.requestCount + 1,
  })
}

function getErrorStatus(error: unknown): number | null {
  const status = (error as { status?: unknown })?.status
  if (typeof status === 'number') {
    return status
  }

  const code = (error as { code?: unknown })?.code
  if (typeof code === 'number') {
    return code
  }

  return null
}

function isInvalidApiKeyError(error: unknown): boolean {
  const message = (error as { message?: string })?.message || ''
  return /api key not valid|invalid api key|permission denied/i.test(message)
}

function isModelNotFoundError(error: unknown): boolean {
  const message = (error as { message?: string })?.message || ''
  return /model.*not found|is not found|unsupported model/i.test(message)
}

function isLikelyNetworkError(error: unknown): boolean {
  const message = (error as { message?: string })?.message || ''
  return /network|fetch failed|econnreset|etimedout|timeout/i.test(message)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(message))
    }, timeoutMs)
  })

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  })
}

function roundToSix(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}
