import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'
import { requirePersona } from '@/lib/middleware/persona-guard'

const PatchStageSchema = z.object({
  stageId: z.string().uuid().nullable(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePersona(request, 'job_seeker')
    if (!guard.allowed) return guard.response

    const { user } = guard
    const supabase = await createServiceRoleClient()
    const { id } = await params

    const body = await request.json()
    const parsed = PatchStageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { stageId } = parsed.data

    // Verify contact ownership
    const { data: existing } = await supabase
      .from('contacts')
      .select('id, stage_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // If a stage is specified, verify it belongs to this user
    if (stageId !== null && stageId !== undefined) {
      const { data: stage } = await supabase
        .from('application_stages')
        .select('id')
        .eq('id', stageId)
        .eq('user_id', user.id)
        .single()

      if (!stage) {
        return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
      }
    }

    const { data: updated, error } = await supabase
      .from('contacts')
      .update({ stage_id: stageId, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error

    // Fire-and-forget activity log
    void supabase
      .from('activity_log')
      .insert({
        user_id: user.id,
        entity_type: 'contact',
        entity_id: id,
        action: 'stage_changed',
        metadata: { stage_id: stageId },
      })
      .then(({ error: logErr }) => {
        if (logErr) console.error('[contact stage] Failed to log activity', logErr)
      })

    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[contacts/[id]/stage PATCH]', error)
    captureApiException(error, { route: '/api/v1/contacts/[id]/stage', method: 'PATCH' })
    return NextResponse.json({ error: 'Failed to update stage' }, { status: 500 })
  }
}
