import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthenticatedServiceRoleClient } from '@/lib/auth/api-user'
import { formatZodError } from '@/lib/validation/schemas'

type EnrollmentRow = {
  id: string
  sequence_id: string
  contact_id: string
  user_id: string
  status: 'active' | 'completed' | 'replied' | 'bounced' | 'unsubscribed' | 'removed'
  current_step_index: number
  next_step_at: string | null
  enrolled_at: string
  completed_at: string | null
}

const replySchema = z.object({
  contactId: z.string().uuid(),
  status: z.enum(['replied', 'bounced']).default('replied'),
})

/**
 * Handle POST requests for `/api/sequences/reply`.
 * Supports `status: "replied"` (default) and `status: "bounced"`.
 * When bounced, the contact's inferred_email is auto-added to suppression_list.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthenticatedServiceRoleClient(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = replySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: formatZodError(parsed.error) },
      { status: 400 }
    )
  }

  const { contactId, status } = parsed.data

  const { data: activeEnrollments, error: findError } = await supabase
    .from('sequence_enrollments')
    .select(
      'id, sequence_id, contact_id, user_id, status, current_step_index, next_step_at, enrolled_at, completed_at'
    )
    .eq('user_id', user.id)
    .eq('contact_id', contactId)
    .eq('status', 'active')

  if (findError) {
    return NextResponse.json(
      { error: 'Failed to fetch enrollments', details: findError.message },
      { status: 500 }
    )
  }

  const enrollmentIds = (activeEnrollments ?? []).map((enrollment) => enrollment.id)

  if (enrollmentIds.length === 0) {
    return NextResponse.json({ updated: 0, enrollments: [] as EnrollmentRow[] })
  }

  const { data: updatedEnrollments, error: updateError } = await supabase
    .from('sequence_enrollments')
    .update({
      status,
      completed_at: new Date().toISOString(),
      next_step_at: null,
    })
    .in('id', enrollmentIds)
    .eq('user_id', user.id)
    .select(
      'id, sequence_id, contact_id, user_id, status, current_step_index, next_step_at, enrolled_at, completed_at'
    )

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update enrollments', details: updateError.message },
      { status: 500 }
    )
  }

  // Update contact status
  await supabase
    .from('contacts')
    .update({
      status: status === 'bounced' ? 'bounced' : 'replied',
      response_received: status === 'replied',
    })
    .eq('id', contactId)
    .eq('user_id', user.id)

  // Track the event
  const trackingRows = (updatedEnrollments ?? []).map((enrollment) => ({
    user_id: user.id,
    contact_id: contactId,
    sequence_id: enrollment.sequence_id,
    event_type: status as 'replied' | 'bounced',
    metadata: {
      enrollment_id: enrollment.id,
      source: 'manual_reply_mark',
    },
  }))

  if (trackingRows.length > 0) {
    void (async () => {
      try {
        await supabase.from('email_tracking_events').insert(trackingRows)
      } catch (error) {
        console.error(error)
      }
    })()
  }

  // Fire-and-forget: auto-suppress on bounce
  if (status === 'bounced') {
    void (async () => {
      try {
        const { data: contact } = await supabase
          .from('contacts')
          .select('inferred_email')
          .eq('id', contactId)
          .eq('user_id', user.id)
          .single()

        const email = (contact as { inferred_email: string | null } | null)?.inferred_email
        if (email) {
          await supabase
            .from('suppression_list')
            .upsert(
              { user_id: user.id, email: email.toLowerCase(), reason: 'bounced' },
              { onConflict: 'user_id,email', ignoreDuplicates: true }
            )
        }
      } catch (error) {
        console.error('[sequences/reply] Failed to auto-suppress bounce', error)
      }
    })()
  }

  return NextResponse.json({
    updated: updatedEnrollments?.length ?? 0,
    enrollments: (updatedEnrollments ?? []) as EnrollmentRow[],
  })
}
