import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'
import { requirePersona } from '@/lib/middleware/persona-guard'
import { checkApiRateLimit, rateLimitExceeded } from '@/lib/rate-limit'

const ReorderSchema = z.object({
  stages: z.array(
    z.object({
      id: z.string().uuid(),
      position: z.number().int().min(0),
    })
  ).min(1),
})

export async function POST(request: NextRequest) {
  try {
    const guard = await requirePersona(request, 'job_seeker')
    if (!guard.allowed) return guard.response

    const { user } = guard

    // Rate limit: 30 reorders/hour per user
    const rl = await checkApiRateLimit(`stages-reorder:${user.id}`, 30, 3600)
    if (!rl.allowed) return rateLimitExceeded(rl.resetAt)

    const body = await request.json()
    const parsed = ReorderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = await createServiceRoleClient()

    // Verify all stage IDs belong to this user before updating
    const ids = parsed.data.stages.map((s) => s.id)
    const { data: owned } = await supabase
      .from('application_stages')
      .select('id')
      .eq('user_id', user.id)
      .in('id', ids)

    const ownedIds = new Set((owned ?? []).map((s: { id: string }) => s.id))
    const allOwned = ids.every((id) => ownedIds.has(id))

    if (!allOwned) {
      return NextResponse.json({ error: 'One or more stages not found' }, { status: 404 })
    }

    // Update all positions in parallel
    await Promise.all(
      parsed.data.stages.map(({ id, position }) =>
        supabase
          .from('application_stages')
          .update({ position })
          .eq('id', id)
          .eq('user_id', user.id)
      )
    )

    // Return updated order
    const { data: stages, error } = await supabase
      .from('application_stages')
      .select('*')
      .eq('user_id', user.id)
      .order('position', { ascending: true })

    if (error) throw error

    return NextResponse.json({ stages: stages ?? [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[stages/reorder POST]', error)
    captureApiException(error, { route: '/api/v1/stages/reorder', method: 'POST' })
    return NextResponse.json({ error: 'Failed to reorder stages' }, { status: 500 })
  }
}
