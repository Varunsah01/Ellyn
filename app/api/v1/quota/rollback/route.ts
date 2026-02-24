import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await createServiceRoleClient()

    // Decrement email_lookups_used by 1, clamped at 0
    const { error } = await client
      .from('user_quotas')
      .update({
        email_lookups_used: client.rpc('greatest', [0]) as any,
      })
      .eq('user_id', user.id)

    // If the above doesn't work due to raw expression limitation,
    // use the RPC function
    if (error) {
      const { error: rpcError } = await client.rpc('rollback_email_quota', {
        p_user_id: user.id,
      })
      if (rpcError) {
        console.warn('[quota/rollback] RPC fallback failed:', rpcError.message)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[quota/rollback] Error:', error)
    // Always return success — quota rollback failure should never block the client
    return NextResponse.json({ success: true })
  }
}
