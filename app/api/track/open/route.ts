import { createHash } from 'crypto'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { decodeTrackingToken } from '@/lib/tracking'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('t')

  if (!token) {
    return servePixel()
  }

  const decoded = decodeTrackingToken(token)
  if (!decoded) {
    return servePixel()
  }

  try {
    const supabase = await createServiceRoleClient()

    const { count } = await supabase
      .from('email_tracking_events')
      .select('*', { count: 'exact', head: true })
      .eq('draft_id', decoded.draftId)
      .eq('event_type', 'opened')

    if ((count ?? 0) === 0) {
      const forwarded = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? ''
      const ip = forwarded.split(',')[0]?.trim() || ''

      void (async () => {
        await supabase
          .from('email_tracking_events')
          .insert({
            user_id: decoded.userId,
            draft_id: decoded.draftId,
            contact_id: decoded.contactId ?? null,
            event_type: 'opened',
            metadata: {
              user_agent: request.headers.get('user-agent'),
              ip_hash: hashIp(ip),
            },
          })
      })().catch(console.error)

      void (async () => {
        await supabase
          .from('ai_drafts')
          .update({ status: 'sent' })
          .eq('id', decoded.draftId)
          .eq('status', 'scheduled')
      })().catch(console.error)
    }
  } catch {
    // Tracking should never break the pixel response.
  }

  return servePixel()
}

function servePixel(): Response {
  const gif = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  )

  return new Response(gif, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    },
  })
}

function hashIp(ip: string): string {
  if (!ip) return ''
  return createHash('sha256').update(ip).digest('hex').slice(0, 16)
}
