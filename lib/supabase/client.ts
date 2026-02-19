import { createBrowserClient } from '@supabase/ssr'

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''
const rawSupabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
  ''

function requirePublicEnv(name: string, value: string): string {
  if (!value) {
    throw new Error(`${name} is required but not set`)
  }
  return value
}

/**
 * Create client.
 * @returns {unknown} Computed unknown.
 * @example
 * createClient()
 */
export function createClient() {
  return createBrowserClient(
    requirePublicEnv('NEXT_PUBLIC_SUPABASE_URL', rawSupabaseUrl),
    requirePublicEnv(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)',
      rawSupabaseAnonKey
    )
  )
}
