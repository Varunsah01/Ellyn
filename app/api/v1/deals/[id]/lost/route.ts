import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'
import { requirePersona } from '@/lib/middleware/persona-guard'
import { recordActivity } from '@/lib/utils/recordActivity'

type Params = Promise<{ id: string }>

const LostSchema = z.object({
  lost_reason: z.enum(['price', 'competitor', 'timing', 'no_budget', 'no_response', 'other']),
  notes: z.string().max(200).optional(),
})

export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const guard = await requirePersona(request, 'smb_sales')
    if (!guard.allowed) return guard.response

    const { user } = guard
    const supabase = await createServiceRoleClient()
    const { id } = await params

    const body = await request.json()
    const parsed = LostSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Verify ownership and get deal details for activity log
    const { data: existing, error: fetchError } = await supabase
      .from('deals')
      .select('id, title, company, value, contact_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const deal = existing as {
      id: string
      title: string
      company: string
      value: number | null
      contact_id: string | null
    }

    // Build patch: notes field appended if provided
    const patch: Record<string, unknown> = {
      stage: 'lost',
      probability: 0,
      lost_reason: parsed.data.lost_reason,
      updated_at: new Date().toISOString(),
    }
    if (parsed.data.notes) {
      patch.notes = parsed.data.notes
    }

    const { data: updated, error } = await supabase
      .from('deals')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*, contact:contacts(id, first_name, last_name, company, inferred_email)')
      .single()

    if (error) throw error

    // Fire-and-forget: activity log
    recordActivity({
      userId: user.id,
      type: 'deal_lost',
      description: `Lost deal: ${deal.title} — ${parsed.data.lost_reason}`,
      contactId: deal.contact_id,
      metadata: {
        deal_id: id,
        company: deal.company,
        lost_reason: parsed.data.lost_reason,
        value: deal.value,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[deals/[id]/lost POST]', error)
    captureApiException(error, { route: '/api/v1/deals/[id]/lost', method: 'POST' })
    return NextResponse.json({ error: 'Failed to mark deal as lost' }, { status: 500 })
  }
}
