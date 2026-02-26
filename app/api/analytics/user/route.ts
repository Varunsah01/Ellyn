import { NextRequest, NextResponse } from 'next/server'
import { format, subDays } from 'date-fns'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { buildCacheKey, getOrSet } from '@/lib/cache/redis'
import { CACHE_TAGS, userAnalyticsTag } from '@/lib/cache/tags'
import { captureApiException } from '@/lib/monitoring/sentry'
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

type OutreachMetrics = {
  totalSent: number
  openRate: number
  replyRate: number
  avgResponseDays: number
}

type SequenceAnalytics = {
  active: number
  totalEnrolled: number
  completionRate: number
  topPerforming: { id: string; name: string; replyRate: number }[]
}

export type ExtendedUserAnalyticsData = UserAnalyticsMetrics & {
  outreach: OutreachMetrics
  sequences: SequenceAnalytics
  contactGrowth: { date: string; count: number }[]
  activityHeatmap: { day: number; hour: number; count: number }[]
  totalContacts: number
  applicationsTracked: number
}

const USER_ANALYTICS_CACHE_TTL_SECONDS = 60 * 60

/**
 * Handle GET requests for `/api/analytics/user`.
 * @param {NextRequest} request - Request input.
 * @returns {unknown} JSON response for the GET /api/analytics/user request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/analytics/user
 * fetch('/api/analytics/user')
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const period = normalizePeriod(request.nextUrl.searchParams.get('period'))
    const fmt = (request.nextUrl.searchParams.get('format') || 'json').toLowerCase()
    const startDateParam = request.nextUrl.searchParams.get('startDate')
    const endDateParam = request.nextUrl.searchParams.get('endDate')
    const serviceClient = await createServiceRoleClient()

    // Date range: prefer explicit startDate/endDate, fall back to period
    const periodStart = startDateParam
      ? new Date(startDateParam)
      : getPeriodStartDate(period)
    const periodEnd = endDateParam ? new Date(endDateParam) : new Date()

    const [metrics, extended] = await Promise.all([
      getUserMetrics(serviceClient, user.id, period),
      getExtendedMetrics(serviceClient, user.id, periodStart, periodEnd),
    ])

    const data: ExtendedUserAnalyticsData = { ...metrics, ...extended }
    const generatedAt = new Date().toISOString()

    if (fmt === 'csv') {
      const csv = buildUserAnalyticsCsv(period, data, generatedAt)
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
      data,
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
    captureApiException(error, { route: '/api/analytics/user', method: 'GET' })
    return NextResponse.json(
      { success: false, error: 'Failed to load analytics' },
      { status: 500 }
    )
  }
}

// ── Email-lookup metrics (cached) ─────────────────────────────────────────

async function getUserMetrics(
  serviceClient: Awaited<ReturnType<typeof createServiceRoleClient>>,
  userId: string,
  period: AnalyticsPeriod
): Promise<UserAnalyticsMetrics> {
  const key = buildCacheKey(['cache', 'user-analytics', userId, period])
  return getOrSet<UserAnalyticsMetrics>({
    key,
    ttlSeconds: USER_ANALYTICS_CACHE_TTL_SECONDS,
    tags: [CACHE_TAGS.userAnalytics, userAnalyticsTag(userId)],
    fetcher: async () => {
      const rpc = await serviceClient.rpc('get_user_analytics', {
        p_user_id: userId,
        p_period: period,
      })

      if (!rpc.error) {
        const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data
        if (row) {
          return {
            totalLookups: toSafeNumber((row as Record<string, unknown>).total_lookups, 0),
            successfulLookups: toSafeNumber((row as Record<string, unknown>).successful_lookups, 0),
            successRate: roundTo(toSafeNumber((row as Record<string, unknown>).success_rate, 0), 2),
            totalCostUsd: roundTo(toSafeNumber((row as Record<string, unknown>).total_cost_usd, 0), 6),
            avgCostPerLookup: roundTo(toSafeNumber((row as Record<string, unknown>).avg_cost_per_lookup, 0), 6),
            cacheHitRate: roundTo(toSafeNumber((row as Record<string, unknown>).cache_hit_rate, 0), 2),
            avgConfidence: roundTo(toSafeNumber((row as Record<string, unknown>).avg_confidence, 0), 2),
            mostCommonPattern: ((row as Record<string, unknown>).most_common_pattern as string | null) || null,
          }
        }
      } else if (!isMissingDbObjectError(rpc.error)) {
        console.error('[analytics/user] get_user_analytics RPC failed:', {
          code: rpc.error.code,
          message: rpc.error.message,
        })
      }

      return fallbackUserMetrics(serviceClient, userId, period)
    },
    backgroundRefresh: {
      enabled: true,
      hotThreshold: 6,
      refreshAheadSeconds: 5 * 60,
      cooldownSeconds: 90,
    },
  })
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

// ── Extended outreach/sequences metrics ───────────────────────────────────

async function getExtendedMetrics(
  serviceClient: Awaited<ReturnType<typeof createServiceRoleClient>>,
  userId: string,
  periodStart: Date | null,
  periodEnd: Date
): Promise<Omit<ExtendedUserAnalyticsData, keyof UserAnalyticsMetrics>> {
  const startStr = periodStart ? periodStart.toISOString() : '2000-01-01T00:00:00Z'
  const endStr = periodEnd.toISOString()

  try {
    // Run all queries in parallel
    const [
      outreachRes,
      contactsRes,
      seqRes,
    ] = await Promise.all([
      serviceClient
        .from('outreach')
        .select('status, sent_at')
        .eq('user_id', userId)
        .not('sent_at', 'is', null)
        .gte('sent_at', startStr)
        .lte('sent_at', endStr),
      serviceClient
        .from('contacts')
        .select('status, created_at')
        .eq('user_id', userId),
      serviceClient
        .from('sequences')
        .select('id, name, status')
        .eq('user_id', userId),
    ])

    // ── Outreach metrics
    const outreachRows = outreachRes.data ?? []
    const totalSent = outreachRows.length
    const openedCount = outreachRows.filter(
      (r) => r.status === 'opened' || r.status === 'replied'
    ).length
    const repliedCount = outreachRows.filter((r) => r.status === 'replied').length
    const outreach: OutreachMetrics = {
      totalSent,
      openRate: totalSent > 0 ? roundTo((openedCount / totalSent) * 100, 1) : 0,
      replyRate: totalSent > 0 ? roundTo((repliedCount / totalSent) * 100, 1) : 0,
      avgResponseDays: 0,
    }

    // ── Contact counts
    const allContacts = contactsRes.data ?? []
    const totalContacts = allContacts.length
    const applicationsTracked = allContacts.filter((c) => c.status !== 'new').length

    // ── Contact growth (last 30 days, always)
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString()
    const growthContacts = allContacts.filter(
      (c) => c.created_at >= thirtyDaysAgo
    )
    const growthMap = new Map<string, number>()
    growthContacts.forEach((c) => {
      const day = (c.created_at as string).slice(0, 10)
      growthMap.set(day, (growthMap.get(day) ?? 0) + 1)
    })
    const contactGrowth = Array.from(growthMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // ── Activity heatmap (flat format)
    const heatmapMap = new Map<string, number>()
    outreachRows.forEach((r) => {
      if (!r.sent_at) return
      const d = new Date(r.sent_at)
      const key = `${d.getDay()}_${d.getHours()}`
      heatmapMap.set(key, (heatmapMap.get(key) ?? 0) + 1)
    })
    const activityHeatmap = Array.from(heatmapMap.entries()).map(([key, count]) => {
      const parts = key.split('_')
      return { day: Number(parts[0] ?? 0), hour: Number(parts[1] ?? 0), count }
    })

    // ── Sequence analytics
    const seqRows = seqRes.data ?? []
    const seqIds = seqRows.map((s) => s.id)
    const active = seqRows.filter((s) => s.status === 'active').length

    let sequences: SequenceAnalytics = {
      active,
      totalEnrolled: 0,
      completionRate: 0,
      topPerforming: [],
    }

    if (seqIds.length > 0) {
      const { data: enrollments } = await serviceClient
        .from('sequence_enrollments')
        .select('sequence_id, status')
        .in('sequence_id', seqIds)

      const allEnrollments = enrollments ?? []
      const totalEnrolled = allEnrollments.length
      const completedCount = allEnrollments.filter((e) => e.status === 'completed').length
      const completionRate =
        totalEnrolled > 0 ? roundTo((completedCount / totalEnrolled) * 100, 1) : 0

      // Compute per-sequence reply rate for topPerforming
      const seqStats = new Map<string, { total: number; replied: number }>()
      allEnrollments.forEach((e) => {
        const s = seqStats.get(e.sequence_id) ?? { total: 0, replied: 0 }
        s.total++
        if (e.status === 'replied') s.replied++
        seqStats.set(e.sequence_id, s)
      })

      const topPerforming = seqRows
        .map((s) => {
          const stats = seqStats.get(s.id) ?? { total: 0, replied: 0 }
          return {
            id: s.id as string,
            name: s.name as string,
            replyRate: stats.total > 0 ? roundTo((stats.replied / stats.total) * 100, 1) : 0,
          }
        })
        .filter((s) => (seqStats.get(s.id)?.total ?? 0) > 0)
        .sort((a, b) => b.replyRate - a.replyRate)
        .slice(0, 3)

      sequences = { active, totalEnrolled, completionRate, topPerforming }
    }

    return {
      outreach,
      sequences,
      contactGrowth,
      activityHeatmap,
      totalContacts,
      applicationsTracked,
    }
  } catch {
    // Return zero-state on any error so the page still renders
    return {
      outreach: { totalSent: 0, openRate: 0, replyRate: 0, avgResponseDays: 0 },
      sequences: { active: 0, totalEnrolled: 0, completionRate: 0, topPerforming: [] },
      contactGrowth: [],
      activityHeatmap: [],
      totalContacts: 0,
      applicationsTracked: 0,
    }
  }
}

// ── CSV builder ───────────────────────────────────────────────────────────

function buildUserAnalyticsCsv(
  period: AnalyticsPeriod,
  metrics: ExtendedUserAnalyticsData,
  generatedAt: string
): string {
  const rows: [string, unknown][] = [
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
    ['total_contacts', metrics.totalContacts],
    ['applications_tracked', metrics.applicationsTracked],
    ['emails_sent', metrics.outreach.totalSent],
    ['open_rate_percent', metrics.outreach.openRate],
    ['reply_rate_percent', metrics.outreach.replyRate],
    ['active_sequences', metrics.sequences.active],
    ['total_enrolled', metrics.sequences.totalEnrolled],
    ['completion_rate_percent', metrics.sequences.completionRate],
  ]

  const header = 'metric,value'
  const body = rows.map(([k, v]) => `${csvEscape(k)},${csvEscape(v)}`).join('\n')

  const growthSection =
    metrics.contactGrowth.length > 0
      ? '\n\ncontact_growth_date,contacts_added\n' +
        metrics.contactGrowth.map((r) => `${csvEscape(r.date)},${r.count}`).join('\n')
      : ''

  return [header, body].join('\n') + growthSection
}

// Re-export period helper for typed consumers
export type { AnalyticsPeriod }
export { format as _formatDate }
