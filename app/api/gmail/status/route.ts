import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const supabase = await createServiceRoleClient()

    const { data: credentials } = await supabase
      .from('gmail_credentials')
      .select('gmail_email, created_at')
      .eq('user_id', user.id)
      .maybeSingle()

    const connected = !!(credentials?.gmail_email)

    return NextResponse.json({
      connected,
      gmailEmail: credentials?.gmail_email ?? null,
      connectedAt: credentials?.created_at ?? null,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    captureApiException(err, { route: '/api/gmail/status', method: 'GET' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
