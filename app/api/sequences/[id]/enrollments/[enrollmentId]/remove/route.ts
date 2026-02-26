import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedServiceRoleClient } from '@/lib/auth/api-user'

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

/**
 * Handle POST requests for `/api/sequences/[id]/enrollments/[enrollmentId]/remove`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; enrollmentId: string } }
) {
  const { supabase, user } = await getAuthenticatedServiceRoleClient(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('sequence_enrollments')
    .update({
      status: 'removed',
      completed_at: new Date().toISOString(),
      next_step_at: null,
    })
    .eq('id', params.enrollmentId)
    .eq('sequence_id', params.id)
    .eq('user_id', user.id)
    .select(
      'id, sequence_id, contact_id, user_id, status, current_step_index, next_step_at, enrolled_at, completed_at'
    )
    .maybeSingle<EnrollmentRow>()

  if (error) {
    return NextResponse.json(
      { error: 'Failed to remove enrollment', details: error.message },
      { status: 500 }
    )
  }

  if (!data) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, enrollment: data })
}
