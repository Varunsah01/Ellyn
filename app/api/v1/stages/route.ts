import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'
import { requirePersona } from '@/lib/middleware/persona-guard'

const MAX_STAGES = 15

const CreateStageSchema = z.object({
  name: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color e.g. #7C3AED')
    .default('#6B7280'),
})

export async function GET(request: NextRequest) {
  try {
    const guard = await requirePersona(request, 'job_seeker')
    if (!guard.allowed) return guard.response

    const { user } = guard
    const supabase = await createServiceRoleClient()

    // Seed defaults idempotently via DB function
    await supabase.rpc('ensure_default_stages', { p_user_id: user.id })

    const { data: stages, error } = await supabase
      .from('application_stages')
      .select('*')
      .eq('user_id', user.id)
      .order('position', { ascending: true })

    if (error) throw error

    // Attach per-stage contact counts
    const stageIds = (stages ?? []).map((s: { id: string }) => s.id)
    const countMap: Record<string, number> = {}

    if (stageIds.length > 0) {
      const { data: contactRows } = await supabase
        .from('contacts')
        .select('stage_id')
        .eq('user_id', user.id)
        .in('stage_id', stageIds)

      for (const row of (contactRows ?? []) as { stage_id: string }[]) {
        countMap[row.stage_id] = (countMap[row.stage_id] ?? 0) + 1
      }
    }

    const result = (stages ?? []).map((s: Record<string, unknown>) => ({
      ...s,
      contact_count: countMap[s.id as string] ?? 0,
    }))

    return NextResponse.json({ stages: result, total: result.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[stages GET]', error)
    captureApiException(error, { route: '/api/v1/stages', method: 'GET' })
    return NextResponse.json({ error: 'Failed to fetch stages' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requirePersona(request, 'job_seeker')
    if (!guard.allowed) return guard.response

    const { user } = guard

    const body = await request.json()
    const parsed = CreateStageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = await createServiceRoleClient()

    // Enforce 15-stage limit
    const { count } = await supabase
      .from('application_stages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((count ?? 0) >= MAX_STAGES) {
      return NextResponse.json(
        { error: 'Stage limit reached. Maximum 15 stages per user.' },
        { status: 400 }
      )
    }

    // Determine next position
    const { data: maxRow } = await supabase
      .from('application_stages')
      .select('position')
      .eq('user_id', user.id)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextPosition = ((maxRow as { position: number } | null)?.position ?? -1) + 1

    const { data: stage, error } = await supabase
      .from('application_stages')
      .insert({
        user_id: user.id,
        name: parsed.data.name,
        color: parsed.data.color,
        position: nextPosition,
        is_default: false,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(
      { ...(stage as Record<string, unknown>), contact_count: 0 },
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[stages POST]', error)
    captureApiException(error, { route: '/api/v1/stages', method: 'POST' })
    return NextResponse.json({ error: 'Failed to create stage' }, { status: 500 })
  }
}
