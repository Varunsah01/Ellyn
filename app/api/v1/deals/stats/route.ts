import { NextRequest, NextResponse } from 'next/server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'
import { requirePersona } from '@/lib/middleware/persona-guard'

export async function GET(request: NextRequest) {
  try {
    const guard = await requirePersona(request, 'smb_sales')
    if (!guard.allowed) return guard.response

    const { user } = guard
    const supabase = await createServiceRoleClient()

    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
    const todayStr = today.toISOString().split('T')[0]
    const thirtyDayStr = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    // Four parallel queries
    const [activeResult, wonResult, lostResult, closingResult] = await Promise.all([
      // Active pipeline: non-won/lost
      supabase
        .from('deals')
        .select('value, probability')
        .eq('user_id', user.id)
        .not('stage', 'in', '(won,lost)'),

      // Won deals: all time (for avg deal size + win rate) + this month revenue
      supabase
        .from('deals')
        .select('value, updated_at')
        .eq('user_id', user.id)
        .eq('stage', 'won'),

      // Lost deals: count for win rate
      supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('stage', 'lost'),

      // Closing soon: non-won/lost with expected_close in next 30 days
      supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('stage', 'in', '(won,lost)')
        .gte('expected_close', todayStr)
        .lte('expected_close', thirtyDayStr),
    ])

    if (activeResult.error) throw activeResult.error
    if (wonResult.error) throw wonResult.error

    type ActiveRow = { value: number | null; probability: number | null }
    type WonRow = { value: number | null; updated_at: string }

    const activeRows = (activeResult.data ?? []) as ActiveRow[]
    const wonRows = (wonResult.data ?? []) as WonRow[]
    const lostCount = lostResult.count ?? 0
    const closingSoon = closingResult.count ?? 0

    // Active pipeline aggregates
    const active_deals = activeRows.length
    const pipeline_value = activeRows.reduce((sum, r) => sum + (r.value ?? 0), 0)
    const weighted_value = activeRows.reduce(
      (sum, r) => sum + ((r.value ?? 0) * (r.probability ?? 0)) / 100,
      0
    )

    // Won this month
    const wonThisMonth = wonRows.filter((r) => r.updated_at >= startOfMonth)
    const won_this_month = wonThisMonth.reduce((sum, r) => sum + (r.value ?? 0), 0)
    const deals_won_this_month = wonThisMonth.length

    // Win rate (all time)
    const totalClosed = wonRows.length + lostCount
    const win_rate =
      totalClosed === 0 ? 0 : Math.round((wonRows.length / totalClosed) * 1000) / 10

    // Average deal size (won deals only)
    const wonWithValue = wonRows.filter((r) => r.value !== null)
    const avg_deal_size =
      wonWithValue.length === 0
        ? 0
        : wonWithValue.reduce((sum, r) => sum + (r.value ?? 0), 0) / wonWithValue.length

    return NextResponse.json({
      active_deals,
      pipeline_value,
      weighted_value,
      won_this_month,
      deals_won_this_month,
      win_rate,
      avg_deal_size,
      closing_soon: closingSoon,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[deals/stats GET]', error)
    captureApiException(error, { route: '/api/v1/deals/stats', method: 'GET' })
    return NextResponse.json({ error: 'Failed to fetch deal stats' }, { status: 500 })
  }
}
