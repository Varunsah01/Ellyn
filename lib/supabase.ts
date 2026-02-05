import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Validate environment variables
if (!isSupabaseConfigured) {
  console.warn('Supabase environment variables not configured. Database features will not work.')
}

function createSupabaseStub(): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get() {
      throw new Error(
        'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
      )
    },
  })
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createSupabaseStub()

// Database Types
export interface Lead {
  id: string
  person_name: string
  company_name: string
  discovered_emails: EmailResult[]
  selected_email: string | null
  status: 'discovered' | 'sent' | 'bounced' | 'replied'
  created_at: string
  updated_at: string
}

export interface EmailResult {
  email: string
  pattern: string
  confidence: number
  verified?: boolean
  smtpStatus?: 'valid' | 'invalid' | 'unknown'
}

export interface DomainCache {
  company_name: string
  domain: string
  mx_records: any
  last_verified: string
}

export interface GmailCredentials {
  user_id: string
  client_id: string
  client_secret: string
  access_token: string | null
  refresh_token: string | null
  created_at: string
}
