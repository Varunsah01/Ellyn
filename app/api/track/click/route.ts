import { createServiceRoleClient } from '@/lib/supabase/server'
import { decodeBase64Url, decodeTrackingToken } from '@/lib/tracking'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('t')
  const encodedDestination = searchParams.get('u')

  const decodedDestination = encodedDestination ? decodeBase64Url(encodedDestination) : null
  const destination = resolveDestination(decodedDestination, request.url)

  if (token) {
    const decoded = decodeTrackingToken(token)
    if (decoded) {
      void (async () => {
        const supabase = await createServiceRoleClient()
        await supabase.from('email_tracking_events').insert({
          user_id: decoded.userId,
          draft_id: decoded.draftId ?? null,
          contact_id: decoded.contactId ?? null,
          sequence_id: decoded.sequenceId ?? null,
          event_type: 'clicked',
          metadata: { destination },
        })
      })().catch(console.error)
    }
  }

  return Response.redirect(destination, 302)
}

function resolveDestination(decoded: string | null, requestUrl: string): string {
  try {
    if (!decoded || decoded.trim().length === 0) {
      return new URL('/', requestUrl).toString()
    }

    const parsed = new URL(decoded, requestUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return new URL('/', requestUrl).toString()
    }

    return parsed.toString()
  } catch {
    return new URL('/', requestUrl).toString()
  }
}
