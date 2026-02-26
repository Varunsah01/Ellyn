import type { User } from '@supabase/supabase-js'

import {
  createClient,
  createServiceRoleClient,
} from '@/lib/supabase/server'

export function extractBearerToken(headers: Headers): string | null {
  const rawAuth = headers.get('authorization')
  if (!rawAuth) return null

  const match = rawAuth.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]) return null

  const token = match[1].trim()
  return token.length > 0 ? token : null
}

async function resolveUserFromCookie(): Promise<User | null> {
  try {
    const cookieClient = await createClient()
    const {
      data: { user },
    } = await cookieClient.auth.getUser()

    return user ?? null
  } catch {
    return null
  }
}

/**
 * Returns authenticated user (bearer token preferred, cookie fallback) and
 * a service-role Supabase client for DB reads/writes.
 */
export async function getAuthenticatedServiceRoleClient(
  request?: Pick<Request, 'headers'>
): Promise<{
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>
  user: User | null
}> {
  const supabase = await createServiceRoleClient()
  const bearerToken = request ? extractBearerToken(request.headers) : null

  if (bearerToken) {
    const {
      data: { user },
    } = await supabase.auth.getUser(bearerToken)

    return {
      supabase,
      user: user ?? null,
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    return { supabase, user }
  }

  return {
    supabase,
    user: await resolveUserFromCookie(),
  }
}