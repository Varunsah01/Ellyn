import { NextRequest, NextResponse } from 'next/server'

import { createServiceRoleClient } from '@/lib/supabase/server'

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

export async function POST(request: NextRequest) {
  try {
    const configuredAdminKey = process.env.QUOTA_ADMIN_API_KEY?.trim()
    if (!configuredAdminKey) {
      return NextResponse.json(
        { error: 'QUOTA_ADMIN_API_KEY is not configured' },
        { status: 503 }
      )
    }

    const suppliedAdminKey = request.headers.get('x-admin-key')?.trim()
    if (!suppliedAdminKey || suppliedAdminKey !== configuredAdminKey) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await parseBody(request)
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
    return NextResponse.json(
      { error: 'Failed to adjust quota' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}

async function parseBody(request: NextRequest): Promise<AdminQuotaRequest> {
  let payload: Partial<AdminQuotaRequest> = {}
  try {
    payload = (await request.json()) as Partial<AdminQuotaRequest>
  } catch {
    throw new Error('Invalid JSON body')
  }

  if (
    payload.action !== 'reset_user' &&
    payload.action !== 'adjust_user' &&
    payload.action !== 'reset_all'
  ) {
    throw new Error('Invalid action. Allowed: reset_user, adjust_user, reset_all')
  }

  if ((payload.action === 'reset_user' || payload.action === 'adjust_user') && !payload.userId) {
    throw new Error(`userId is required for action ${payload.action}`)
  }

  if (payload.planType && payload.planType !== 'free' && payload.planType !== 'pro') {
    throw new Error('planType must be free or pro')
  }

  return {
    action: payload.action,
    userId: payload.userId,
    used: Number.isFinite(Number(payload.used)) ? Math.max(0, Math.trunc(Number(payload.used))) : undefined,
    limit: Number.isFinite(Number(payload.limit)) ? Math.max(1, Math.trunc(Number(payload.limit))) : undefined,
    planType: payload.planType,
  }
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
