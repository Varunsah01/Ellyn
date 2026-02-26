import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'
import { computeLeadScore, type ScoredContact, type TrackingEvent } from '@/lib/lead-scoring'

type Params = Promise<{ id: string }>

// ─── POST /api/v1/contacts/[id]/lead-score ───────────────────────────────────

export async function POST(_request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await getAuthenticatedUser()
    const supabase = await createServiceRoleClient()
    const { id } = await params

    // Parallel fetch: contact + recent tracking events
    const [contactResult, eventsResult] = await Promise.all([
      supabase
        .from('contacts')
        .select(
          'id, email_verified, email_confidence, linkedin_url, lead_score_computed_at'
        )
        .eq('id', id)
        .eq('user_id', user.id)
        .single(),

      supabase
        .from('email_tracking_events')
        .select('event_type, occurred_at')
        .eq('contact_id', id)
        .eq('user_id', user.id)
        .order('occurred_at', { ascending: false })
        .limit(20),
    ])

    if (contactResult.error || !contactResult.data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const contact = contactResult.data as ScoredContact & {
      id: string
      lead_score_computed_at: string | null
    }
    const events = (eventsResult.data ?? []) as TrackingEvent[]

    const leadScore = computeLeadScore(contact, events)

    // Persist cache columns
    const { error: updateError } = await supabase
      .from('contacts')
      .update({
        lead_score_cache: leadScore.score,
        lead_score_grade: leadScore.grade,
        lead_score_computed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (updateError) throw updateError

    return NextResponse.json({
      contact_id: id,
      ...leadScore,
      computed_at: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[contacts/[id]/lead-score POST]', error)
    captureApiException(error, { route: '/api/v1/contacts/[id]/lead-score', method: 'POST' })
    return NextResponse.json({ error: 'Failed to compute lead score' }, { status: 500 })
  }
}
