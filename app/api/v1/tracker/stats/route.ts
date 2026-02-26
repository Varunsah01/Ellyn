import { NextRequest, NextResponse } from 'next/server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'
import { requirePersona } from '@/lib/middleware/persona-guard'

type ContactWithStage = {
  interview_date: string | null
  updated_at: string | null
  application_stages: { name: string } | null
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requirePersona(request, 'job_seeker')
    if (!guard.allowed) return guard.response

    const { user } = guard
    const supabase = await createServiceRoleClient()

    // Fetch all tracked contacts (those assigned to a stage) with stage names
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('interview_date, updated_at, application_stages(name)')
      .eq('user_id', user.id)
      .not('stage_id', 'is', null)

    if (error) throw error

    const rows = (contacts ?? []) as unknown as ContactWithStage[]
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const stats = {
      total_tracked: rows.length,
      interviewing: rows.filter((c) => c.application_stages?.name === 'Interviewing').length,
      offers: rows.filter((c) => c.application_stages?.name === 'Offer Received').length,
      upcoming_interviews: rows.filter(
        (c) => c.interview_date !== null && new Date(c.interview_date) >= now
      ).length,
      recently_active: rows.filter(
        (c) => c.updated_at !== null && new Date(c.updated_at) >= sevenDaysAgo
      ).length,
    }

    return NextResponse.json(stats)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[tracker/stats GET]', error)
    captureApiException(error, { route: '/api/v1/tracker/stats', method: 'GET' })
    return NextResponse.json({ error: 'Failed to fetch tracker stats' }, { status: 500 })
  }
}
