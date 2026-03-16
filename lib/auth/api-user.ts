import type { User } from '@supabase/supabase-js'

import {
  createClient,
  createServiceRoleClient,
} from '@/lib/supabase/server'
import { getAdminSession } from '@/lib/auth/admin-session'
import { getImpersonationSession } from '@/lib/auth/admin-impersonation'

export function extractBearerToken(headers: Headers): string | null {
  const rawAuth = headers.get('authorization')
  if (!rawAuth) return null

  const match = rawAuth.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]) return null

  const token = match[1].trim()
  return token.length > 0 ? token : null
}

async function resolveImpersonatedUser(): Promise<User | null> {
  const [adminSession, impersonationSession] = await Promise.all([
    getAdminSession(),
    getImpersonationSession(),
  ])

  if (!adminSession || !impersonationSession) return null

  const serviceClient = await createServiceRoleClient()
  const { data, error } = await serviceClient.auth.admin.getUserById(impersonationSession.targetUserId)

  if (error) return null
  return data.user ?? null
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

  const cookieUser = await resolveUserFromCookie()
  if (cookieUser) {
    return { supabase, user: cookieUser }
  }

  return {
    supabase,
    user: await resolveImpersonatedUser(),
  }
}