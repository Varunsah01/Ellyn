import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'
import { requirePersona } from '@/lib/middleware/persona-guard'

const PatchStageSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color e.g. #7C3AED')
    .optional(),
  position: z.number().int().min(0).optional(),
})

type StageRow = {
  id: string
  user_id: string
  position: number
  is_default: boolean
}

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

    // Verify ownership and get current position
    const { data: existing } = await supabase
      .from('application_stages')
      .select('id, position')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    const currentStage = existing as StageRow

    // Handle position swap: find whatever stage currently occupies the target position
    if (
      parsed.data.position !== undefined &&
      parsed.data.position !== currentStage.position
    ) {
      const { data: displaced } = await supabase
        .from('application_stages')
        .select('id')
        .eq('user_id', user.id)
        .eq('position', parsed.data.position)
        .neq('id', id)
        .maybeSingle()

      if (displaced) {
        await supabase
          .from('application_stages')
          .update({ position: currentStage.position })
          .eq('id', (displaced as { id: string }).id)
          .eq('user_id', user.id)
      }
    }

    const updates: Record<string, unknown> = {}
    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim()
    if (parsed.data.color !== undefined) updates.color = parsed.data.color
    if (parsed.data.position !== undefined) updates.position = parsed.data.position

    const { data: updated, error } = await supabase
      .from('application_stages')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[stages/[id] PATCH]', error)
    captureApiException(error, { route: '/api/v1/stages/[id]', method: 'PATCH' })
    return NextResponse.json({ error: 'Failed to update stage' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePersona(request, 'job_seeker')
    if (!guard.allowed) return guard.response

    const { user } = guard
    const supabase = await createServiceRoleClient()
    const { id } = await params

    // Verify ownership + get is_default flag
    const { data: existing } = await supabase
      .from('application_stages')
      .select('id, is_default, position')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    const stage = existing as StageRow

    if (stage.is_default) {
      return NextResponse.json({ error: 'cannot_delete_default_stage' }, { status: 400 })
    }

    // Block deletion if contacts are in this stage
    const { count: contactCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('stage_id', id)
      .eq('user_id', user.id)

    if ((contactCount ?? 0) > 0) {
      return NextResponse.json(
        {
          error: 'stage_has_contacts',
          contact_count: contactCount,
          message: 'Move contacts to another stage before deleting.',
        },
        { status: 409 }
      )
    }

    const { error: deleteError } = await supabase
      .from('application_stages')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) throw deleteError

    // Re-gap positions (normalize to 0, 1, 2, ...)
    const { data: remaining } = await supabase
      .from('application_stages')
      .select('id, position')
      .eq('user_id', user.id)
      .order('position', { ascending: true })

    if (remaining && remaining.length > 0) {
      await Promise.all(
        (remaining as { id: string; position: number }[]).map((s, index) =>
          supabase
            .from('application_stages')
            .update({ position: index })
            .eq('id', s.id)
            .eq('user_id', user.id)
        )
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[stages/[id] DELETE]', error)
    captureApiException(error, { route: '/api/v1/stages/[id]', method: 'DELETE' })
    return NextResponse.json({ error: 'Failed to delete stage' }, { status: 500 })
  }
}
