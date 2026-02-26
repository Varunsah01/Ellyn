import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'
import { requirePersona } from '@/lib/middleware/persona-guard'
import { computeLeadScore, type ScoredContact } from '@/lib/lead-scoring'

type Params = Promise<{ id: string }>

const CONTACT_SELECT =
  'id, first_name, last_name, company, inferred_email, linkedin_photo_url, ' +
  'email_verified, email_confidence, linkedin_url'

const DEAL_SELECT = `*, contact:contacts(${CONTACT_SELECT})`

const PatchDealSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  company: z.string().min(1).max(200).optional(),
  contact_id: z.string().uuid().nullable().optional(),
  value: z.number().positive().nullable().optional(),
  currency: z.string().length(3).optional(),
  stage: z
    .enum(['prospecting', 'contacted', 'interested', 'meeting', 'proposal', 'won', 'lost'])
    .optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expected_close: z.string().date().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  tags: z.array(z.string()).max(10).optional(),
})

type DealContactRow = ScoredContact & {
  id: string
  first_name: string | null
  last_name: string | null
  company: string | null
  inferred_email: string | null
  linkedin_photo_url: string | null
}

type DealRow = Record<string, unknown> & {
  contact_id: string | null
  contact: DealContactRow | null
}

async function withLeadScore(
  deal: DealRow,
  userId: string,
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>
) {
  if (!deal.contact_id || !deal.contact) return { ...deal, lead_score: null }

  const { data: events } = await supabase
    .from('email_tracking_events')
    .select('event_type, occurred_at')
    .eq('contact_id', deal.contact_id)
    .eq('user_id', userId)
    .order('occurred_at', { ascending: false })
    .limit(20)

  const leadScore = computeLeadScore(
    deal.contact,
    (events ?? []) as { event_type: string; occurred_at: string }[]
  )

  return { ...deal, lead_score: leadScore }
}

// ─── GET /api/v1/deals/[id] ───────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const guard = await requirePersona(request, 'smb_sales')
    if (!guard.allowed) return guard.response

    const { user } = guard
    const supabase = await createServiceRoleClient()
    const { id } = await params

    const { data, error } = await supabase
      .from('deals')
      .select(DEAL_SELECT)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const deal = data as unknown as DealRow
    const result = await withLeadScore(deal, user.id, supabase)

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[deals/[id] GET]', error)
    captureApiException(error, { route: '/api/v1/deals/[id]', method: 'GET' })
    return NextResponse.json({ error: 'Failed to fetch deal' }, { status: 500 })
  }
}

// ─── PATCH /api/v1/deals/[id] ─────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  try {
    const guard = await requirePersona(request, 'smb_sales')
    if (!guard.allowed) return guard.response

    const { user } = guard
    const supabase = await createServiceRoleClient()
    const { id } = await params

    const body = await request.json()
    const parsed = PatchDealSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('deals')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const patch: Record<string, unknown> = {}
    const d = parsed.data
    if (d.title !== undefined) patch.title = d.title.trim()
    if (d.company !== undefined) patch.company = d.company.trim()
    if (d.contact_id !== undefined) patch.contact_id = d.contact_id
    if (d.value !== undefined) patch.value = d.value
    if (d.currency !== undefined) patch.currency = d.currency
    if (d.stage !== undefined) {
      patch.stage = d.stage
      if (d.stage === 'won') patch.probability = 100
      if (d.stage === 'lost') patch.probability = 0
    }
    if (d.probability !== undefined && d.stage === undefined) patch.probability = d.probability
    if (d.expected_close !== undefined) patch.expected_close = d.expected_close
    if (d.notes !== undefined) patch.notes = d.notes
    if (d.tags !== undefined) patch.tags = d.tags

    const { data, error } = await supabase
      .from('deals')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(DEAL_SELECT)
      .single()

    if (error) throw error

    const deal = data as unknown as DealRow
    const result = await withLeadScore(deal, user.id, supabase)

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[deals/[id] PATCH]', error)
    captureApiException(error, { route: '/api/v1/deals/[id]', method: 'PATCH' })
    return NextResponse.json({ error: 'Failed to update deal' }, { status: 500 })
  }
}

// ─── DELETE /api/v1/deals/[id] ────────────────────────────────────────────────

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const guard = await requirePersona(request, 'smb_sales')
    if (!guard.allowed) return guard.response

    const { user } = guard
    const supabase = await createServiceRoleClient()
    const { id } = await params

    const { error } = await supabase
      .from('deals')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[deals/[id] DELETE]', error)
    captureApiException(error, { route: '/api/v1/deals/[id]', method: 'DELETE' })
    return NextResponse.json({ error: 'Failed to delete deal' }, { status: 500 })
  }
}
