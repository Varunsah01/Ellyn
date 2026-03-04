import { NextRequest, NextResponse } from 'next/server'
import { requireAdminEndpointAccess } from '@/lib/auth/admin-endpoint-guard'
import { getDomainResolutionStats } from '@/lib/domain-resolution-analytics'
import { captureApiException } from '@/lib/monitoring/sentry'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/domain-accuracy
 * Returns aggregated domain resolution stats for the admin dashboard.
 * Query params:
 *   days  – lookback window in days (default 30, max 365)
 */
export async function GET(request: NextRequest) {
  const guard = requireAdminEndpointAccess(request)
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const days = Math.min(365, Math.max(1, Number(searchParams.get('days') ?? 30)))
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const stats = await getDomainResolutionStats(since)

    return NextResponse.json({ success: true, data: stats, windowDays: days })
  } catch (error) {
    console.error('[Admin/DomainAccuracy] Failed to fetch stats:', error)
    captureApiException(error, { route: '/api/admin/domain-accuracy', method: 'GET' })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
