import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'

import {
  csvEscape,
  getPeriodStartDate,
  isMissingDbObjectError,
  normalizePeriod,
  roundTo,
  sanitizeErrorForLog,
  toSafeNumber,
  type AnalyticsPeriod,
} from '../_helpers'

type UserAnalyticsMetrics = {
  totalLookups: number
  successfulLookups: number
  successRate: number
  totalCostUsd: number
  avgCostPerLookup: number
  cacheHitRate: number
  avgConfidence: number
  mostCommonPattern: string | null
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const period = normalizePeriod(request.nextUrl.searchParams.get('period'))
    const format = (request.nextUrl.searchParams.get('format') || 'json').toLowerCase()
    const serviceClient = await createServiceRoleClient()

    const metrics = await getUserMetrics(serviceClient, user.id, period)
    const generatedAt = new Date().toISOString()

    if (format === 'csv') {
      const csv = buildUserAnalyticsCsv(period, metrics, generatedAt)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="ellyn-user-analytics-${period}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    return NextResponse.json({
      success: true,
      period,
      generatedAt,
      data: metrics,
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

    console.error('[analytics/user] Internal error:', sanitizeErrorForLog(error))
    return NextResponse.json(
      { success: false, error: 'Failed to load analytics' },
      { status: 500 }
    )
  }
}

async function getUserMetrics(
  serviceClient: Awaited<ReturnType<typeof createServiceRoleClient>>,
  userId: string,
  period: AnalyticsPeriod
): Promise<UserAnalyticsMetrics> {
  const rpc = await serviceClient.rpc('get_user_analytics', {
    p_user_id: userId,
    p_period: period,
  })

  if (!rpc.error) {
    const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data
    if (row) {
      return {
        totalLookups: toSafeNumber((row as any).total_lookups, 0),
        successfulLookups: toSafeNumber((row as any).successful_lookups, 0),
        successRate: roundTo(toSafeNumber((row as any).success_rate, 0), 2),
        totalCostUsd: roundTo(toSafeNumber((row as any).total_cost_usd, 0), 6),
        avgCostPerLookup: roundTo(toSafeNumber((row as any).avg_cost_per_lookup, 0), 6),
        cacheHitRate: roundTo(toSafeNumber((row as any).cache_hit_rate, 0), 2),
        avgConfidence: roundTo(toSafeNumber((row as any).avg_confidence, 0), 2),
        mostCommonPattern: ((row as any).most_common_pattern as string | null) || null,
      }
    }
  } else if (!isMissingDbObjectError(rpc.error)) {
    console.error('[analytics/user] get_user_analytics RPC failed:', {
      code: rpc.error.code,
      message: rpc.error.message,
    })
  }

  return fallbackUserMetrics(serviceClient, userId, period)
}

async function fallbackUserMetrics(
  serviceClient: Awaited<ReturnType<typeof createServiceRoleClient>>,
  userId: string,
  period: AnalyticsPeriod
): Promise<UserAnalyticsMetrics> {
  let query = serviceClient
    .from('email_lookups')
    .select('pattern, success, cache_hit, cost_usd, confidence, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10000)

  const periodStart = getPeriodStartDate(period)
  if (periodStart) {
    query = query.gte('created_at', periodStart.toISOString())
  }

  const { data, error } = await query
  if (error) {
    throw error
  }

  const rows = Array.isArray(data) ? data : []
  const totalLookups = rows.length
  const successfulLookups = rows.filter((row) => row.success === true).length
  const cacheHits = rows.filter((row) => row.cache_hit === true).length
  const totalCostUsd = rows.reduce((sum, row) => sum + toSafeNumber(row.cost_usd, 0), 0)

  const confidenceValues = rows
    .map((row) => toSafeNumber(row.confidence, Number.NaN))
    .filter((value) => Number.isFinite(value))

  const patternCounts = new Map<string, number>()
  for (const row of rows) {
    const pattern = String(row.pattern || '').trim()
    if (!pattern) continue
    patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1)
  }

  let mostCommonPattern: string | null = null
  let topPatternCount = 0
  for (const [pattern, count] of patternCounts.entries()) {
    if (count > topPatternCount) {
      topPatternCount = count
      mostCommonPattern = pattern
    }
  }

  return {
    totalLookups,
    successfulLookups,
    successRate: totalLookups > 0 ? roundTo((successfulLookups / totalLookups) * 100, 2) : 0,
    totalCostUsd: roundTo(totalCostUsd, 6),
    avgCostPerLookup: totalLookups > 0 ? roundTo(totalCostUsd / totalLookups, 6) : 0,
    cacheHitRate: totalLookups > 0 ? roundTo((cacheHits / totalLookups) * 100, 2) : 0,
    avgConfidence:
      confidenceValues.length > 0
        ? roundTo(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length, 2)
        : 0,
    mostCommonPattern,
  }
}

function buildUserAnalyticsCsv(
  period: AnalyticsPeriod,
  metrics: UserAnalyticsMetrics,
  generatedAt: string
): string {
  const rows = [
    ['period', period],
    ['generated_at_utc', generatedAt],
    ['total_lookups', metrics.totalLookups],
    ['successful_lookups', metrics.successfulLookups],
    ['success_rate_percent', metrics.successRate],
    ['total_cost_usd', metrics.totalCostUsd],
    ['avg_cost_per_lookup_usd', metrics.avgCostPerLookup],
    ['cache_hit_rate_percent', metrics.cacheHitRate],
    ['avg_confidence', metrics.avgConfidence],
    ['most_common_pattern', metrics.mostCommonPattern || ''],
  ]

  return ['metric,value', ...rows.map(([metric, value]) => `${csvEscape(metric)},${csvEscape(value)}`)].join('\n')
}
