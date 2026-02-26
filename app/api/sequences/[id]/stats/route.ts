import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedServiceRoleClient } from '@/lib/auth/api-user'

type EnrollmentStatus =
  | 'active'
  | 'completed'
  | 'replied'
  | 'bounced'
  | 'unsubscribed'
  | 'removed'

type SequenceRow = {
  id: string
  user_id: string
}

/**
 * Handle GET requests for `/api/sequences/[id]/stats`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { supabase, user } = await getAuthenticatedServiceRoleClient(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sequence, error: sequenceError } = await supabase
    .from('sequences')
    .select('id, user_id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle<SequenceRow>()

  if (sequenceError) {
    return NextResponse.json(
      { error: 'Failed to fetch sequence', details: sequenceError.message },
      { status: 500 }
    )
  }

  if (!sequence) {
    return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })
  }

  const { data: enrollments, error: statsError } = await supabase
    .from('sequence_enrollments')
    .select('status')
    .eq('sequence_id', params.id)
    .eq('user_id', user.id)

  if (statsError) {
    return NextResponse.json(
      { error: 'Failed to fetch sequence stats', details: statsError.message },
      { status: 500 }
    )
  }

  const statuses = (enrollments ?? []).map((row) => row.status as EnrollmentStatus)

  const activeCount = statuses.filter((status) => status === 'active').length
  const completedCount = statuses.filter((status) => status === 'completed').length
  const repliedCount = statuses.filter((status) => status === 'replied').length
  const bouncedCount = statuses.filter((status) => status === 'bounced').length
  const totalEnrolled = statuses.length

  const replyRate = totalEnrolled > 0 ? Number(((repliedCount / totalEnrolled) * 100).toFixed(2)) : 0
  const completionRate = totalEnrolled > 0 ? Number(((completedCount / totalEnrolled) * 100).toFixed(2)) : 0

  return NextResponse.json({
    active_count: activeCount,
    completed_count: completedCount,
    replied_count: repliedCount,
    bounced_count: bouncedCount,
    total_enrolled: totalEnrolled,
    reply_rate: replyRate,
    completion_rate: completionRate,
  })
}
