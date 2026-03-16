import { NextRequest, NextResponse } from 'next/server'

import { requireAdminEndpointAccess } from '@/lib/auth/admin-endpoint-guard'
import { createImpersonationToken } from '@/lib/auth/admin-impersonation'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const guard = requireAdminEndpointAccess(request)
  if (!guard.ok) return guard.response

  let body: { userId?: string; adminUsername?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const userId = body.userId?.trim()
  const adminUsername = body.adminUsername?.trim() ?? 'admin'
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const supabase = await createServiceRoleClient()

  const { data: userProfile, error: userError } = await supabase
    .from('user_profiles')
    .select('id, email')
    .eq('id', userId)
    .single()

  if (userError || !userProfile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const token = await createImpersonationToken({
    adminUsername,
    targetUserId: userId,
  })

  await supabase.from('activity_log').insert({
    user_id: userId,
    type: 'admin_impersonation_started',
    description: `Admin ${adminUsername} started an impersonation session`,
    metadata: {
      adminUsername,
      targetUserId: userId,
      targetEmail: userProfile.email,
      clientIp: guard.clientIp,
    },
  })

  return NextResponse.json({ success: true, token, expiresInSeconds: 30 * 60 })
}
