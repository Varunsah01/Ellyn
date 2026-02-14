import { createBrowserClient } from '@supabase/ssr'

function requirePublicEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required but not set`)
  }
  return value
}

export function createClient() {
  return createBrowserClient(
    requirePublicEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requirePublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  )
}

