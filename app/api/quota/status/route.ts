import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { captureApiException } from '@/lib/monitoring/sentry'

import {
  createQuotaClient,
  ensureQuotaRow,
  isMissingDbObjectError,
  isQuotaNotFoundError,
  sanitizeErrorForLog,
  type QuotaStatusRow,
} from '../_lib'

type QuotaStatusResponse = {
  used: number
  limit: number
  remaining: number
  resetDate: string | null
  planType: string
}

/**
 * Handle GET requests for `/api/quota/status`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the GET /api/quota/status request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/quota/status
 * fetch('/api/quota/status')
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const client = await createQuotaClient(request)

    const status = await getQuotaStatus(client, user.id)
    if (!status) {
      return NextResponse.json(
        { error: 'Quota functions are not available' },
        { status: 500 }
      )
    }

    const payload: QuotaStatusResponse = {
      used: Math.max(0, Number(status.used || 0)),
      limit: Math.max(1, Number(status.quota_limit || 25)),
      remaining: Math.max(0, Number(status.remaining || 0)),
      resetDate: status.reset_date ? new Date(status.reset_date).toISOString() : null,
      planType: String(status.plan_type || 'free'),
    }

    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.error('[quota/status] Internal error:', sanitizeErrorForLog(error))
    captureApiException(error, { route: '/api/quota/status', method: 'GET' })
    return NextResponse.json(
      { error: 'Failed to get quota status' },
      { status: 500 }
    )
  }
}

/**
 * Handle POST requests for `/api/quota/status`.
 * @returns {unknown} JSON response for the POST /api/quota/status request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/quota/status
 * fetch('/api/quota/status', { method: 'POST' })
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET.' },
    { status: 405 }
  )
}

async function getQuotaStatus(client: Awaited<ReturnType<typeof createQuotaClient>>, userId: string) {
  const first = await client.rpc('get_quota_status', {
    p_user_id: userId,
  })

  if (!first.error) {
    return normalizeStatusRow(first.data)
  }

  if (isMissingDbObjectError(first.error)) {
    return null
  }

  if (isQuotaNotFoundError(first.error)) {
    const healed = await ensureQuotaRow(client, userId)
    if (!healed) {
      return null
    }

    const retry = await client.rpc('get_quota_status', {
      p_user_id: userId,
    })

    if (!retry.error) {
      return normalizeStatusRow(retry.data)
    }

    if (isMissingDbObjectError(retry.error)) {
      return null
    }

    throw retry.error
  }

  throw first.error
}

function normalizeStatusRow(data: unknown): QuotaStatusRow {
  const row = Array.isArray(data) ? data[0] : data
  return {
    used: Number((row as QuotaStatusRow | undefined)?.used || 0),
    quota_limit: Number((row as QuotaStatusRow | undefined)?.quota_limit || 25),
    remaining: Number((row as QuotaStatusRow | undefined)?.remaining || 0),
    reset_date: (row as QuotaStatusRow | undefined)?.reset_date || null,
    plan_type: String((row as QuotaStatusRow | undefined)?.plan_type || 'free'),
  }
}
