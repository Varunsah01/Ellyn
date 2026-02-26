import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { unauthorized } from './response'

type AuthSuccess = { user: User }
type AuthFailure = { user: null; error: ReturnType<typeof unauthorized> }

/**
 * Validate the current session and return the authenticated user.
 * Returns a discriminated union — no throwing on auth failure.
 *
 * Usage:
 *   const auth = await getAuthUser()
 *   if (!auth.user) return auth.error
 *   const { user } = auth
 */
export async function getAuthUser(): Promise<AuthSuccess | AuthFailure> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    return { user: null, error: unauthorized() }
  }
  return { user }
}
