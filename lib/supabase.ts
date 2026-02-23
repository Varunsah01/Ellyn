import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Config validation
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

if (!isSupabaseConfigured) {
  console.warn(
    '[Ellyn] Supabase not configured - set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  )
}

// Client
export const supabase: SupabaseClient = isSupabaseConfigured
  ? (createClient<Database>(supabaseUrl, supabaseAnon) as unknown as SupabaseClient)
  : new Proxy({} as SupabaseClient, {
      get() {
        throw new Error('Supabase not configured')
      },
    })

// Server-side only (API routes / webhooks) - uses service role to bypass RLS
export function createServiceClient(): SupabaseClient {
  if (!isValidUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is invalid or not set')
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')

  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Database Types
type TableDef<Row, Insert, Update> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      [tableName: string]: TableDef<Record<string, any>, Record<string, any>, Record<string, any>>
      user_profiles: TableDef<UserProfile, UserProfileInsert, Partial<UserProfileInsert>>
      contacts: TableDef<Contact, ContactInsert, Partial<ContactInsert>>
      email_templates: TableDef<EmailTemplate, EmailTemplateInsert, Partial<EmailTemplateInsert>>
      ai_drafts: TableDef<AIDraft, AIDraftInsert, Partial<AIDraftInsert>>
      user_quotas: TableDef<UserQuota, UserQuotaInsert, Partial<UserQuotaInsert>>
      api_costs: TableDef<ApiCost, ApiCostInsert, Partial<ApiCostInsert>>
      email_pattern_cache: TableDef<
        EmailPatternCache,
        EmailPatternCacheInsert,
        Partial<EmailPatternCacheInsert>
      >
      dodo_webhook_events: TableDef<
        DodoWebhookEvent,
        DodoWebhookEventInsert,
        Partial<DodoWebhookEventInsert>
      >
      // Compatibility tables still used by active routes during migration.
      leads: TableDef<Lead, LeadInsert, Partial<LeadInsert>>
      drafts: TableDef<Draft, DraftInsert, Partial<DraftInsert>>
      pattern_learning: TableDef<PatternLearning, PatternLearningInsert, Partial<PatternLearningInsert>>
      domain_cache: TableDef<DomainCache, DomainCacheInsert, Partial<DomainCacheInsert>>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Row Types
export interface UserProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
  plan_type: 'free' | 'pro'
  dodo_customer_id: string | null
  dodo_subscription_id: string | null
  dodo_product_id: string | null
  subscription_status:
    | 'active'
    | 'inactive'
    | 'cancelled'
    | 'past_due'
    | 'trialing'
    | 'paused'
    | null
  subscription_period_start: string | null
  subscription_period_end: string | null
  trial_ends_at: string | null
  created_at: string
  updated_at: string
}

export interface UserProfileInsert {
  id: string
  full_name?: string
  avatar_url?: string
  plan_type?: 'free' | 'pro'
  dodo_customer_id?: string
  dodo_subscription_id?: string
  dodo_product_id?: string
  subscription_status?: UserProfile['subscription_status']
  subscription_period_start?: string
  subscription_period_end?: string
  trial_ends_at?: string
}

export interface Contact {
  id: string
  user_id: string
  first_name: string
  last_name: string
  full_name: string
  company: string
  role: string | null
  location: string | null
  linkedin_url: string | null
  linkedin_headline: string | null
  linkedin_photo_url: string | null
  inferred_email: string | null
  email_confidence: number | null
  confirmed_email: string | null
  email_pattern: string | null
  email_verified: boolean
  email_source: string | null
  company_domain: string | null
  company_industry: string | null
  company_size: string | null
  status: 'new' | 'contacted' | 'replied' | 'no_response'
  last_contacted_at: string | null
  response_received: boolean
  source: 'manual' | 'extension' | 'csv_import'
  tags: string[]
  notes: string | null
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type ContactInsert = Omit<Contact, 'id' | 'full_name' | 'created_at' | 'updated_at'>

export interface EmailTemplate {
  id: string
  user_id: string
  name: string
  subject: string
  body: string
  tone: 'professional' | 'casual' | 'formal' | 'friendly'
  use_case: string | null
  is_default: boolean
  usage_count: number
  // Backward-compatible metadata fields used in current dashboard routes.
  category: string | null
  tags: string[] | null
  icon: string | null
  use_count: number | null
  created_at: string
  updated_at: string
}

export type EmailTemplateInsert = Omit<
  EmailTemplate,
  'id' | 'created_at' | 'updated_at' | 'usage_count' | 'use_count'
> & {
  usage_count?: number
  use_count?: number
}

export interface AIDraft {
  id: string
  user_id: string
  contact_id: string | null
  template_id: string | null
  subject: string
  body: string
  status: 'draft' | 'sent' | 'scheduled' | 'archived'
  scheduled_for: string | null
  sent_at: string | null
  model_used: string | null
  tokens_used: number | null
  generation_cost_usd: number | null
  personalization_vars: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type AIDraftInsert = Omit<AIDraft, 'id' | 'created_at' | 'updated_at'>

export interface UserQuota {
  id: string
  user_id: string
  ai_generations_used: number
  ai_generations_limit: number
  email_lookups_used: number
  email_lookups_limit: number
  period_start: string
  period_end: string
  updated_at: string
}

export type UserQuotaInsert = Omit<UserQuota, 'id' | 'updated_at'>

export interface ApiCost {
  id: string
  user_id: string
  service: string
  action: string
  cost_usd: number
  tokens_used: number | null
  metadata: Record<string, unknown>
  created_at: string
}

export type ApiCostInsert = Omit<ApiCost, 'id' | 'created_at'>

export interface EmailPatternCache {
  id: string
  domain: string
  patterns: string[]
  confidence: number | null
  verified_count: number
  sample_size: number
  last_verified: string | null
  created_at: string
  updated_at: string
}

export type EmailPatternCacheInsert = Omit<EmailPatternCache, 'id' | 'created_at' | 'updated_at'>

export interface DodoWebhookEvent {
  id: string
  event_id: string
  event_type: string
  payload: Record<string, unknown>
  processed: boolean
  processed_at: string | null
  error: string | null
  created_at: string
}

export type DodoWebhookEventInsert = Omit<
  DodoWebhookEvent,
  'id' | 'processed' | 'processed_at' | 'error' | 'created_at'
> & {
  processed?: boolean
  processed_at?: string | null
  error?: string | null
}

// Compatibility row types for active endpoints still being migrated.
export interface Lead {
  id: string
  user_id: string
  person_name: string
  company_name: string
  discovered_emails: Array<{
    email: string
    pattern: string
    confidence: number
  }>
  selected_email: string | null
  status: 'discovered' | 'sent' | 'bounced' | 'replied'
  created_at: string
  updated_at: string
}

export type LeadInsert = Omit<Lead, 'id' | 'created_at' | 'updated_at'>

export interface Draft {
  id: string
  user_id: string
  contact_id: string | null
  template_id: string | null
  subject: string
  body: string
  status: 'draft' | 'sent' | 'scheduled' | 'archived'
  scheduled_for: string | null
  sent_at: string | null
  personalization_variables: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type DraftInsert = Omit<Draft, 'id' | 'created_at' | 'updated_at'>

export interface PatternLearning {
  id: string
  domain: string
  pattern: string
  success_count: number
  total_attempts: number
  success_rate: number
  last_success_at: string | null
  created_at: string
  updated_at: string
}

export type PatternLearningInsert = Omit<PatternLearning, 'id' | 'created_at' | 'updated_at'>

export interface DomainCache {
  company_name: string
  domain: string
  verified: boolean
  mx_records: unknown
  email_provider: string | null
  last_verified: string
}

export type DomainCacheInsert = DomainCache

export interface EmailResult {
  email: string
  pattern: string
  confidence: number
  learned?: boolean
  learnedData?: {
    attempts: number
    successRate: number
  }
}
