import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'

export const dynamic = 'force-dynamic'

type CostRow = {
  user_id: string
  cost_usd: number
  created_at: string
  metadata: {
    endpoint?: string
    domain?: string
    deliverability?: string
    source?: string
  }
}

type PeriodStats = {
  total: number
  apiCalls: number
  cacheHits: number
  cacheHitRate: number
  costUsd: number
  deliverable: number
  undeliverable: number
  risky: number
  unknown: number
  /** deliverable / (deliverable + undeliverable), ignoring RISKY/UNKNOWN */
  deliverabilityRate: number
}

function computePeriodStats(rows: CostRow[]): PeriodStats {
  let apiCalls = 0, cacheHits = 0, costUsd = 0
  let deliverable = 0, undeliverable = 0, risky = 0, unknown = 0

  for (const row of rows) {
    const src = row.metadata?.source
    const dlv = String(row.metadata?.deliverability ?? '').toUpperCase()

    if (src === 'abstract') apiCalls++
    if (src === 'cache')    cacheHits++

    costUsd += row.cost_usd ?? 0

    if (dlv === 'DELIVERABLE')   deliverable++
    else if (dlv === 'UNDELIVERABLE') undeliverable++
    else if (dlv === 'RISKY')    risky++
    else if (src === 'abstract') unknown++ // abstract call but no deliverability label
  }

  const total = rows.length
  const confirmed = deliverable + undeliverable
  return {
    total,
    apiCalls,
    cacheHits,
    cacheHitRate: total > 0 ? Math.round((cacheHits / total) * 1000) / 1000 : 0,
    costUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
    deliverable,
    undeliverable,
    risky,
    unknown,
    deliverabilityRate:
      confirmed > 0 ? Math.round((deliverable / confirmed) * 1000) / 1000 : 0,
  }
}

function periodStart(offsetDays: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - offsetDays)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

/**
 * GET /api/admin/verification-stats
 * System-wide Abstract API verification usage and cost breakdown.
 *
 * Returns stats for today / last 7 days / last 30 days, top verified domains,
 * and deliverability breakdown. Intended for admin dashboards only.
 */
export async function GET(request: NextRequest) {
  // Lightweight admin guard — require a server-side secret header
  const adminSecret = process.env.ADMIN_API_SECRET?.trim()
  if (adminSecret) {
    const provided = request.headers.get('x-admin-secret')?.trim()
    if (provided !== adminSecret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  try {
    const serviceClient = await createServiceRoleClient()

    // Fetch up to 31 days of verification cost rows.
    // Filtered server-side to keep payload small.
    const { data, error } = await serviceClient
      .from('api_costs')
      .select('user_id, cost_usd, created_at, metadata')
      .eq('service', 'abstract')
      .contains('metadata', { endpoint: 'verify-email' })
      .gte('created_at', periodStart(30))
      .order('created_at', { ascending: false })
      .limit(10_000)

    if (error) {
      console.error('[verification-stats] Query failed:', error.message)
      return NextResponse.json(
        { error: 'Failed to fetch verification stats' },
        { status: 500 }
      )
    }

    const rows = (data ?? []) as CostRow[]

    // ── Period windows ──────────────────────────────────────────────────────

    const todayISO = periodStart(0)
    const weekISO  = periodStart(7)

    const todayRows = rows.filter(r => r.created_at >= todayISO)
    const weekRows  = rows.filter(r => r.created_at >= weekISO)
    const monthRows = rows // already limited to 30 days

    // ── Last-hour window ────────────────────────────────────────────────────

    const oneHourAgo   = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const lastHourRows = rows.filter(r => r.created_at >= oneHourAgo)

    // Active users = distinct user IDs with a live API call in the last hour
    const activeUserIds = new Set(
      lastHourRows
        .filter(r => r.metadata?.source === 'abstract')
        .map(r => r.user_id)
    )

    // ── Daily breakdown (last 7 days, oldest first) ─────────────────────────

    const dailyBreakdown: Array<{ date: string } & PeriodStats> = []
    for (let i = 6; i >= 0; i--) {
      const dayStart = periodStart(i)
      const dayEnd   = i > 0 ? periodStart(i - 1) : new Date().toISOString()
      const dayRows  = rows.filter(r => r.created_at >= dayStart && r.created_at < dayEnd)
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - i)
      dailyBreakdown.push({
        date: d.toISOString().split('T')[0] as string,
        ...computePeriodStats(dayRows),
      })
    }

    // ── Top domains (last 30 days, API calls only) ──────────────────────────

    const domainCount: Record<string, number> = {}
    for (const row of monthRows) {
      if (row.metadata?.source !== 'abstract') continue
      const domain = row.metadata?.domain ?? 'unknown'
      domainCount[domain] = (domainCount[domain] ?? 0) + 1
    }
    const topDomains = Object.entries(domainCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }))

    // ── Per-user totals (last 30 days) ──────────────────────────────────────

    const userMap: Record<string, { total: number; apiCalls: number; costUsd: number }> = {}
    for (const row of monthRows) {
      const uid = row.user_id ?? 'system'
      if (!userMap[uid]) userMap[uid] = { total: 0, apiCalls: 0, costUsd: 0 }
      userMap[uid].total++
      if (row.metadata?.source === 'abstract') userMap[uid].apiCalls++
      userMap[uid].costUsd += row.cost_usd ?? 0
    }
    const perUserStats = Object.entries(userMap)
      .sort((a, b) => b[1].apiCalls - a[1].apiCalls)
      .slice(0, 20)
      .map(([userId, stats]) => ({
        userId,
        total: stats.total,
        apiCalls: stats.apiCalls,
        costUsd: Math.round(stats.costUsd * 1_000_000) / 1_000_000,
      }))

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      periods: {
        today: computePeriodStats(todayRows),
        week:  computePeriodStats(weekRows),
        month: computePeriodStats(monthRows),
      },
      lastHour: {
        ...computePeriodStats(lastHourRows),
        activeUsers: activeUserIds.size,
      },
      dailyBreakdown,
      topDomains,
      perUserStats,
    })
  } catch (err) {
    console.error('[verification-stats] Unexpected error:', err)
    captureApiException(err, { route: '/api/admin/verification-stats', method: 'GET' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
