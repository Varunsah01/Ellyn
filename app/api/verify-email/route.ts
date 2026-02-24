import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/auth/helpers'
import { get as cacheGet, set as cacheSet } from '@/lib/cache/redis'
import { CACHE_TAGS, emailVerificationTag } from '@/lib/cache/tags'
import { captureApiException, withApiRouteSpan } from '@/lib/monitoring/sentry'
import { recordExternalApiUsage, timeOperation } from '@/lib/monitoring/performance'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { VerifyEmailSchema, formatZodError } from '@/lib/validation/schemas'
import { getDailyVerificationQuota } from '@/lib/verification-quota'

type VerifyEmailResponse = {
  email: string
  deliverable: boolean
  deliverability: string
  isValidFormat: boolean
  isCatchAll: boolean
  isFreeEmail: boolean
  smtpScore: number
}

type AbstractApiBooleanField = {
  value?: boolean | null
}

type AbstractApiResponse = {
  email?: string
  deliverability?: 'DELIVERABLE' | 'UNDELIVERABLE' | 'RISKY' | 'UNKNOWN' | string
  quality_score?: number | string | null
  is_valid_format?: AbstractApiBooleanField
  is_catchall_email?: AbstractApiBooleanField
  is_catch_all?: AbstractApiBooleanField
  is_free_email?: AbstractApiBooleanField
  is_smtp_valid?: AbstractApiBooleanField
}

type AbstractVerificationOutcome = {
  data: AbstractApiResponse | null
  warning: string | null
  statusCode: number | null
  billed: boolean
}

type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
  source: 'table' | 'api_costs_fallback' | 'none'
}

type ApiRateLimitRow = {
  user_id: string
  endpoint: string
  count: number
  window_start: string
}

const ABSTRACT_API_URL = 'https://emailvalidation.abstractapi.com/v1/'
const ABSTRACT_TIMEOUT_MS = 15_000
const VERIFY_EMAIL_COST_USD = 0.001
const RATE_LIMIT_MAX = 50
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const RATE_LIMIT_ENDPOINT = 'verify-email'

// ─── Verification cache ───────────────────────────────────────────────────────

/** 7 days — verification results are stable; Abstract themselves cache per address */
const VERIFICATION_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60

function buildVerificationCacheKey(email: string): string {
  // Keep the key human-readable in Redis; @ is valid in a KV key string
  return `email:verification:${email.trim().toLowerCase()}`
}

async function getCachedVerification(email: string): Promise<VerifyEmailResponse | null> {
  try {
    const result = await cacheGet<VerifyEmailResponse>(buildVerificationCacheKey(email))
    return result ?? null
  } catch (error) {
    // Cache read failure is non-fatal — fall through to API call
    console.warn('[verify-email] Cache read error:', sanitizeErrorForLog(error))
    return null
  }
}

async function setCachedVerification(email: string, result: VerifyEmailResponse): Promise<void> {
  try {
    await cacheSet(
      buildVerificationCacheKey(email),
      result,
      VERIFICATION_CACHE_TTL_SECONDS,
      { tags: [CACHE_TAGS.emailVerification, emailVerificationTag(email)] }
    )
  } catch (error) {
    // Cache write failure is non-fatal — the API result is still returned to the caller
    console.warn('[verify-email] Cache write error:', sanitizeErrorForLog(error))
  }
}

/**
 * Handle POST requests for `/api/verify-email`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the POST /api/verify-email request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/verify-email
 * fetch('/api/verify-email', { method: 'POST' })
 */
export async function POST(request: NextRequest) {
  let email = ''

  return withApiRouteSpan(
    'POST /api/verify-email',
    async () => {
      try {
        const user = await getAuthenticatedUser()
        let rawBody: unknown
        try {
          rawBody = await request.json()
        } catch {
          return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const parsed = VerifyEmailSchema.safeParse(rawBody)
        if (!parsed.success) {
          return NextResponse.json(
            { error: 'Validation failed', details: formatZodError(parsed.error) },
            { status: 400 }
          )
        }
        email = parsed.data.email

        // ── Cache check (before quota/rate-limit so hits consume neither) ───
        const cachedResult = await getCachedVerification(email)
        if (cachedResult) {
          console.log(`[verify-email] Cache hit: ${email}`)
          // Fire-and-forget: log the cache hit with $0 cost for hit-rate tracking
          void trackVerificationCost({
            userId: user.id,
            email,
            costUsd: 0,
            abstractStatus: null,
            deliverability: cachedResult.deliverable ? 'DELIVERABLE' : null,
            source: 'cache',
            warning: null,
          })
          return NextResponse.json({
            ...cachedResult,
            cached: true,
            rateLimit: {
              remaining: RATE_LIMIT_MAX,
              limit: RATE_LIMIT_MAX,
              source: 'cache' as const,
            },
          })
        }
        console.log(`[verify-email] Cache miss: ${email}`)

        // ── Daily verification quota (only applies to real API calls) ────────
        const quota = await getDailyVerificationQuota(user.id)
        if (!quota.allowed) {
          return NextResponse.json(
            {
              error: 'quota_exceeded',
              feature: 'email_verification',
              used: quota.used,
              limit: quota.limit,
              plan_type: quota.planType,
              reset_at: quota.resetAt,
              upgrade_url: '/dashboard/upgrade',
            },
            { status: 402 }
          )
        }

        const rateLimit = await checkAndIncrementRateLimit(user.id)
        if (!rateLimit.allowed) {
          return NextResponse.json(
            {
              error: 'Rate limit exceeded. Max 50 verifications per hour.',
              retryAfter: rateLimit.retryAfterSeconds,
            },
            {
              status: 429,
              headers: {
                'Retry-After': String(rateLimit.retryAfterSeconds),
              },
            }
          )
        }

        const apiKey = process.env.ABSTRACT_API_KEY?.trim()
        const fallback = buildFallbackResponse(email)

        if (!apiKey) {
          console.error('[verify-email] ABSTRACT_API_KEY is not configured')
          return NextResponse.json({
            ...fallback,
            warning: 'Email verification service is not configured. Returned partial data.',
            rateLimit: {
              remaining: rateLimit.remaining,
              limit: RATE_LIMIT_MAX,
              source: rateLimit.source,
            },
          })
        }

        const abstractResult = await requestAbstractVerification(email, apiKey)
        const mappedResult = abstractResult.data
          ? mapAbstractResponseToOutput(email, abstractResult.data)
          : fallback

        // Only cache real API responses, never fallback/error responses
        if (abstractResult.data) {
          await setCachedVerification(email, mappedResult)
        }

        await trackVerificationCost({
          userId: user.id,
          email,
          costUsd: abstractResult.billed ? VERIFY_EMAIL_COST_USD : 0,
          abstractStatus: abstractResult.statusCode,
          deliverability: abstractResult.data?.deliverability ?? null,
          source: abstractResult.data ? 'abstract' : 'fallback',
          warning: abstractResult.warning,
        })

        return NextResponse.json({
          ...mappedResult,
          cached: false,
          rateLimit: {
            remaining: rateLimit.remaining,
            limit: RATE_LIMIT_MAX,
            source: rateLimit.source,
          },
          ...(abstractResult.warning ? { warning: abstractResult.warning } : {}),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        if (message === 'Unauthorized') {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        if (error instanceof SyntaxError || message === 'Invalid JSON body') {
          return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        console.error('[verify-email] Internal error:', sanitizeErrorForLog(error))
        captureApiException(error, { route: '/api/verify-email', method: 'POST' })

        if (email) {
          return NextResponse.json({
            ...buildFallbackResponse(email),
            warning: 'Verification failed. Returned partial data.',
          })
        }

        return NextResponse.json({ error: 'Failed to verify email' }, { status: 500 })
      }
    },
    {
      'api.route': '/api/verify-email',
      'api.method': 'POST',
    }
  )
}

/**
 * Handle GET requests for `/api/verify-email`.
 * @returns {unknown} JSON response for the GET /api/verify-email request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/verify-email
 * fetch('/api/verify-email')
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}

async function requestAbstractVerification(
  email: string,
  apiKey: string
): Promise<AbstractVerificationOutcome> {
  const startedAt = Date.now()
  const url = `${ABSTRACT_API_URL}?${new URLSearchParams({
    api_key: apiKey,
    email,
  }).toString()}`

  try {
    const response = await timeOperation(
      'abstract.verify-email.fetch',
      async () => await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(ABSTRACT_TIMEOUT_MS),
        cache: 'no-store',
      }),
      {
        slowThresholdMs: 500,
        context: {
          route: '/api/verify-email',
        },
      }
    )

    if (response.ok) {
      const data = (await response.json()) as AbstractApiResponse
      recordExternalApiUsage({
        service: 'abstract',
        operation: 'email-verification',
        costUsd: VERIFY_EMAIL_COST_USD,
        durationMs: Date.now() - startedAt,
        statusCode: response.status,
        success: true,
      })
      return {
        data,
        warning: null,
        statusCode: response.status,
        billed: true,
      }
    }

    let warning = 'Verification provider returned an error. Returned partial data.'
    if (response.status === 429) {
      warning = 'Verification provider rate-limited this request. Returned partial data.'
    } else if (response.status >= 500) {
      warning = 'Verification provider is temporarily unavailable. Returned partial data.'
    }

    const errorPayload = await safeReadResponseBody(response)
    console.error('[verify-email] Abstract API non-200 response:', {
      status: response.status,
      body: errorPayload,
    })

    recordExternalApiUsage({
      service: 'abstract',
      operation: 'email-verification',
      costUsd: VERIFY_EMAIL_COST_USD,
      durationMs: Date.now() - startedAt,
      statusCode: response.status,
      success: false,
    })

    return {
      data: null,
      warning,
      statusCode: response.status,
      billed: true,
    }
  } catch (error) {
    const warning = isTimeoutError(error)
      ? 'Verification request timed out. Returned partial data.'
      : 'Verification request failed. Returned partial data.'

    console.error('[verify-email] Abstract API request failed:', sanitizeErrorForLog(error))
    captureApiException(error, {
      route: '/api/verify-email',
      method: 'POST',
      tags: {
        stage: 'abstract_request',
      },
      extras: {
        email,
      },
    })

    const statusCode = Number((error as { status?: number })?.status)
    recordExternalApiUsage({
      service: 'abstract',
      operation: 'email-verification',
      costUsd: 0,
      durationMs: Date.now() - startedAt,
      statusCode: Number.isFinite(statusCode) ? statusCode : 500,
      success: false,
    })

    return {
      data: null,
      warning,
      statusCode: null,
      billed: false,
    }
  }
}

function mapAbstractResponseToOutput(email: string, data: AbstractApiResponse): VerifyEmailResponse {
  const deliverability = String(data.deliverability || '').toUpperCase()
  const isValidFormat = toBoolean(data.is_valid_format?.value, isLikelyEmail(email))
  const isCatchAll = toBoolean(
    data.is_catchall_email?.value ?? data.is_catch_all?.value,
    false
  )
  const isFreeEmail = toBoolean(data.is_free_email?.value, isKnownFreeEmailProvider(email))
  const smtpScore = parseSmtpScore(data)

  return {
    email,
    deliverable: deliverability === 'DELIVERABLE',
    deliverability,
    isValidFormat,
    isCatchAll,
    isFreeEmail,
    smtpScore,
  }
}

function buildFallbackResponse(email: string): VerifyEmailResponse {
  return {
    email,
    deliverable: false,
    deliverability: 'UNKNOWN',
    isValidFormat: isLikelyEmail(email),
    isCatchAll: false,
    isFreeEmail: isKnownFreeEmailProvider(email),
    smtpScore: 0,
  }
}

async function checkAndIncrementRateLimit(userId: string): Promise<RateLimitResult> {
  const serviceClient = await createServiceRoleClient()
  const tableReady = await ensureRateLimitTableExists(serviceClient)

  if (!tableReady) {
    return checkRateLimitViaApiCosts(serviceClient, userId)
  }

  const now = new Date()
  const nowIso = now.toISOString()

  const { data, error } = await serviceClient
    .from('api_rate_limits')
    .select('user_id, endpoint, count, window_start')
    .eq('user_id', userId)
    .eq('endpoint', RATE_LIMIT_ENDPOINT)
    .maybeSingle<ApiRateLimitRow>()

  if (error && !isNoRowsError(error)) {
    console.error('[verify-email] Rate limit read failed:', {
      code: error.code,
      message: error.message,
    })
    return checkRateLimitViaApiCosts(serviceClient, userId)
  }

  if (!data) {
    const { error: insertError } = await serviceClient.from('api_rate_limits').insert({
      user_id: userId,
      endpoint: RATE_LIMIT_ENDPOINT,
      count: 1,
      window_start: nowIso,
      updated_at: nowIso,
    })

    if (insertError) {
      console.error('[verify-email] Rate limit insert failed:', {
        code: insertError.code,
        message: insertError.message,
      })
      return checkRateLimitViaApiCosts(serviceClient, userId)
    }

    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
      retryAfterSeconds: 0,
      source: 'table',
    }
  }

  const currentCount = toSafeInt(data.count, 0)
  const windowStart = new Date(data.window_start)

  if (!Number.isFinite(windowStart.getTime()) || now.getTime() - windowStart.getTime() >= RATE_LIMIT_WINDOW_MS) {
    const { error: resetError } = await serviceClient
      .from('api_rate_limits')
      .update({
        count: 1,
        window_start: nowIso,
        updated_at: nowIso,
      })
      .eq('user_id', userId)
      .eq('endpoint', RATE_LIMIT_ENDPOINT)

    if (resetError) {
      console.error('[verify-email] Rate limit reset failed:', {
        code: resetError.code,
        message: resetError.message,
      })
      return checkRateLimitViaApiCosts(serviceClient, userId)
    }

    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
      retryAfterSeconds: 0,
      source: 'table',
    }
  }

  if (currentCount >= RATE_LIMIT_MAX) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowStart.getTime() + RATE_LIMIT_WINDOW_MS - now.getTime()) / 1000)
    )

    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
      source: 'table',
    }
  }

  const nextCount = currentCount + 1
  const { error: updateError } = await serviceClient
    .from('api_rate_limits')
    .update({
      count: nextCount,
      updated_at: nowIso,
    })
    .eq('user_id', userId)
    .eq('endpoint', RATE_LIMIT_ENDPOINT)

  if (updateError) {
    console.error('[verify-email] Rate limit increment failed:', {
      code: updateError.code,
      message: updateError.message,
    })
    return checkRateLimitViaApiCosts(serviceClient, userId)
  }

  return {
    allowed: true,
    remaining: Math.max(0, RATE_LIMIT_MAX - nextCount),
    retryAfterSeconds: 0,
    source: 'table',
  }
}

async function checkRateLimitViaApiCosts(
  serviceClient: Awaited<ReturnType<typeof createServiceRoleClient>>,
  userId: string
): Promise<RateLimitResult> {
  try {
    const windowStartIso = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
    const countQuery = await serviceClient
      .from('api_costs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('service', 'abstract')
      .gte('created_at', windowStartIso)
      .contains('metadata', { endpoint: RATE_LIMIT_ENDPOINT })

    if (countQuery.error) {
      if (!isMissingDbObjectError(countQuery.error)) {
        console.error('[verify-email] Fallback rate limit count failed:', {
          code: countQuery.error.code,
          message: countQuery.error.message,
        })
      }
      return {
        allowed: true,
        remaining: RATE_LIMIT_MAX - 1,
        retryAfterSeconds: 0,
        source: 'none',
      }
    }

    const count = countQuery.count ?? 0
    if (count >= RATE_LIMIT_MAX) {
      const firstInWindow = await serviceClient
        .from('api_costs')
        .select('created_at')
        .eq('user_id', userId)
        .eq('service', 'abstract')
        .gte('created_at', windowStartIso)
        .contains('metadata', { endpoint: RATE_LIMIT_ENDPOINT })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle<{ created_at: string }>()

      let retryAfterSeconds = 60
      if (firstInWindow.data?.created_at) {
        const firstTime = new Date(firstInWindow.data.created_at).getTime()
        if (Number.isFinite(firstTime)) {
          retryAfterSeconds = Math.max(
            1,
            Math.ceil((firstTime + RATE_LIMIT_WINDOW_MS - Date.now()) / 1000)
          )
        }
      }

      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
        source: 'api_costs_fallback',
      }
    }

    return {
      allowed: true,
      remaining: Math.max(0, RATE_LIMIT_MAX - (count + 1)),
      retryAfterSeconds: 0,
      source: 'api_costs_fallback',
    }
  } catch (error) {
    console.error('[verify-email] Fallback rate limit exception:', sanitizeErrorForLog(error))
    captureApiException(error, {
      route: '/api/verify-email',
      method: 'POST',
      tags: {
        stage: 'fallback_rate_limit',
      },
      extras: {
        userId,
      },
    })
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
      retryAfterSeconds: 0,
      source: 'none',
    }
  }
}

async function trackVerificationCost(params: {
  userId: string
  email: string
  costUsd: number
  abstractStatus: number | null
  deliverability: string | null
  /** 'abstract' = live API call ($0.001); 'cache' = served from cache ($0); 'fallback' = API error */
  source: 'abstract' | 'fallback' | 'cache'
  warning: string | null
}) {
  try {
    const serviceClient = await createServiceRoleClient()
    const tableReady = await ensureApiCostsTableExists(serviceClient)
    if (!tableReady) return

    const domain = params.email.split('@')[1]?.toLowerCase() ?? 'unknown'

    const { error } = await serviceClient.from('api_costs').insert({
      user_id: params.userId,
      service: 'abstract',
      cost_usd: roundToSix(Math.max(0, params.costUsd)),
      metadata: {
        endpoint: RATE_LIMIT_ENDPOINT,
        email: params.email,
        domain,
        providerStatus: params.abstractStatus,
        deliverability: params.deliverability,
        source: params.source,
        warning: params.warning,
        costModel: '$0.001 per verification',
        timestamp: new Date().toISOString(),
      },
    })

    if (error) {
      if (!isMissingDbObjectError(error)) {
        console.error('[verify-email] Failed to insert api_costs row:', {
          code: error.code,
          message: error.message,
        })
      }
    }
  } catch (error) {
    console.error('[verify-email] Cost tracking exception:', sanitizeErrorForLog(error))
    captureApiException(error, {
      route: '/api/verify-email',
      method: 'POST',
      tags: {
        stage: 'track_verification_cost',
      },
      extras: {
        userId: params.userId,
        email: params.email,
      },
    })
  }
}

async function ensureRateLimitTableExists(
  serviceClient: Awaited<ReturnType<typeof createServiceRoleClient>>
): Promise<boolean> {
  try {
    const probe = await serviceClient.from('api_rate_limits').select('user_id').limit(1)
    if (!probe.error) return true

    if (!isMissingDbObjectError(probe.error)) {
      console.error('[verify-email] api_rate_limits probe failed:', {
        code: probe.error.code,
        message: probe.error.message,
      })
      return false
    }

    const createSql = `
      CREATE TABLE IF NOT EXISTS public.api_rate_limits (
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
        window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, endpoint)
      );
      CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window
        ON public.api_rate_limits(endpoint, window_start);
    `

    const rpcNames = ['execute_sql', 'exec_sql', 'run_sql', 'sql']
    for (const rpcName of rpcNames) {
      const { error } = await (serviceClient as any).rpc(rpcName, { sql: createSql })
      if (!error) {
        console.warn('[verify-email] api_rate_limits created via SQL RPC:', rpcName)
        return true
      }
    }

    console.warn('[verify-email] api_rate_limits missing and SQL RPC unavailable')
    return false
  } catch (error) {
    console.error('[verify-email] ensureRateLimitTableExists exception:', sanitizeErrorForLog(error))
    captureApiException(error, {
      route: '/api/verify-email',
      method: 'POST',
      tags: {
        stage: 'ensure_rate_limit_table',
      },
    })
    return false
  }
}

async function ensureApiCostsTableExists(
  serviceClient: Awaited<ReturnType<typeof createServiceRoleClient>>
): Promise<boolean> {
  try {
    const probe = await serviceClient.from('api_costs').select('id').limit(1)
    if (!probe.error) return true

    if (!isMissingDbObjectError(probe.error)) {
      console.error('[verify-email] api_costs probe failed:', {
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
        console.warn('[verify-email] api_costs created via SQL RPC:', rpcName)
        return true
      }
    }

    console.warn('[verify-email] api_costs missing and SQL RPC unavailable')
    return false
  } catch (error) {
    console.error('[verify-email] ensureApiCostsTableExists exception:', sanitizeErrorForLog(error))
    captureApiException(error, {
      route: '/api/verify-email',
      method: 'POST',
      tags: {
        stage: 'ensure_api_costs_table',
      },
    })
    return false
  }
}

async function safeReadResponseBody(response: Response): Promise<string> {
  try {
    const asJson = await response.clone().json()
    return JSON.stringify(asJson).slice(0, 1000)
  } catch {
    try {
      return (await response.text()).slice(0, 1000)
    } catch {
      return ''
    }
  }
}

function parseSmtpScore(data: AbstractApiResponse): number {
  const qualityScoreRaw = Number(data.quality_score)
  if (Number.isFinite(qualityScoreRaw)) {
    const normalized = qualityScoreRaw > 1 ? qualityScoreRaw / 100 : qualityScoreRaw
    return roundToThree(clamp(normalized, 0, 1))
  }

  const smtpValid = toBoolean(data.is_smtp_valid?.value, false)
  return smtpValid ? 1 : 0
}

function isLikelyEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isKnownFreeEmailProvider(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false

  const freeDomains = new Set([
    'gmail.com',
    'yahoo.com',
    'outlook.com',
    'hotmail.com',
    'icloud.com',
    'aol.com',
    'proton.me',
    'protonmail.com',
    'live.com',
    'msn.com',
  ])

  return freeDomains.has(domain)
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  return fallback
}

function toSafeInt(value: unknown, fallback: number): number {
  const asNumber = Number(value)
  return Number.isFinite(asNumber) ? Math.max(0, Math.trunc(asNumber)) : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundToThree(value: number): number {
  return Math.round(value * 1000) / 1000
}

function roundToSix(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'TimeoutError' || error.name === 'AbortError'
  }

  if (error instanceof Error) {
    return /timeout|aborted/i.test(error.message)
  }

  return false
}

function isNoRowsError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  return code === 'PGRST116'
}

function isMissingDbObjectError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  return code === '42P01' || code === 'PGRST202' || code === '42883'
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
      if (/key|token|authorization|secret/i.test(key)) continue
      safe[key] = value
    }
    return safe
  }

  return { message: String(error) }
}
