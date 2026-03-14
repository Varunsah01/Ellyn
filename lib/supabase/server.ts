import 'server-only'

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { requirePublicEnv, requireServerEnv } from '@/lib/env'
import { instrumentSupabaseClientPerformance } from '@/lib/monitoring/performance'

function instrumentSupabaseClientIfNeeded<T extends object>(
  client: T,
  source: 'server' | 'service-role'
): T {
  try {
    return instrumentSupabaseClientPerformance(client, source)
  } catch (error) {
    console.warn('[Performance] Failed to instrument Supabase client', {
      error: error instanceof Error ? error.message : String(error),
      source,
    })
    return client
  }
}

/**
 * Create client.
 * @returns {unknown} Computed unknown.
 * @throws {Error} If the operation fails.
 * @example
 * createClient()
 */
export async function createClient() {
  const cookieStore = await cookies()
  const supabaseUrl = requirePublicEnv('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseAnonKey = requirePublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Cookie writes can fail in some server rendering contexts.
        }
      },
    },
  })

  return instrumentSupabaseClientIfNeeded(client, 'server')
}

/**
 * Create service role client.
 * @returns {unknown} Computed unknown.
 * @throws {Error} If the operation fails.
 * @example
 * createServiceRoleClient()
 */
export async function createServiceRoleClient() {
  return createSupabaseClient(
    requirePublicEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireServerEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
