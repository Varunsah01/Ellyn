import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { decryptToken, revokeToken } from '@/lib/gmail-helper'
import { captureApiException } from '@/lib/monitoring/sentry'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const supabase = await createServiceRoleClient()

    // Fetch current credentials to revoke tokens at Google
    const { data: credentials } = await supabase
      .from('gmail_credentials')
      .select('access_token, refresh_token')
      .eq('user_id', user.id)
      .maybeSingle()

    if (credentials) {
      // Best-effort revocation at Google
      const accessToken = decryptToken(credentials.access_token)
      if (accessToken) {
        void revokeToken(accessToken)
      }

      // Delete the credentials row
      await supabase.from('gmail_credentials').delete().eq('user_id', user.id)
    }

    return NextResponse.json({ success: true, message: 'Gmail disconnected' })
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    captureApiException(err, { route: '/api/gmail/disconnect', method: 'POST' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
