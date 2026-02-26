import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'
import { requirePersona } from '@/lib/middleware/persona-guard'

const PatchApplicationSchema = z.object({
  applied_at: z.string().datetime().optional().nullable(),
  interview_date: z.string().datetime().optional().nullable(),
  job_url: z.string().url().optional().nullable(),
  salary_range: z.string().max(50).optional().nullable(),
  excitement_level: z.number().int().min(1).max(5).optional().nullable(),
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
    const parsed = PatchApplicationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Verify contact ownership
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Build update payload — only include fields present in the request body
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const { applied_at, interview_date, job_url, salary_range, excitement_level } = parsed.data

    if (applied_at !== undefined) updates.applied_at = applied_at
    if (interview_date !== undefined) updates.interview_date = interview_date
    if (job_url !== undefined) updates.job_url = job_url
    if (salary_range !== undefined) updates.salary_range = salary_range
    if (excitement_level !== undefined) updates.excitement_level = excitement_level

    const { data: updated, error } = await supabase
      .from('contacts')
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
    console.error('[contacts/[id]/application PATCH]', error)
    captureApiException(error, { route: '/api/v1/contacts/[id]/application', method: 'PATCH' })
    return NextResponse.json({ error: 'Failed to update application fields' }, { status: 500 })
  }
}
