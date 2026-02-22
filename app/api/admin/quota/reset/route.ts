import { NextRequest, NextResponse } from 'next/server'

import { requireAdminEndpointAccess } from '@/lib/auth/admin-endpoint-guard'
import { captureApiException } from '@/lib/monitoring/sentry'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { AdminQuotaSchema, formatZodError } from '@/lib/validation/schemas'

type AdminQuotaAction = 'reset_user' | 'adjust_user' | 'reset_all'

type AdminQuotaRequest = {
  action: AdminQuotaAction
  userId?: string
  used?: number
  limit?: number
  planType?: 'free' | 'pro'
}

type AdminQuotaRpcRow = {
  action: string
  affected_count: number
  details: Record<string, unknown> | null
}

/**
 * Handle POST requests for `/api/admin/quota/reset`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the POST /api/admin/quota/reset request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/admin/quota/reset
 * fetch('/api/admin/quota/reset', { method: 'POST' })
 */
export async function POST(request: NextRequest) {
  try {
    const guard = requireAdminEndpointAccess(request)
    if (!guard.ok) {
      return guard.response
    }

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = AdminQuotaSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodError(parsed.error) },
        { status: 400 }
      )
    }

    const body: AdminQuotaRequest = {
      action: parsed.data.action,
      userId: parsed.data.userId,
      used: parsed.data.used,
      limit: parsed.data.limit,
      planType: parsed.data.planType,
    }
    const serviceClient = await createServiceRoleClient()

    const result = await runAdminAdjustment(serviceClient, body)
    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Invalid JSON body') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    if (message.startsWith('Invalid action') || message.includes('required for')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }

    console.error('[admin/quota/reset] Internal error:', sanitizeErrorForLog(error))
    captureApiException(error, { route: '/api/admin/quota/reset', method: 'POST' })
    return NextResponse.json(
      { error: 'Failed to adjust quota' },
      { status: 500 }
    )
  }
}

/**
 * Handle GET requests for `/api/admin/quota/reset`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the GET /api/admin/quota/reset request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/admin/quota/reset
 * fetch('/api/admin/quota/reset')
 */
export async function GET(request: NextRequest) {
  const guard = requireAdminEndpointAccess(request)
  if (!guard.ok) {
    return guard.response
  }

  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}

async function runAdminAdjustment(
  serviceClient: Awaited<ReturnType<typeof createServiceRoleClient>>,
  body: AdminQuotaRequest
) {
  const rpc = await serviceClient.rpc('admin_adjust_quota', {
    p_action: body.action,
    p_target_user_id: body.userId ?? null,
    p_plan_type: body.planType ?? null,
    p_used: body.used ?? null,
    p_limit: body.limit ?? null,
  })

  if (!rpc.error) {
    const row = normalizeRpcRow(rpc.data)
    return {
      action: row.action,
      affectedCount: row.affected_count,
      details: row.details,
      source: 'rpc',
    }
  }

  if (!isMissingDbObjectError(rpc.error)) {
    throw rpc.error
  }

  // Fallback path when RPC function is unavailable.
  const fallbackResult = await runFallbackAdjustment(serviceClient, body)
  return {
    ...fallbackResult,
    source: 'fallback',
  }
}

async function runFallbackAdjustment(
  serviceClient: Awaited<ReturnType<typeof createServiceRoleClient>>,
  body: AdminQuotaRequest
) {
  const now = new Date()
  const resetEnd = new Date(now.getTime())
  resetEnd.setMonth(resetEnd.getMonth() + 1)

  if (body.action === 'reset_all') {
    const { data, error } = await serviceClient
      .from('user_quotas')
      .update({
        email_lookups_used: 0,
        period_start: now.toISOString(),
        period_end: resetEnd.toISOString(),
        updated_at: now.toISOString(),
      })
      .select('user_id')

    if (error) throw error

    return {
      action: 'reset_all',
      affectedCount: Array.isArray(data) ? data.length : 0,
      details: { resetAt: now.toISOString() },
    }
  }

  if (!body.userId) {
    throw new Error(`userId is required for action ${body.action}`)
  }

  if (body.action === 'reset_user') {
    const { data, error } = await serviceClient
      .from('user_quotas')
      .update({
        email_lookups_used: 0,
        period_start: now.toISOString(),
        period_end: resetEnd.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('user_id', body.userId)
      .select('user_id, plan_type, email_lookups_limit, period_start, period_end')

    if (error) throw error

    return {
      action: 'reset_user',
      affectedCount: Array.isArray(data) ? data.length : 0,
      details: Array.isArray(data) && data[0] ? data[0] : { userId: body.userId },
    }
  }

  const payload: Record<string, unknown> = {
    updated_at: now.toISOString(),
  }
  if (typeof body.used === 'number') payload.email_lookups_used = body.used
  if (typeof body.limit === 'number') payload.email_lookups_limit = body.limit
  if (body.planType) payload.plan_type = body.planType

  const { data, error } = await serviceClient
    .from('user_quotas')
    .update(payload)
    .eq('user_id', body.userId)
    .select('user_id, plan_type, email_lookups_used, email_lookups_limit, period_start, period_end')

  if (error) throw error

  return {
    action: 'adjust_user',
    affectedCount: Array.isArray(data) ? data.length : 0,
    details: Array.isArray(data) && data[0] ? data[0] : { userId: body.userId },
  }
}

function normalizeRpcRow(data: unknown): AdminQuotaRpcRow {
  const row = Array.isArray(data) ? data[0] : data
  return {
    action: String((row as AdminQuotaRpcRow | undefined)?.action || 'unknown'),
    affected_count: Number((row as AdminQuotaRpcRow | undefined)?.affected_count || 0),
    details: ((row as AdminQuotaRpcRow | undefined)?.details || null) as Record<string, unknown> | null,
  }
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
