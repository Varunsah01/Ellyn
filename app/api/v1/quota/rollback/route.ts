import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const client = await createServiceRoleClient()

    const { error } = await client.rpc('rollback_email_quota', {
      p_user_id: user.id,
    })

    if (error) {
      console.error('[quota/rollback] RPC failed', {
        userId: user.id,
        message: error.message,
        code: error.code,
      })
      return NextResponse.json({ success: false, error: 'Failed to rollback quota' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    console.error('[quota/rollback] Error:', {
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ success: false, error: 'Failed to rollback quota' }, { status: 500 })
  }
}
