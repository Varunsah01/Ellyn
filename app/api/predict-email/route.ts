import { NextRequest, NextResponse } from 'next/server'

import { callLLMWithFallback, type LLMResponse } from '@/lib/llm-client'
import {
  EMAIL_PREDICTION_SYSTEM_PROMPT,
  buildPredictionUserMessage,
  type AIEmailPredictionResponse,
  type AIPredictedPattern,
  type EmailPredictionContext,
  type HistoricalPattern,
} from '@/lib/ai/email-prediction-prompt'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import {
  detectEmailProvider,
  detectIndustry,
  estimateCompanySize,
  type CompanySize,
} from '@/lib/company-intelligence'
import { normalizeDomain } from '@/lib/domain-utils'
import { verifyDomainMxRecords } from '@/lib/email-verification'
import {
  captureApiException,
  captureSlowApiRoute,
  withApiRouteSpan,
} from '@/lib/monitoring/sentry'
import { recordExternalApiUsage } from '@/lib/monitoring/performance'
import { applyLearnedBoosts, getLearnedPatterns } from '@/lib/pattern-learning'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { PredictEmailSchema, formatZodError } from '@/lib/validation/schemas'

interface PredictionMetadata {
  companySize: CompanySize
  emailProvider: string
  domainVerified: boolean
  hasHistoricalData: boolean
  historicalPatternCount: number
  aiLatencyMs: number
  model: string
}

interface PredictEmailResponse {
  success: boolean
  prediction?: AIEmailPredictionResponse
  metadata?: PredictionMetadata
  debug?: {
    tokensUsed: {
      inputTokens: number
      outputTokens: number
      cacheCreationInputTokens: number
      cacheReadInputTokens: number
    }
    estimatedCost: number
  }
  warnings?: string[]
  error?: string
  message?: string
  details?: Array<{ path: string; message: string; code: string }>
}

type ParsedAiPayload = {
  prediction: AIEmailPredictionResponse
  warnings: string[]
}

const MAX_TOKENS = 1500
const RATE_LIMIT = 50
const RATE_WINDOW_MS = 60 * 60 * 1000
const MIN_PATTERN_COUNT = 12
const MAX_PATTERN_COUNT = 15

const COMPLETE_PATTERN_ORDER: string[] = [
  'first.last',
  'flast',
  'firstlast',
  'first',
  'last.first',
  'f.last',
  'first_last',
  'lastfirst',
  'first.l',
  'firstl',
  'last',
  'first-last',
  'f_last',
  'last_first',
  'last.first',
]

const COMPLETE_PATTERN_CONFIDENCES: number[] = [
  0.30,
  0.18,
  0.12,
  0.10,
  0.08,
  0.07,
  0.06,
  0.05,
  0.04,
  0.03,
  0.025,
  0.02,
]

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

/**
 * Handle POST requests for `/api/predict-email`.
 * @param {NextRequest} request - Request input.
 * @returns {Promise<NextResponse<PredictEmailResponse>>} JSON response for the POST /api/predict-email request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/predict-email
 * fetch('/api/predict-email', { method: 'POST' })
 */
export async function POST(request: NextRequest): Promise<NextResponse<PredictEmailResponse>> {
  const startedAt = Date.now()
  let userId = ''

  return withApiRouteSpan(
    'POST /api/predict-email',
    async () => {
      try {
        const user = await getAuthenticatedUserFromRequest(request)
        userId = user.id

        const limiter = checkRateLimit(user.id)
        if (!limiter.allowed) {
          return NextResponse.json(
            {
              success: false,
              error: 'Rate limit exceeded. Try again later.',
            },
            {
              status: 429,
              headers: {
                'Retry-After': String(limiter.retryAfterSeconds),
              },
            }
          )
        }

        const validation = PredictEmailSchema.safeParse(await request.json())
        if (!validation.success) {
          return NextResponse.json(
            {
              success: false,
              error: 'Validation failed',
              details: formatZodError(validation.error),
            },
            { status: 400 }
          )
        }
        const body = validation.data

        const firstName = sanitizeName(body.firstName)
        const lastName = sanitizeName(body.lastName)
        const companyName = sanitizeText(body.companyName)
        const companyDomain = normalizeDomain(body.companyDomain || '')
        const role = sanitizeText(body.role)
        const linkedinUrl = sanitizeText(body.linkedinUrl)

        if (!firstName || !lastName || !companyDomain) {
          return NextResponse.json(
            {
              success: false,
              error: 'Missing required fields: firstName, lastName, companyDomain',
            },
            { status: 400 }
          )
        }

        if (!isLikelyDomain(companyDomain)) {
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid company domain.',
            },
            { status: 400 }
          )
        }

        const domainVerification = await verifyDomainMxRecords(companyDomain)
        if (!domainVerification.hasMxRecords) {
          return NextResponse.json(
            {
              success: false,
              error: 'Domain cannot receive emails.',
              message: domainVerification.error,
            },
            { status: 400 }
          )
        }

        const inferredCompanyName = companyDomain.split('.')[0] ?? ''
        const resolvedCompanyName = companyName || inferredCompanyName || companyDomain
        const companySize = estimateCompanySize(companyDomain, resolvedCompanyName)
        const industry = detectIndustry(resolvedCompanyName, companyDomain)
        const emailProvider = await detectEmailProvider(companyDomain)

        const learnedRows = await getLearnedPatterns(companyDomain)
        const historicalPatterns = mapHistoricalPatterns(learnedRows)

        const context: EmailPredictionContext = {
          firstName,
          lastName,
          companyName: resolvedCompanyName,
          companyDomain,
          role: role || undefined,
          companySize,
          industry,
          emailProvider: emailProvider.provider,
          historicalPatterns,
          linkedinUrl: linkedinUrl || undefined,
        }

        const userMessage = buildPredictionUserMessage(context)

        console.log('[AI][predict-email] Calling LLM', {
          userId: user.id,
          companyDomain,
          companySize,
          provider: emailProvider.provider,
          hasHistoricalData: historicalPatterns.length > 0,
        })

        const modelStartedAt = Date.now()
        let llmResponse: LLMResponse

        try {
          llmResponse = await callLLMWithFallback({
            systemPrompt: EMAIL_PREDICTION_SYSTEM_PROMPT,
            userPrompt: userMessage,
            maxTokens: MAX_TOKENS,
            temperature: 0.3,
            action: 'predict-email',
          })
          recordExternalApiUsage({
            service: llmResponse.provider,
            operation: `chat.completions:predict-email`,
            costUsd: llmResponse.costUsd,
            durationMs: Date.now() - modelStartedAt,
            statusCode: 200,
            success: true,
          })
        } catch (error) {
          recordExternalApiUsage({
            service: 'unknown',
            operation: 'chat.completions:predict-email',
            costUsd: 0,
            durationMs: Date.now() - modelStartedAt,
            statusCode: 500,
            success: false,
          })
          throw error
        }

        const aiLatencyMs = Date.now() - modelStartedAt
        const parsed = parseAiResponse(llmResponse.text, firstName, lastName, companyDomain)

        let patterns = parsed.prediction.patterns

        if (historicalPatterns.length > 0) {
          patterns = applyLearnedBoosts(patterns, learnedRows).map((pattern) => ({
            email: String(pattern.email || '').toLowerCase(),
            pattern: String(pattern.pattern || '').toLowerCase(),
            confidence: clampInt(pattern.confidence, 10, 95),
            reasoning: findReasoning(parsed.prediction.patterns, String(pattern.pattern || '').toLowerCase()),
          }))
        }

        patterns = ensureMinimumPatterns(patterns, firstName, lastName, companyDomain)

        const prediction: AIEmailPredictionResponse = {
          patterns,
          topRecommendation: patterns[0]?.email || '',
          recommendationReasoning:
            parsed.prediction.recommendationReasoning ||
            'Top recommendation selected from ranked pattern confidence.',
        }

        const estimatedCost = llmResponse.costUsd

        await logPrediction({
          userId: user.id,
          companyDomain,
          topPattern: patterns[0]?.pattern || 'unknown',
          aiLatencyMs,
          inputTokens: llmResponse.inputTokens,
          outputTokens: llmResponse.outputTokens,
          estimatedCost,
        })

        const response: PredictEmailResponse = {
          success: true,
          prediction,
          metadata: {
            companySize,
            emailProvider: emailProvider.providerName,
            domainVerified: domainVerification.hasMxRecords,
            hasHistoricalData: historicalPatterns.length > 0,
            historicalPatternCount: historicalPatterns.length,
            aiLatencyMs,
            model: llmResponse.model,
          },
          debug: {
            tokensUsed: {
              inputTokens: llmResponse.inputTokens,
              outputTokens: llmResponse.outputTokens,
              cacheCreationInputTokens: 0,
              cacheReadInputTokens: 0,
            },
            estimatedCost,
          },
          warnings: parsed.warnings,
        }

        const totalMs = Date.now() - startedAt
        captureSlowApiRoute('/api/predict-email', totalMs, {
          method: 'POST',
          thresholdMs: 2000,
        })

        console.log('[AI][predict-email] Completed', {
          userId: user.id,
          domain: companyDomain,
          aiLatencyMs,
          totalMs,
          topRecommendation: prediction.topRecommendation,
          cost: estimatedCost,
        })

        return NextResponse.json(response)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'

        if (message === 'Unauthorized') {
          return NextResponse.json(
            {
              success: false,
              error: 'Unauthorized',
            },
            { status: 401 }
          )
        }

        captureApiException(error, {
          route: '/api/predict-email',
          method: 'POST',
          userId,
        })
        console.error('[API][predict-email] Error:', sanitizeErrorForLog(error))

        return NextResponse.json(
          {
            success: false,
            error: 'Failed to predict email',
            message,
          },
          { status: 500 }
        )
      }
    },
    {
      'api.route': '/api/predict-email',
      'api.method': 'POST',
    }
  )
}

/**
 * Handle GET requests for `/api/predict-email`.
 * @returns {Promise<NextResponse<PredictEmailResponse>>} JSON response for the GET /api/predict-email request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/predict-email
 * fetch('/api/predict-email')
 */
export async function GET(): Promise<NextResponse<PredictEmailResponse>> {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed. Use POST.',
    },
    { status: 405 }
  )
}


function checkRateLimit(userId: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const current = rateLimitMap.get(userId)

  if (!current) {
    rateLimitMap.set(userId, {
      count: 1,
      resetTime: now + RATE_WINDOW_MS,
    })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (now >= current.resetTime) {
    rateLimitMap.set(userId, {
      count: 1,
      resetTime: now + RATE_WINDOW_MS,
    })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (current.count >= RATE_LIMIT) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetTime - now) / 1000)),
    }
  }

  current.count += 1
  rateLimitMap.set(userId, current)
  return { allowed: true, retryAfterSeconds: 0 }
}

function parseAiResponse(
  rawText: string,
  firstName: string,
  lastName: string,
  companyDomain: string
): ParsedAiPayload {
  const jsonPayload = extractJsonObject(rawText)

  let parsed: Partial<AIEmailPredictionResponse> | null = null
  const warnings: string[] = []

  try {
    parsed = JSON.parse(jsonPayload) as Partial<AIEmailPredictionResponse>
  } catch {
    warnings.push('Claude returned non-JSON payload; heuristic fallback patterns were added.')
  }

  const extractedPatterns = Array.isArray(parsed?.patterns)
    ? parsed?.patterns
    : []

  const normalizedPatterns: AIPredictedPattern[] = extractedPatterns
    .map((item) => normalizeAiPattern(item, firstName, lastName, companyDomain))
    .filter((item): item is AIPredictedPattern => Boolean(item))

  const patterns = normalizedPatterns.length > 0
    ? normalizedPatterns
    : buildHeuristicPatterns(firstName, lastName, companyDomain)

  if (normalizedPatterns.length === 0) {
    warnings.push('No valid AI patterns found; heuristic fallback patterns were used.')
  }

  const topRecommendation =
    typeof parsed?.topRecommendation === 'string' && parsed.topRecommendation.includes('@')
      ? parsed.topRecommendation.toLowerCase()
      : patterns[0]?.email || ''

  const recommendationReasoning =
    typeof parsed?.recommendationReasoning === 'string'
      ? parsed.recommendationReasoning.trim()
      : 'Top recommendation selected from confidence-ranked predictions.'

  return {
    prediction: {
      patterns,
      topRecommendation,
      recommendationReasoning,
    },
    warnings,
  }
}

function normalizeAiPattern(
  value: unknown,
  firstName: string,
  lastName: string,
  companyDomain: string
): AIPredictedPattern | null {
  if (!value || typeof value !== 'object') return null

  const source = value as Partial<AIPredictedPattern>

  const pattern = String(source.pattern || '').trim().toLowerCase()
  const rawEmail = String(source.email || '').trim().toLowerCase()
  const reasoning = String(source.reasoning || '').trim()

  let email = rawEmail
  if (!email || !email.includes('@')) {
    if (!pattern) return null
    email = applyPatternTemplate(pattern, firstName, lastName, companyDomain)
  }

  if (!isLikelyEmail(email)) return null

  const confidence = clampInt(source.confidence, 10, 95)

  return {
    email,
    pattern: pattern || inferPatternFromEmail(email, firstName, lastName),
    confidence,
    reasoning: reasoning || 'Pattern inferred from AI response.',
  }
}

function dedupeAndSortPatterns(patterns: AIPredictedPattern[]): AIPredictedPattern[] {
  const map = new Map<string, AIPredictedPattern>()

  for (const pattern of patterns) {
    const key = pattern.email.toLowerCase()
    const existing = map.get(key)

    if (!existing || existing.confidence < pattern.confidence) {
      map.set(key, pattern)
    }
  }

  return Array.from(map.values()).sort((a, b) => b.confidence - a.confidence)
}

function ensureMinimumPatterns(
  patterns: AIPredictedPattern[],
  firstName: string,
  lastName: string,
  companyDomain: string
): AIPredictedPattern[] {
  const base = dedupeAndSortPatterns(patterns)
  const withHeuristic = dedupeAndSortPatterns([
    ...base,
    ...buildHeuristicPatterns(firstName, lastName, companyDomain),
  ])

  const existingTemplates = new Set<string>(
    withHeuristic
      .map((pattern) => String(pattern.pattern || '').trim().toLowerCase())
      .filter(Boolean)
  )
  const seenFallbackTemplates = new Set<string>()
  const expanded = [...withHeuristic]

  for (let i = 0; i < COMPLETE_PATTERN_ORDER.length && expanded.length < MIN_PATTERN_COUNT; i++) {
    const template = String(COMPLETE_PATTERN_ORDER[i] || '').trim().toLowerCase()
    if (!template || seenFallbackTemplates.has(template)) continue
    seenFallbackTemplates.add(template)

    if (existingTemplates.has(template)) continue

    const email = applyPatternTemplate(template, firstName, lastName, companyDomain)
    if (!isLikelyEmail(email)) continue

    const confidence: number =
      (i < COMPLETE_PATTERN_CONFIDENCES.length
        ? COMPLETE_PATTERN_CONFIDENCES[i]
        : COMPLETE_PATTERN_CONFIDENCES[COMPLETE_PATTERN_CONFIDENCES.length - 1]) ?? 20

    expanded.push({
      email,
      pattern: template,
      confidence,
      reasoning: 'Fallback pattern added to ensure minimum ranked coverage.',
    })
    existingTemplates.add(template)
  }

  return expanded
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_PATTERN_COUNT)
}

function buildHeuristicPatterns(firstName: string, lastName: string, domain: string): AIPredictedPattern[] {
  const first = sanitizeName(firstName).toLowerCase()
  const last = sanitizeName(lastName).toLowerCase()
  const f = first.charAt(0)

  const candidates: AIPredictedPattern[] = [
    {
      email: `${first}.${last}@${domain}`,
      pattern: 'first.last',
      confidence: 72,
      reasoning: 'Most common enterprise pattern fallback.',
    },
    {
      email: `${first}${last}@${domain}`,
      pattern: 'firstlast',
      confidence: 58,
      reasoning: 'Common fallback pattern when delimiter is not used.',
    },
    {
      email: `${first}@${domain}`,
      pattern: 'first',
      confidence: 52,
      reasoning: 'Common at startups and smaller teams.',
    },
    {
      email: `${f}${last}@${domain}`,
      pattern: 'flast',
      confidence: 44,
      reasoning: 'Initial + lastname fallback pattern.',
    },
  ]

  return candidates.filter((candidate) => isLikelyEmail(candidate.email))
}

function applyPatternTemplate(pattern: string, firstName: string, lastName: string, domain: string): string {
  const first = sanitizeName(firstName).toLowerCase()
  const last = sanitizeName(lastName).toLowerCase()
  const f = first.charAt(0)
  const l = last.charAt(0)

  const normalizedPattern = pattern.trim().toLowerCase()

  switch (normalizedPattern) {
    case 'first.last':
      return `${first}.${last}@${domain}`
    case 'firstlast':
      return `${first}${last}@${domain}`
    case 'first':
      return `${first}@${domain}`
    case 'last':
      return `${last}@${domain}`
    case 'flast':
      return `${f}${last}@${domain}`
    case 'lastfirst':
      return `${last}${first}@${domain}`
    case 'first.l':
      return `${first}.${l}@${domain}`
    case 'f.last':
      return `${f}.${last}@${domain}`
    case 'last.first':
      return `${last}.${first}@${domain}`
    case 'first_last':
      return `${first}_${last}@${domain}`
    case 'last_first':
      return `${last}_${first}@${domain}`
    case 'first-last':
      return `${first}-${last}@${domain}`
    case 'f_last':
      return `${f}_${last}@${domain}`
    case 'firstl':
      return `${first}${l}@${domain}`
    default:
      return `${first}.${last}@${domain}`
  }
}

function inferPatternFromEmail(email: string, firstName: string, lastName: string): string {
  const local = email.split('@')[0]?.toLowerCase() || ''
  const first = sanitizeName(firstName).toLowerCase()
  const last = sanitizeName(lastName).toLowerCase()

  if (local === `${first}.${last}`) return 'first.last'
  if (local === `${first}${last}`) return 'firstlast'
  if (local === `${first}`) return 'first'
  if (local === `${first.charAt(0)}${last}`) return 'flast'
  if (local === `${first}_${last}`) return 'first_last'

  return 'unknown'
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return '{}'

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() || trimmed

  if (candidate.startsWith('{') && candidate.endsWith('}')) {
    return candidate
  }

  const firstBrace = candidate.indexOf('{')
  const lastBrace = candidate.lastIndexOf('}')

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return candidate.slice(firstBrace, lastBrace + 1)
  }

  return '{}'
}


function mapHistoricalPatterns(
  rows: Array<{
    pattern: string
    success_count: number
    failure_count: number
    confidence_boost: number
  }>
): HistoricalPattern[] {
  return rows.map((row) => ({
    pattern: String(row.pattern || '').toLowerCase(),
    successCount: Math.max(0, Number(row.success_count) || 0),
    failureCount: Math.max(0, Number(row.failure_count) || 0),
    confidenceBoost: Math.trunc(Number(row.confidence_boost) || 0),
  }))
}

async function logPrediction(params: {
  userId: string
  companyDomain: string
  topPattern: string
  aiLatencyMs: number
  inputTokens: number
  outputTokens: number
  estimatedCost: number
}): Promise<void> {
  try {
    const serviceClient = await createServiceRoleClient()

    const payload = {
      user_id: params.userId,
      company_domain: params.companyDomain,
      top_pattern: params.topPattern,
      ai_latency_ms: Math.max(0, Math.trunc(params.aiLatencyMs)),
      tokens_used: params.inputTokens + params.outputTokens,
      estimated_cost: params.estimatedCost,
      created_at: new Date().toISOString(),
    }

    const { error } = await serviceClient.from('api_predictions').insert(payload)

    if (error) {
      if (!isMissingDbObjectError(error)) {
        console.error('[API][predict-email] Failed to log prediction:', {
          code: error.code,
          message: error.message,
        })
      }
    }
  } catch (error) {
    console.error('[API][predict-email] logPrediction exception:', sanitizeErrorForLog(error))
    captureApiException(error, { route: '/api/predict-email', method: 'GET' })
  }
}


function sanitizeName(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^a-zA-Z\-\s']/g, '')
}

function sanitizeText(value: unknown): string {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function isLikelyDomain(domain: string): boolean {
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(domain)
}

function isLikelyEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function clampInt(value: unknown, min: number, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.round(n)))
}

function findReasoning(patterns: AIPredictedPattern[], patternType: string): string {
  const hit = patterns.find((pattern) => pattern.pattern === patternType)
  if (hit?.reasoning) return hit.reasoning
  return 'Confidence adjusted using historical domain feedback.'
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
    for (const [key, value] of Object.entries(error as Record<string, unknown>)) {
      if (/token|authorization|secret|key/i.test(key)) continue
      safe[key] = value
    }
    return safe
  }

  return { message: String(error) }
}

function isMissingDbObjectError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  return code === '42P01' || code === 'PGRST202' || code === '42883'
}
