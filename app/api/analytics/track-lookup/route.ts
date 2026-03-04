import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { invalidateUserAnalyticsCache } from '@/lib/cache/tags'
import { captureApiException } from '@/lib/monitoring/sentry'
import { checkApiRateLimit, rateLimitExceeded } from '@/lib/rate-limit'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { TrackLookupSchema, formatZodError } from '@/lib/validation/schemas'

import { isMissingDbObjectError, roundTo, sanitizeErrorForLog } from '../_helpers'

/**
 * Handle POST requests for `/api/analytics/track-lookup`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the POST /api/analytics/track-lookup request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/analytics/track-lookup
 * fetch('/api/analytics/track-lookup', { method: 'POST' })
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const rl = await checkApiRateLimit(`track-lookup:${user.id}`, 200, 3600)
    if (!rl.allowed) return rateLimitExceeded(rl.resetAt)

    const parsed = TrackLookupSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: formatZodError(parsed.error) },
        { status: 400 }
      )
    }
    const { profileUrl, domain, email, pattern, source, confidence, cacheHit, cost, duration, success } = parsed.data

    const normalizedProfileUrl = profileUrl || null
    const normalizedConfidence = toConfidence(confidence)
    const costUsd = roundTo(Math.max(0, Number(cost || 0)), 6)
    const durationMs = toDuration(duration)
    const normalizedSuccess = success !== false
    const normalizedCacheHit = cacheHit === true

    const serviceClient = await createServiceRoleClient()
    const { data, error } = await serviceClient
      .from('email_lookups')
      .insert({
        user_id: user.id,
        profile_url: normalizedProfileUrl,
        domain,
        email,
        pattern,
        confidence: normalizedConfidence,
        source,
        cache_hit: normalizedCacheHit,
        cost_usd: costUsd,
        duration_ms: durationMs,
        success: normalizedSuccess,
      })
      .select('id, created_at')
      .single()

    if (error) {
      console.error('[analytics/track-lookup] Insert failed:', {
        code: error.code,
        message: error.message,
      })
      return NextResponse.json(
        { success: false, error: 'Failed to track lookup' },
        { status: 500 }
      )
    }

    try {
      await invalidateUserAnalyticsCache(user.id)
    } catch (invalidateError) {
      console.warn('[analytics/track-lookup] Failed to invalidate user analytics cache:', {
        userId: user.id,
        error: invalidateError instanceof Error ? invalidateError.message : String(invalidateError),
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: data?.id || null,
        createdAt: data?.created_at ? new Date(data.created_at).toISOString() : new Date().toISOString(),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof SyntaxError || message === 'Invalid JSON body') {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }
    if (isMissingDbObjectError(error)) {
      return NextResponse.json(
        { success: false, error: 'Analytics schema is missing. Run migration 004_analytics_tracking.sql.' },
        { status: 503 }
      )
    }

    console.error('[analytics/track-lookup] Internal error:', sanitizeErrorForLog(error))
    captureApiException(error, { route: '/api/analytics/track-lookup', method: 'POST' })
    return NextResponse.json(
      { success: false, error: 'Failed to track lookup' },
      { status: 500 }
    )
  }
}

/**
 * Handle GET requests for `/api/analytics/track-lookup`.
 * @returns {unknown} JSON response for the GET /api/analytics/track-lookup request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/analytics/track-lookup
 * fetch('/api/analytics/track-lookup')
 */
export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}

function toConfidence(value: number | undefined): number | null {
  if (!Number.isFinite(value)) return null
  return roundTo(Math.max(0, Math.min(1, Number(value))), 2)
}

function toDuration(value: number | undefined): number | null {
  if (!Number.isFinite(value)) return null
  const normalized = Math.max(0, Math.round(Number(value)))
  return Number.isFinite(normalized) ? normalized : null
}
