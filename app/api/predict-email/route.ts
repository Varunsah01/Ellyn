import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

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
import { applyLearnedBoosts, getLearnedPatterns } from '@/lib/pattern-learning'
import { createServiceRoleClient } from '@/lib/supabase/server'

interface PredictEmailRequest {
  firstName: string
  lastName: string
  companyName: string
  companyDomain: string
  role?: string
  linkedinUrl?: string
}

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
}

type AnthropicUsage = {
  input_tokens: number | null
  output_tokens: number
  cache_creation_input_tokens: number | null
  cache_read_input_tokens: number | null
}

type ParsedAiPayload = {
  prediction: AIEmailPredictionResponse
  warnings: string[]
}

const ANTHROPIC_MODEL = 'claude-3-5-haiku-20241022'
const MAX_TOKENS = 1500
const RATE_LIMIT = 50
const RATE_WINDOW_MS = 60 * 60 * 1000

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export async function POST(request: NextRequest): Promise<NextResponse<PredictEmailResponse>> {
  const startedAt = Date.now()

  try {
    const user = await getAuthenticatedUserFromRequest(request)

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

    const body = (await request.json()) as Partial<PredictEmailRequest>

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

    const resolvedCompanyName = companyName || companyDomain.split('.')[0]
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

    console.log('[AI][predict-email] Calling Claude', {
      userId: user.id,
      companyDomain,
      companySize,
      provider: emailProvider.provider,
      hasHistoricalData: historicalPatterns.length > 0,
    })

    const anthropic = getAnthropicClient()
    const modelStartedAt = Date.now()

    const message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.3,
      system: [
        {
          type: 'text',
          text: EMAIL_PREDICTION_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
      metadata: {
        user_id: user.id,
      },
    })

    const aiLatencyMs = Date.now() - modelStartedAt
    const rawText = extractTextContent(message.content)
    const parsed = parseAiResponse(rawText, firstName, lastName, companyDomain)

    let patterns = parsed.prediction.patterns

    if (historicalPatterns.length > 0) {
      patterns = applyLearnedBoosts(patterns, learnedRows).map((pattern) => ({
        email: String(pattern.email || '').toLowerCase(),
        pattern: String(pattern.pattern || '').toLowerCase(),
        confidence: clampInt(pattern.confidence, 10, 95),
        reasoning: findReasoning(parsed.prediction.patterns, String(pattern.pattern || '').toLowerCase()),
      }))
    }

    patterns = dedupeAndSortPatterns(patterns).slice(0, 6)

    if (patterns.length < 4) {
      patterns = ensureMinimumPatterns(patterns, firstName, lastName, companyDomain)
    }

    const prediction: AIEmailPredictionResponse = {
      patterns,
      topRecommendation: patterns[0]?.email || '',
      recommendationReasoning:
        parsed.prediction.recommendationReasoning ||
        'Top recommendation selected from ranked pattern confidence.',
    }

    const usage = {
      input_tokens: message.usage?.input_tokens ?? 0,
      output_tokens: message.usage?.output_tokens ?? 0,
      cache_creation_input_tokens: message.usage?.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: message.usage?.cache_read_input_tokens ?? 0,
    }

    const estimatedCost = calculateCost(usage)

    await logPrediction({
      userId: user.id,
      companyDomain,
      topPattern: patterns[0]?.pattern || 'unknown',
      aiLatencyMs,
      usage,
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
        model: ANTHROPIC_MODEL,
      },
      debug: {
        tokensUsed: {
          inputTokens: usage.input_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
          cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
          cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
        },
        estimatedCost,
      },
      warnings: parsed.warnings,
    }

    console.log('[AI][predict-email] Completed', {
      userId: user.id,
      domain: companyDomain,
      aiLatencyMs,
      totalMs: Date.now() - startedAt,
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
}

export async function GET(): Promise<NextResponse<PredictEmailResponse>> {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed. Use POST.',
    },
    { status: 405 }
  )
}

let anthropicClient: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (anthropicClient) {
    return anthropicClient
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  anthropicClient = new Anthropic({ apiKey })
  return anthropicClient
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
  const fallback = buildHeuristicPatterns(firstName, lastName, companyDomain)
  const combined = dedupeAndSortPatterns([...patterns, ...fallback])
  return combined.slice(0, 6)
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
    case 'flast':
      return `${f}${last}@${domain}`
    case 'first.l':
      return `${first}.${l}@${domain}`
    case 'f.last':
      return `${f}.${last}@${domain}`
    case 'first_last':
      return `${first}_${last}@${domain}`
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

function extractTextContent(content: Array<{ type: string; text?: string }>): string {
  if (!Array.isArray(content)) return ''

  return content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text || '')
    .join('\n')
    .trim()
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
  usage: AnthropicUsage
  estimatedCost: number
}): Promise<void> {
  try {
    const serviceClient = await createServiceRoleClient()

    const payload = {
      user_id: params.userId,
      company_domain: params.companyDomain,
      top_pattern: params.topPattern,
      ai_latency_ms: Math.max(0, Math.trunc(params.aiLatencyMs)),
      tokens_used: (params.usage.input_tokens ?? 0) + (params.usage.output_tokens ?? 0),
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
  }
}

function calculateCost(usage: AnthropicUsage): number {
  const input = Number(usage.input_tokens || 0)
  const output = Number(usage.output_tokens || 0)
  const inputCost = (input / 1_000_000) * 0.8
  const outputCost = (output / 1_000_000) * 4
  return roundToSix(inputCost + outputCost)
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

function roundToSix(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
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
