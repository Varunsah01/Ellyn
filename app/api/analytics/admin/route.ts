import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'

import {
  getPeriodStartDate,
  isAdminUser,
  isMissingDbObjectError,
  normalizePeriod,
  roundTo,
  sanitizeErrorForLog,
  toSafeNumber,
  type AnalyticsPeriod,
} from '../_helpers'

type LookupRow = {
  created_at: string
  success: boolean
  cache_hit: boolean
  cost_usd: number
  domain: string
}

type CostRow = {
  created_at: string
  cost_usd: number
  service: 'anthropic' | 'abstract' | 'clearbit' | 'other' | string
}

type AdminSummary = {
  totalUsers: number
  totalLookups: number
  totalCostUsd: number
  avgCostPerLookup: number
  successRate: number
  cacheHitRate: number
  anthropicCost: number
  abstractCost: number
  burnRateUsdPerHour: number
}

type TrendPoint = {
  bucket: string
  lookups: number
  successRate: number
  cacheHitRate: number
  costUsd: number
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    if (!isAdminUser(user)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const period = normalizePeriod(request.nextUrl.searchParams.get('period') || 'day')
    const serviceClient = await createServiceRoleClient()
    const periodStart = getPeriodStartDate(period)
    const periodStartIso = periodStart ? periodStart.toISOString() : null

    const [lookups, costs, summary] = await Promise.all([
      fetchLookupRows(serviceClient, periodStartIso),
      fetchCostRows(serviceClient, periodStartIso),
      fetchAdminSummary(serviceClient, period),
    ])

    const resolvedSummary = summary || (await buildSummaryFallback(serviceClient, lookups, costs))
    const trends = buildTrends(period, lookups, costs)
    const topDomains = buildTopDomains(lookups, 10)
    const costByService = buildServiceCosts(costs)

    return NextResponse.json({
      success: true,
      period,
      generatedAt: new Date().toISOString(),
      summary: resolvedSummary,
      trends,
      topDomains,
      costByService,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    if (isMissingDbObjectError(error)) {
      return NextResponse.json(
        { success: false, error: 'Analytics schema is missing. Run migration 004_analytics_tracking.sql.' },
        { status: 503 }
      )
    }

    console.error('[analytics/admin] Internal error:', sanitizeErrorForLog(error))
    return NextResponse.json(
      { success: false, error: 'Failed to load admin analytics' },
      { status: 500 }
    )
  }
}

async function fetchAdminSummary(
  serviceClient: Awaited<ReturnType<typeof createServiceRoleClient>>,
  period: AnalyticsPeriod
): Promise<AdminSummary | null> {
  const rpc = await serviceClient.rpc('get_admin_analytics', {
    p_period: period,
  })

  if (!rpc.error) {
    const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data
    if (row) {
      const totalLookups = toSafeNumber((row as any).total_lookups, 0)
      const totalCostUsd = roundTo(toSafeNumber((row as any).total_cost_usd, 0), 6)
      const periodHours = periodToHours(period)
      return {
        totalUsers: toSafeNumber((row as any).total_users, 0),
        totalLookups,
        totalCostUsd,
        avgCostPerLookup: roundTo(toSafeNumber((row as any).avg_cost_per_lookup, 0), 6),
        successRate: roundTo(toSafeNumber((row as any).success_rate, 0), 2),
        cacheHitRate: roundTo(toSafeNumber((row as any).cache_hit_rate, 0), 2),
        anthropicCost: roundTo(toSafeNumber((row as any).anthropic_cost, 0), 6),
        abstractCost: roundTo(toSafeNumber((row as any).abstract_cost, 0), 6),
        burnRateUsdPerHour: periodHours > 0 ? roundTo(totalCostUsd / periodHours, 6) : 0,
      }
    }
  } else if (!isMissingDbObjectError(rpc.error)) {
    console.error('[analytics/admin] get_admin_analytics RPC failed:', {
      code: rpc.error.code,
      message: rpc.error.message,
    })
  }

  return null
}

async function fetchLookupRows(
  serviceClient: Awaited<ReturnType<typeof createServiceRoleClient>>,
  periodStartIso: string | null
): Promise<LookupRow[]> {
  let query = serviceClient
    .from('email_lookups')
    .select('created_at, success, cache_hit, cost_usd, domain')
    .order('created_at', { ascending: true })
    .limit(20000)

  if (periodStartIso) {
    query = query.gte('created_at', periodStartIso)
  }

  const { data, error } = await query
  if (error) throw error

  return (Array.isArray(data) ? data : []).map((row) => ({
    created_at: String(row.created_at),
    success: row.success === true,
    cache_hit: row.cache_hit === true,
    cost_usd: toSafeNumber(row.cost_usd, 0),
    domain: String(row.domain || ''),
  }))
}

async function fetchCostRows(
  serviceClient: Awaited<ReturnType<typeof createServiceRoleClient>>,
  periodStartIso: string | null
): Promise<CostRow[]> {
  let query = serviceClient
    .from('api_costs')
    .select('created_at, cost_usd, service')
    .order('created_at', { ascending: true })
    .limit(20000)

  if (periodStartIso) {
    query = query.gte('created_at', periodStartIso)
  }

  const { data, error } = await query
  if (error) throw error

  return (Array.isArray(data) ? data : []).map((row) => ({
    created_at: String(row.created_at),
    cost_usd: toSafeNumber(row.cost_usd, 0),
    service: String(row.service || 'other'),
  }))
}

async function buildSummaryFallback(
  serviceClient: Awaited<ReturnType<typeof createServiceRoleClient>>,
  lookups: LookupRow[],
  costs: CostRow[]
): Promise<AdminSummary> {
  const totalLookups = lookups.length
  const successfulLookups = lookups.filter((row) => row.success).length
  const cacheHits = lookups.filter((row) => row.cache_hit).length
  const totalCostUsd = roundTo(costs.reduce((sum, row) => sum + row.cost_usd, 0), 6)
  const anthropicCost = roundTo(
    costs
      .filter((row) => row.service === 'anthropic')
      .reduce((sum, row) => sum + row.cost_usd, 0),
    6
  )
  const abstractCost = roundTo(
    costs
      .filter((row) => row.service === 'abstract')
      .reduce((sum, row) => sum + row.cost_usd, 0),
    6
  )

  const { count: totalUsers } = await serviceClient
    .from('user_profiles')
    .select('id', { head: true, count: 'exact' })

  return {
    totalUsers: toSafeNumber(totalUsers, 0),
    totalLookups,
    totalCostUsd,
    avgCostPerLookup: totalLookups > 0 ? roundTo(totalCostUsd / totalLookups, 6) : 0,
    successRate: totalLookups > 0 ? roundTo((successfulLookups / totalLookups) * 100, 2) : 0,
    cacheHitRate: totalLookups > 0 ? roundTo((cacheHits / totalLookups) * 100, 2) : 0,
    anthropicCost,
    abstractCost,
    burnRateUsdPerHour: 0,
  }
}

function buildTrends(period: AnalyticsPeriod, lookups: LookupRow[], costs: CostRow[]): TrendPoint[] {
  const map = new Map<
    string,
    {
      lookups: number
      successful: number
      cacheHits: number
      costUsd: number
    }
  >()

  for (const row of lookups) {
    const bucket = toBucket(row.created_at, period)
    const current = map.get(bucket) || { lookups: 0, successful: 0, cacheHits: 0, costUsd: 0 }
    current.lookups += 1
    if (row.success) current.successful += 1
    if (row.cache_hit) current.cacheHits += 1
    current.costUsd = roundTo(current.costUsd + row.cost_usd, 6)
    map.set(bucket, current)
  }

  for (const row of costs) {
    const bucket = toBucket(row.created_at, period)
    const current = map.get(bucket) || { lookups: 0, successful: 0, cacheHits: 0, costUsd: 0 }
    current.costUsd = roundTo(current.costUsd + row.cost_usd, 6)
    map.set(bucket, current)
  }

  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([bucket, value]) => ({
      bucket,
      lookups: value.lookups,
      successRate: value.lookups > 0 ? roundTo((value.successful / value.lookups) * 100, 2) : 0,
      cacheHitRate: value.lookups > 0 ? roundTo((value.cacheHits / value.lookups) * 100, 2) : 0,
      costUsd: roundTo(value.costUsd, 6),
    }))
}

function buildTopDomains(lookups: LookupRow[], limit: number) {
  const counts = new Map<string, number>()
  for (const row of lookups) {
    const domain = row.domain.trim().toLowerCase()
    if (!domain) continue
    counts.set(domain, (counts.get(domain) || 0) + 1)
  }

  return [...counts.entries()]
    .map(([domain, lookupsCount]) => ({ domain, lookups: lookupsCount }))
    .sort((a, b) => b.lookups - a.lookups)
    .slice(0, limit)
}

function buildServiceCosts(costs: CostRow[]) {
  const totals = new Map<string, number>()
  for (const row of costs) {
    const service = row.service || 'other'
    totals.set(service, roundTo((totals.get(service) || 0) + row.cost_usd, 6))
  }

  return [...totals.entries()]
    .map(([service, costUsd]) => ({ service, costUsd }))
    .sort((a, b) => b.costUsd - a.costUsd)
}

function toBucket(timestamp: string, period: AnalyticsPeriod): string {
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) {
    return 'unknown'
  }

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')

  if (period === 'day') {
    const hour = String(date.getUTCHours()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:00`
  }

  return `${year}-${month}-${day}`
}

function periodToHours(period: AnalyticsPeriod): number {
  switch (period) {
    case 'day':
      return 24
    case 'week':
      return 24 * 7
    case 'month':
      return 24 * 30
    default:
      return 0
  }
}
