import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'
import { requirePersona } from '@/lib/middleware/persona-guard'
import { recordActivity } from '@/lib/utils/recordActivity'

type Params = Promise<{ id: string }>

const WonSchema = z.object({
  final_value: z.number().positive().optional(),
  won_date: z.string().date().optional(),
})

export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const guard = await requirePersona(request, 'smb_sales')
    if (!guard.allowed) return guard.response

    const { user } = guard
    const supabase = await createServiceRoleClient()
    const { id } = await params

    const body = await request.json()
    const parsed = WonSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Fetch existing deal to verify ownership + read current value/company
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

    const finalValue = parsed.data.final_value ?? deal.value

    const { data: updated, error } = await supabase
      .from('deals')
      .update({
        stage: 'won',
        probability: 100,
        value: finalValue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*, contact:contacts(id, first_name, last_name, company, inferred_email)')
      .single()

    if (error) throw error

    // Fire-and-forget: activity log
    recordActivity({
      userId: user.id,
      type: 'deal_won',
      description: `Won deal: ${deal.title}`,
      contactId: deal.contact_id,
      metadata: { deal_id: id, value: finalValue, company: deal.company },
    })

    // Fire-and-forget: revenue tracking event
    recordActivity({
      userId: user.id,
      type: 'revenue_event',
      description: `Revenue recorded: ${deal.company}`,
      metadata: {
        event: 'deal_won',
        deal_id: id,
        value: finalValue,
        company: deal.company,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[deals/[id]/won POST]', error)
    captureApiException(error, { route: '/api/v1/deals/[id]/won', method: 'POST' })
    return NextResponse.json({ error: 'Failed to mark deal as won' }, { status: 500 })
  }
}
