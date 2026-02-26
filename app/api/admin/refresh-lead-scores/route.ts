import { NextRequest, NextResponse } from 'next/server'

import { requireAdminEndpointAccess } from '@/lib/auth/admin-endpoint-guard'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'
import { computeLeadScore, type ScoredContact, type TrackingEvent } from '@/lib/lead-scoring'

const STALE_HOURS = 24
const BATCH_SIZE = 100

// ─── POST /api/admin/refresh-lead-scores ─────────────────────────────────────

export async function POST(request: NextRequest) {
  const guard = requireAdminEndpointAccess(request)
  if (!guard.ok) return guard.response

  try {
    const supabase = await createServiceRoleClient()

    const staleThreshold = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString()

    // Fetch contacts with stale or missing lead score cache
    const { data: contacts, error: fetchError } = await supabase
      .from('contacts')
      .select('id, user_id, email_verified, email_confidence, linkedin_url, lead_score_computed_at')
      .or(`lead_score_computed_at.is.null,lead_score_computed_at.lt.${staleThreshold}`)
      .limit(BATCH_SIZE)

    if (fetchError) throw fetchError

    const rows = (contacts ?? []) as Array<
      ScoredContact & {
        id: string
        user_id: string
        lead_score_computed_at: string | null
      }
    >

    if (rows.length === 0) {
      return NextResponse.json({ refreshed: 0, message: 'No stale scores found' })
    }

    // Collect unique contact IDs for a batch tracking-events fetch
    const contactIds = rows.map((r) => r.id)

    const { data: events } = await supabase
      .from('email_tracking_events')
      .select('contact_id, event_type, occurred_at')
      .in('contact_id', contactIds)
      .order('occurred_at', { ascending: false })

    // Group events by contact_id (cap 20 per contact)
    const trackingByContact: Record<string, TrackingEvent[]> = {}
    for (const evt of (events ?? []) as {
      contact_id: string
      event_type: string
      occurred_at: string
    }[]) {
      const bucket = trackingByContact[evt.contact_id] ?? []
      trackingByContact[evt.contact_id] = bucket
      if (bucket.length < 20) {
        bucket.push({ event_type: evt.event_type, occurred_at: evt.occurred_at })
      }
    }

    // Compute and persist scores
    const now = new Date().toISOString()
    let refreshed = 0

    await Promise.all(
      rows.map(async (contact) => {
        const contactEvents = trackingByContact[contact.id] ?? []
        const score = computeLeadScore(contact, contactEvents)

        const { error } = await supabase
          .from('contacts')
          .update({
            lead_score_cache: score.score,
            lead_score_grade: score.grade,
            lead_score_computed_at: now,
          })
          .eq('id', contact.id)
          .eq('user_id', contact.user_id)

        if (!error) refreshed++
      })
    )

    return NextResponse.json({ refreshed, total_stale: rows.length })
  } catch (error) {
    console.error('[admin/refresh-lead-scores POST]', error)
    captureApiException(error, {
      route: '/api/admin/refresh-lead-scores',
      method: 'POST',
    })
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 })
  }
}
