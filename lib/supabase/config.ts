// Supabase configuration validation — moved from lib/supabase.ts
// Import isSupabaseConfigured from here instead of the legacy lib/supabase.ts module.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ''

const isValidUrl = (() => {
  try {
    const protocol = new URL(supabaseUrl).protocol
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
})()

export const isSupabaseConfigured = Boolean(
  isValidUrl &&
    supabaseAnon &&
    supabaseUrl !== 'your-supabase-url' &&
    supabaseAnon !== 'your-supabase-anon-key'
)
