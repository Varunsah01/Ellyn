import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { captureApiException } from '@/lib/monitoring/sentry'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)
    const supabase = await createServiceRoleClient()

    // Delete the credentials row (Microsoft has no standard token revocation endpoint)
    await supabase.from('outlook_credentials').delete().eq('user_id', user.id)

    return NextResponse.json({ success: true, message: 'Outlook disconnected' })
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    captureApiException(err, { route: '/api/outlook/disconnect', method: 'POST' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
