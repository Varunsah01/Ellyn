import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

import { getAuthenticatedUser, getUserQuota } from '@/lib/auth/helpers'
import {
  captureApiException,
  captureSlowApiRoute,
  withApiRouteSpan,
} from '@/lib/monitoring/sentry'
import { recordExternalApiUsage, timeOperation } from '@/lib/monitoring/performance'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { PredictPatternsSchema, formatZodError } from '@/lib/validation/schemas'

type EstimatedCompanySize = 'startup' | 'medium' | 'enterprise'

type PatternPrediction = {
  template: string
  confidence: number
}

type PatternPredictionResult = {
  patterns: PatternPrediction[]
  reasoning: string
}

type QuotaSnapshot = {
  used: number | null
  limit: number | null
  remaining: number | null
  resetDate: string | null
  source: 'rpc' | 'table' | 'none'
}

type AnthropicUsage = {
  input_tokens: number | null
  output_tokens: number
  cache_creation_input_tokens: number | null
  cache_read_input_tokens: number | null
}

const ANTHROPIC_MODEL = 'claude-3-5-haiku-latest'
const MAX_TOKENS = 300

// Approximate public pricing for Claude 3.5 Haiku (per 1M tokens).
// Keep these in code for transparent cost accounting.
const PRICING_USD_PER_1M = {
  input: 0.8,
  output: 4.0,
  cacheWrite: 1.0,
  cacheRead: 0.08,
}

const SYSTEM_PROMPT = `You predict professional email address patterns for a given person. You MUST return exactly 8 patterns in ranked order by likelihood.
Use ONLY these 8 template keys:
first.last | flast | firstlast | first | last.first | lastfirst | first_last | f.last

Common patterns by company size:

Enterprise (5000+): first.last@domain.com (56%)
Mid-market (200-1000): flast@domain.com (42%)
Startup (1-50): first@domain.com (61%)

Consider:

Company size and industry
Domain TLD (.com vs .io vs country-specific)
Role level (executives often have simpler patterns)
Cultural context (US vs Europe vs Asia)

Return ONLY a JSON array with no markdown:
{"patterns": [{"template": "first.last", "confidence": 0.85}, ...], "reasoning": "Brief explanation"}
All 8 must appear. Confidence values must sum to approximately 1.0.`

/**
 * Handle POST requests for `/api/predict-patterns`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the POST /api/predict-patterns request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/predict-patterns
 * fetch('/api/predict-patterns', { method: 'POST' })
 */
export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  let userId = ''
  const warnings: string[] = []

  return withApiRouteSpan(
    'POST /api/predict-patterns',
    async () => {
      try {
        const user = await getAuthenticatedUser()
        userId = user.id

        const parsed = PredictPatternsSchema.safeParse(await request.json())
        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: 'Validation failed', details: formatZodError(parsed.error) },
            { status: 400 }
          )
        }
        const body = parsed.data
        const domain = normalizeDomain(body.domain || '')
        const company = normalizeCompanyName(body.company || '')
        const role = normalizeOptionalField(body.role)
        const industry = normalizeOptionalField(body.industry)

        const quota = await getQuotaSnapshot(userId)

        const estimatedSize = estimateCompanySize(domain, company)

        let result: PatternPredictionResult | null = null
        let usage: AnthropicUsage | null = null
        let source: 'llm' | 'heuristic-fallback' = 'llm'

        try {
          const anthropicResponse = await predictWithClaude({
            domain,
            company,
            role,
            industry,
            estimatedSize,
            userId,
          })

          result = anthropicResponse.result
          usage = anthropicResponse.usage
        } catch (error) {
          source = 'heuristic-fallback'

          const safeError = sanitizeErrorForLog(error)
          const isAnthropicRateLimit = isRateLimitError(error)

          if (isAnthropicRateLimit) {
            warnings.push('Anthropic rate limit encountered; returned heuristic fallback.')
          } else {
            warnings.push('LLM prediction failed; returned heuristic fallback.')
          }

          console.error('[predict-patterns] Claude prediction failed:', safeError)
          result = heuristicFallbackPatterns({ estimatedSize, role, domain, company, industry })
        }

        const totalCostUsd = calculateCostUsd(usage)

        await trackCost({
          userId,
          domain,
          company,
          role,
          industry,
          estimatedSize,
          usage,
          costUsd: totalCostUsd,
          source,
        })

        captureSlowApiRoute('/api/predict-patterns', Date.now() - startedAt, {
          method: 'POST',
          thresholdMs: 2000,
        })

        return NextResponse.json({
          success: true,
          domain,
          company,
          estimatedSize,
          source,
          patterns: result.patterns,
          reasoning: result.reasoning,
          quota: {
            used: quota.used,
            limit: quota.limit,
            remaining: quota.remaining,
            resetDate: quota.resetDate,
            source: quota.source,
          },
          usage: usage
            ? {
                inputTokens: usage.input_tokens ?? 0,
                outputTokens: usage.output_tokens ?? 0,
                cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
                cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
              }
            : null,
          costUsd: totalCostUsd,
          warnings,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'

        if (message === 'Unauthorized') {
          return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        captureApiException(error, {
          route: '/api/predict-patterns',
          method: 'POST',
          userId,
        })
        console.error('[predict-patterns] Internal error:', sanitizeErrorForLog(error))
        return NextResponse.json(
          { success: false, error: 'Failed to predict email patterns' },
          { status: 500 }
        )
      }
    },
    {
      'api.route': '/api/predict-patterns',
      'api.method': 'POST',
    }
  )
}

/**
 * Handle GET requests for `/api/predict-patterns`.
 * @returns {unknown} JSON response for the GET /api/predict-patterns request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/predict-patterns
 * fetch('/api/predict-patterns')
 */
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}

async function predictWithClaude(params: {
  domain: string
  company: string
  role: string | null
  industry: string | null
  estimatedSize: EstimatedCompanySize
  userId: string
}): Promise<{ result: PatternPredictionResult; usage: AnthropicUsage }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const anthropic = new Anthropic({ apiKey })

  const userPrompt = `Domain: ${params.domain}
Company: ${params.company}
Size: ${params.estimatedSize}
Role: ${params.role || 'unknown'}
Industry: ${params.industry || 'unknown'}
Predict the top 3 email patterns for this company.`

  const startedAt = Date.now()
  try {
    const response = await timeOperation(
      'anthropic.predict-patterns.messages.create',
      async () => await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.1,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral', ttl: '1h' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        metadata: {
          user_id: params.userId,
        },
      }),
      {
        slowThresholdMs: 500,
        context: {
          route: '/api/predict-patterns',
          domain: params.domain,
        },
      }
    )

    const rawText = extractTextContent(response.content)
    const parsed = parsePredictionJson(rawText)

    const usage: AnthropicUsage = {
      input_tokens: response.usage?.input_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
      cache_creation_input_tokens: response.usage?.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: response.usage?.cache_read_input_tokens ?? 0,
    }

    recordExternalApiUsage({
      service: 'anthropic',
      operation: 'messages.create:predict-patterns',
      costUsd: calculateCostUsd(usage),
      durationMs: Date.now() - startedAt,
      statusCode: 200,
      success: true,
    })

    return { result: parsed, usage }
  } catch (error) {
    const statusCode = Number((error as { status?: number })?.status)
    recordExternalApiUsage({
      service: 'anthropic',
      operation: 'messages.create:predict-patterns',
      costUsd: 0,
      durationMs: Date.now() - startedAt,
      statusCode: Number.isFinite(statusCode) ? statusCode : 500,
      success: false,
    })
    throw error
  }
}

async function getQuotaSnapshot(userId: string): Promise<QuotaSnapshot> {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase.rpc('get_quota_status', {
      p_user_id: userId,
    })

    if (!error) {
      const row = Array.isArray(data) ? data[0] : data
      if (row) {
        const limit = toSafeInt((row as any).quota_limit, 25)
        const used = toSafeInt((row as any).used, 0)
        const remaining = toSafeInt((row as any).remaining, Math.max(0, limit - used))
        return {
          used,
          limit,
          remaining,
          resetDate: row.reset_date ? new Date(row.reset_date).toISOString() : null,
          source: 'rpc',
        }
      }
    } else {
      if (!isMissingDbObjectError(error)) {
        console.error('[predict-patterns] Quota RPC failed:', {
          code: error.code,
          message: error.message,
        })
      }
    }
  } catch (error) {
    console.error('[predict-patterns] Quota RPC exception:', sanitizeErrorForLog(error))
    captureApiException(error, { route: '/api/predict-patterns', method: 'GET' })
  }

  try {
    const quota = await getUserQuota(userId)
    const limit = toSafeInt((quota as any).email_lookups_limit, 50)
    const used = toSafeInt((quota as any).email_lookups_used, 0)
    const resetDate = (quota as any).period_end ? new Date((quota as any).period_end) : null
    const remaining = Math.max(0, limit - used)

    return {
      used,
      limit,
      remaining,
      resetDate: resetDate ? resetDate.toISOString() : null,
      source: 'table',
    }
  } catch (error) {
    console.error('[predict-patterns] Quota snapshot fallback failed:', sanitizeErrorForLog(error))
    captureApiException(error, { route: '/api/predict-patterns', method: 'GET' })
    return {
      used: null,
      limit: null,
      remaining: null,
      resetDate: null,
      source: 'none',
    }
  }
}

async function trackCost(params: {
  userId: string
  domain: string
  company: string
  role: string | null
  industry: string | null
  estimatedSize: EstimatedCompanySize
  usage: AnthropicUsage | null
  costUsd: number
  source: 'llm' | 'heuristic-fallback'
}) {
  try {
    const serviceClient = await createServiceRoleClient()

    const tableReady = await ensureApiCostsTableExists(serviceClient)
    if (!tableReady) {
      return
    }

    const metadata = {
      domain: params.domain,
      company: params.company,
      role: params.role,
      industry: params.industry,
      estimatedSize: params.estimatedSize,
      model: ANTHROPIC_MODEL,
      source: params.source,
      tokens: {
        input: params.usage?.input_tokens ?? 0,
        output: params.usage?.output_tokens ?? 0,
        cacheCreation: params.usage?.cache_creation_input_tokens ?? 0,
        cacheRead: params.usage?.cache_read_input_tokens ?? 0,
      },
      timestamp: new Date().toISOString(),
    }

    const { error } = await serviceClient.from('api_costs').insert({
      user_id: params.userId,
      service: 'anthropic',
      cost_usd: params.costUsd,
      metadata,
    })

    if (error) {
      if (isMissingDbObjectError(error)) {
        console.warn('[predict-patterns] api_costs table/function missing after ensure; skipping cost persistence')
        return
      }

      console.error('[predict-patterns] Cost tracking failed:', {
        code: error.code,
        message: error.message,
      })
    }
  } catch (error) {
    console.error('[predict-patterns] Cost tracking exception:', sanitizeErrorForLog(error))
    captureApiException(error, { route: '/api/predict-patterns', method: 'GET' })
  }
}

async function ensureApiCostsTableExists(serviceClient: Awaited<ReturnType<typeof createServiceRoleClient>>) {
  try {
    const probe = await serviceClient.from('api_costs').select('id').limit(1)
    if (!probe.error) return true

    if (!isMissingDbObjectError(probe.error)) {
      console.error('[predict-patterns] api_costs probe failed:', {
        code: probe.error.code,
        message: probe.error.message,
      })
      return false
    }

    const createSql = `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE TABLE IF NOT EXISTS public.api_costs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        service VARCHAR(50) NOT NULL CHECK (service IN ('anthropic', 'abstract', 'clearbit', 'other')),
        cost_usd DECIMAL(10, 6) NOT NULL CHECK (cost_usd >= 0),
        metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_api_costs_user ON public.api_costs(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_api_costs_service ON public.api_costs(service, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_api_costs_date ON public.api_costs(created_at DESC);
    `

    const rpcNames = ['execute_sql', 'exec_sql', 'run_sql', 'sql']
    for (const rpcName of rpcNames) {
      const { error } = await (serviceClient as any).rpc(rpcName, { sql: createSql })
      if (!error) {
        console.warn('[predict-patterns] api_costs created via SQL RPC:', rpcName)
        return true
      }
    }

    console.warn('[predict-patterns] api_costs is missing and no SQL RPC is available to auto-create it')
    return false
  } catch (error) {
    console.error('[predict-patterns] api_costs ensure exception:', sanitizeErrorForLog(error))
    captureApiException(error, { route: '/api/predict-patterns', method: 'GET' })
    return false
  }
}

function estimateCompanySize(domain: string, company: string): EstimatedCompanySize {
  const lowerDomain = domain.toLowerCase()
  const lowerCompany = company.toLowerCase()

  if (lowerDomain.endsWith('.io') || lowerDomain.endsWith('.ai')) {
    return 'startup'
  }

  if (/\b(startup|labs|studio|ventures)\b/i.test(lowerCompany)) {
    return 'startup'
  }

  if (/\b(inc|corp|corporation|llc|plc|ltd|limited|group|holdings)\b/i.test(lowerCompany)) {
    return 'enterprise'
  }

  return 'medium'
}

function heuristicFallbackPatterns(params: {
  estimatedSize: EstimatedCompanySize
  role: string | null
  domain: string
  company: string
  industry: string | null
}): PatternPredictionResult {
  let patterns: PatternPrediction[]

  if (params.estimatedSize === 'enterprise') {
    patterns = [
      { template: 'first.last', confidence: 0.30 },
      { template: 'flast', confidence: 0.18 },
      { template: 'firstlast', confidence: 0.12 },
      { template: 'first', confidence: 0.10 },
      { template: 'last.first', confidence: 0.09 },
      { template: 'lastfirst', confidence: 0.08 },
      { template: 'first_last', confidence: 0.07 },
      { template: 'f.last', confidence: 0.06 },
    ]
  } else if (params.estimatedSize === 'startup') {
    patterns = [
      { template: 'first', confidence: 0.30 },
      { template: 'first.last', confidence: 0.18 },
      { template: 'flast', confidence: 0.13 },
      { template: 'firstlast', confidence: 0.10 },
      { template: 'f.last', confidence: 0.09 },
      { template: 'last.first', confidence: 0.08 },
      { template: 'first_last', confidence: 0.07 },
      { template: 'lastfirst', confidence: 0.05 },
    ]
  } else {
    patterns = [
      { template: 'flast', confidence: 0.25 },
      { template: 'first.last', confidence: 0.22 },
      { template: 'firstlast', confidence: 0.13 },
      { template: 'first', confidence: 0.12 },
      { template: 'last.first', confidence: 0.09 },
      { template: 'lastfirst', confidence: 0.08 },
      { template: 'first_last', confidence: 0.06 },
      { template: 'f.last', confidence: 0.05 },
    ]
  }

  if (params.role && /\b(ceo|cto|cfo|coo|founder|president|vp|chief)\b/i.test(params.role)) {
    patterns = boostExecutiveSimplePatterns(patterns)
  }

  return {
    patterns,
    reasoning: `Heuristic fallback applied using company size (${params.estimatedSize})${
      params.role ? ` and role (${params.role})` : ''
    } because model output was unavailable.`,
  }
}

function boostExecutiveSimplePatterns(patterns: PatternPrediction[]): PatternPrediction[] {
  const adjusted = patterns.map((p) => ({ ...p }))

  for (const item of adjusted) {
    if (item.template === 'first' || item.template === 'firstlast') {
      item.confidence += 0.1
    } else {
      item.confidence -= 0.05
    }
  }

  return normalizePatternConfidences(adjusted)
}

function parsePredictionJson(rawText: string): PatternPredictionResult {
  const jsonText = extractJsonPayload(rawText)

  let parsed: any
  try {
    parsed = JSON.parse(jsonText)
  } catch (error) {
    throw new Error(
      `Claude returned non-JSON content: ${error instanceof Error ? error.message : 'Parse failure'}`
    )
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Claude JSON payload is not an object')
  }

  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning.trim() : 'No reasoning provided'
  const rawPatterns: unknown[] = Array.isArray(parsed.patterns) ? parsed.patterns : []

  const patterns = rawPatterns
    .map((item: unknown): PatternPrediction | null => {
      if (!item || typeof item !== 'object') return null

      const templateRaw =
        typeof (item as { template?: unknown }).template === 'string'
          ? (item as { template: string }).template.trim()
          : ''
      if (!templateRaw) return null

      const template = sanitizeTemplate(templateRaw)
      if (!template) return null

      let confidence = Number((item as { confidence?: unknown }).confidence)
      if (!Number.isFinite(confidence)) return null

      // Allow either 0..1 or 0..100 and normalize to 0..1.
      if (confidence > 1 && confidence <= 100) {
        confidence = confidence / 100
      }

      confidence = clamp(confidence, 0, 1)
      return { template, confidence: roundToTwo(confidence) }
    })
    .filter((value: PatternPrediction | null): value is PatternPrediction => Boolean(value))
    .sort((a: PatternPrediction, b: PatternPrediction) => b.confidence - a.confidence)
    .slice(0, 8)

  if (patterns.length === 0) {
    throw new Error('Claude JSON did not contain valid pattern predictions')
  }

  return {
    patterns: normalizePatternConfidences(patterns),
    reasoning,
  }
}

function extractJsonPayload(rawText: string): string {
  const trimmed = rawText.trim()
  if (!trimmed) {
    throw new Error('Claude response was empty')
  }

  const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = codeFenceMatch?.[1]?.trim() || trimmed

  if (candidate.startsWith('{') && candidate.endsWith('}')) {
    return candidate
  }

  const firstBrace = candidate.indexOf('{')
  const lastBrace = candidate.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return candidate.slice(firstBrace, lastBrace + 1)
  }

  throw new Error('No JSON object found in Claude response')
}

function extractTextContent(content: Array<{ type: string; text?: string }>): string {
  if (!Array.isArray(content)) return ''

  return content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text || '')
    .join('\n')
    .trim()
}

function normalizePatternConfidences(patterns: PatternPrediction[]): PatternPrediction[] {
  const total = patterns.reduce((sum, item) => sum + item.confidence, 0)
  if (total <= 0) return patterns

  return patterns.map((item) => ({
    template: item.template,
    confidence: roundToTwo(item.confidence / total),
  }))
}

function calculateCostUsd(usage: AnthropicUsage | null): number {
  if (!usage) return 0

  const inputTokens = usage.input_tokens ?? 0
  const outputTokens = usage.output_tokens ?? 0
  const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0

  const cost =
    (inputTokens / 1_000_000) * PRICING_USD_PER_1M.input +
    (outputTokens / 1_000_000) * PRICING_USD_PER_1M.output +
    (cacheCreationTokens / 1_000_000) * PRICING_USD_PER_1M.cacheWrite +
    (cacheReadTokens / 1_000_000) * PRICING_USD_PER_1M.cacheRead

  return roundToSix(Math.max(0, cost))
}

function isRateLimitError(error: unknown): boolean {
  const status = (error as { status?: number })?.status
  const message = (error as { message?: string })?.message || ''
  return status === 429 || /rate[\s-]?limit/i.test(message)
}

function isMissingDbObjectError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  return code === '42P01' || code === 'PGRST202' || code === '42883'
}

function sanitizeTemplate(template: string): string | null {
  const cleaned = template.toLowerCase().replace(/\s+/g, '').replace(/[^a-z._-]/g, '')
  if (!cleaned) return null
  if (cleaned.length < 2 || cleaned.length > 30) return null
  return cleaned
}

function normalizeDomain(domain: string): string {
  let normalized = domain.trim().toLowerCase()
  normalized = normalized.replace(/^https?:\/\//, '')
  normalized = normalized.replace(/^www\./, '')

  const withoutPath = normalized.split('/')[0]
  if (!withoutPath) return ''
  normalized = withoutPath

  const withoutQuery = normalized.split('?')[0]
  if (!withoutQuery) return ''
  normalized = withoutQuery

  const withoutFragment = normalized.split('#')[0]
  if (!withoutFragment) return ''
  normalized = withoutFragment

  return normalized
}

function normalizeCompanyName(company: string): string {
  return company.trim().replace(/\s+/g, ' ')
}

function normalizeOptionalField(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized.length > 0 ? normalized : null
}

function toSafeInt(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100
}

function roundToSix(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function sanitizeErrorForLog(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  if (typeof error === 'object' && error !== null) {
    const safe: Record<string, unknown> = {}
    const entries = Object.entries(error as Record<string, unknown>)
    for (const [key, value] of entries) {
      if (/key|token|authorization|secret/i.test(key)) continue
      safe[key] = value
    }
    return safe
  }

  return { message: String(error) }
}
