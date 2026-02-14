import { createClient as createSupabaseJsClient, type User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

export async function getAuthenticatedUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Unauthorized')
  }

  return user
}

export async function getAuthenticatedUserFromRequest(
  request: Pick<Request, 'headers'>
): Promise<User> {
  const bearerToken = extractBearerToken(request.headers)

  if (bearerToken) {
    const userFromToken = await getUserFromBearerToken(bearerToken)
    if (userFromToken) {
      return userFromToken
    }
  }

  return getAuthenticatedUser()
}

export async function getUserProfile(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function getUserQuota(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_quotas')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    throw error
  }

  return data
}

function extractBearerToken(headers: Headers): string | null {
  const raw = headers.get('authorization')
  if (!raw) return null

  const match = raw.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]) return null

  const token = match[1].trim()
  return token.length > 0 ? token : null
}

async function getUserFromBearerToken(token: string): Promise<User | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  const supabase = createSupabaseJsClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    return null
  }

  return user
}
