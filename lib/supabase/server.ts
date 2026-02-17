import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { instrumentSupabaseClientPerformance } from '@/lib/monitoring/performance'

let supabaseSentryInstrumentationApplied = false

function instrumentSupabaseClientIfNeeded<T extends object>(
  client: T,
  source: 'server' | 'service-role'
): T {
  if (!supabaseSentryInstrumentationApplied) {
    try {
      Sentry.instrumentSupabaseClient(client)
      supabaseSentryInstrumentationApplied = true
    } catch (error) {
      // Instrumentation is best-effort and should never break runtime auth/db flows.
      console.warn('[Sentry] Failed to instrument Supabase client', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

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

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required but not set`)
  }
  return value
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
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {
          // Cookie writes can fail in some server rendering contexts.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options })
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
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const client = createServerClient(supabaseUrl, supabaseServiceRoleKey, {
    cookies: {
      getAll() {
        return []
      },
      setAll() {
        // Service-role operations are server-only and do not require cookie persistence.
      },
    },
  })

  return instrumentSupabaseClientIfNeeded(client, 'service-role')
}
