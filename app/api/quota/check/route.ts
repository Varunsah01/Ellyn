import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { captureApiException } from '@/lib/monitoring/sentry'

import {
  createQuotaClient,
  ensureQuotaRow,
  isMissingDbObjectError,
  isQuotaNotFoundError,
  sanitizeErrorForLog,
  toRetryAfterSeconds,
  type QuotaCheckRow,
} from '../_lib'

type QuotaCheckResponse = {
  allowed: boolean
  remaining: number
  resetDate: string | null
}

/**
 * Handle POST requests for `/api/quota/check`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the POST /api/quota/check request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/quota/check
 * fetch('/api/quota/check', { method: 'POST' })
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const client = await createQuotaClient(request)

    const quotaResult = await checkAndIncrementQuota(client, user.id)
    if (!quotaResult) {
      return NextResponse.json(
        { error: 'Quota functions are not available' },
        { status: 500 }
      )
    }

    const payload: QuotaCheckResponse = {
      allowed: quotaResult.allowed,
      remaining: Math.max(0, Number(quotaResult.remaining || 0)),
      resetDate: quotaResult.reset_date ? new Date(quotaResult.reset_date).toISOString() : null,
    }

    if (!payload.allowed) {
      const retryAfterSeconds = toRetryAfterSeconds(payload.resetDate)
      return NextResponse.json(payload, {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
        },
      })
    }

    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.error('[quota/check] Internal error:', sanitizeErrorForLog(error))
    captureApiException(error, { route: '/api/quota/check', method: 'POST' })
    return NextResponse.json(
      { error: 'Failed to check quota' },
      { status: 500 }
    )
  }
}

/**
 * Handle GET requests for `/api/quota/check`.
 * @returns {unknown} JSON response for the GET /api/quota/check request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/quota/check
 * fetch('/api/quota/check')
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}

async function checkAndIncrementQuota(client: Awaited<ReturnType<typeof createQuotaClient>>, userId: string) {
  const first = await client.rpc('check_and_increment_quota', {
    p_user_id: userId,
    p_quota_type: 'email_lookups',
  })

  if (!first.error) {
    return normalizeCheckRow(first.data)
  }

  if (isMissingDbObjectError(first.error)) {
    return null
  }

  if (isQuotaNotFoundError(first.error)) {
    const healed = await ensureQuotaRow(client, userId)
    if (!healed) {
      return null
    }

    const retry = await client.rpc('check_and_increment_quota', {
      p_user_id: userId,
      p_quota_type: 'email_lookups',
    })

    if (!retry.error) {
      return normalizeCheckRow(retry.data)
    }

    if (isMissingDbObjectError(retry.error)) {
      return null
    }

    throw retry.error
  }

  throw first.error
}

function normalizeCheckRow(data: unknown): QuotaCheckRow {
  const row = Array.isArray(data) ? data[0] : data
  return {
    allowed: Boolean((row as QuotaCheckRow | undefined)?.allowed),
    remaining: Number((row as QuotaCheckRow | undefined)?.remaining || 0),
    reset_date: (row as QuotaCheckRow | undefined)?.reset_date || null,
  }
}
