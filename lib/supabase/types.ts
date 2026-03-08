// Database Types — moved from lib/supabase.ts
// Import from here instead of the legacy lib/supabase.ts module.

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
      application_tracker: TableDef<
        ApplicationTrackerRow,
        ApplicationTrackerInsert,
        Partial<ApplicationTrackerInsert>
      >
      email_lookups: TableDef<EmailLookupRow, EmailLookupInsert, Partial<EmailLookupInsert>>
      api_predictions: TableDef<ApiPredictionRow, ApiPredictionInsert, Partial<ApiPredictionInsert>>
      learned_patterns: TableDef<LearnedPatternRow, LearnedPatternInsert, Partial<LearnedPatternInsert>>
      pattern_feedback_log: TableDef<PatternFeedbackLogRow, PatternFeedbackLogInsert, Partial<PatternFeedbackLogInsert>>
      domain_cache: TableDef<DomainCache, DomainCacheInsert, Partial<DomainCacheInsert>>
      domain_resolution_cache: TableDef<
        DomainResolutionCacheRow,
        DomainResolutionCacheInsert,
        Partial<DomainResolutionCacheInsert>
      >
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
  extension_last_seen: string | null
  persona: 'job_seeker' | 'smb_sales' | null
  onboarding_completed: boolean | null
  onboarding_steps_completed: string[] | null
  plan_type: 'free' | 'starter' | 'pro'
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
  extension_last_seen?: string | null
  persona?: UserProfile['persona']
  onboarding_completed?: boolean | null
  onboarding_steps_completed?: string[] | null
  plan_type?: UserProfile['plan_type']
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
  stage_id: string | null
  applied_at: string | null
  interview_date: string | null
  job_url: string | null
  salary_range: string | null
  excitement_level: string | null
  lead_score_cache: Record<string, unknown> | null
  lead_score_grade: string | null
  lead_score_computed_at: string | null
  inference_pattern: string | null
  confidence_score: number | null
  created_at: string
  updated_at: string
}

export type ContactInsert = Pick<Contact, 'user_id' | 'first_name' | 'last_name' | 'company'> &
  Partial<
    Omit<
      Contact,
      'id' | 'full_name' | 'created_at' | 'updated_at' | 'user_id' | 'first_name' | 'last_name' | 'company'
    >
  >

export interface EmailTemplate {
  id: string
  user_id: string
  name: string
  subject: string
  body: string
  tone: 'professional' | 'casual' | 'friendly' | 'confident' | 'humble' | null
  use_case: string | null
  is_default: boolean
  is_system: boolean | null
  usage_count: number
  variables: string[] | null
  // Backward-compatible metadata fields used in current dashboard routes.
  category: string | null
  tags: string[] | null
  icon: string | null
  use_count: number | null
  created_at: string
  updated_at: string
}

export type EmailTemplateInsert = Pick<EmailTemplate, 'user_id' | 'name' | 'subject' | 'body'> &
  Partial<Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'name' | 'subject' | 'body'>>

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
  ai_draft_generations_used: number | null
  ai_draft_generations_limit: number | null
  period_start: string
  period_end: string
  reset_date: string | null
  updated_at: string
}

export type UserQuotaInsert = Pick<UserQuota, 'user_id' | 'period_start' | 'period_end'> &
  Partial<Omit<UserQuota, 'id' | 'updated_at' | 'user_id' | 'period_start' | 'period_end'>>

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

export interface ApplicationTrackerRow {
  id: string
  user_id: string
  company_name: string
  role: string
  status: 'saved' | 'applied' | 'interviewing' | 'offered' | 'rejected'
  applied_date: string | null
  notes: string | null
  job_url: string | null
  created_at: string
  updated_at: string
}

export type ApplicationTrackerInsert = Pick<
  ApplicationTrackerRow,
  'user_id' | 'company_name' | 'role'
> &
  Partial<Omit<ApplicationTrackerRow, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'company_name' | 'role'>>

export interface EmailLookupRow {
  id: string
  user_id: string
  profile_url: string | null
  domain: string
  email: string
  pattern: string
  confidence: number | null
  source: string
  cache_hit: boolean
  cost_usd: number
  duration_ms: number | null
  success: boolean
  created_at: string
}

export type EmailLookupInsert = Pick<
  EmailLookupRow,
  'user_id' | 'domain' | 'email' | 'pattern' | 'source'
> &
  Partial<Omit<EmailLookupRow, 'id' | 'created_at' | 'user_id' | 'domain' | 'email' | 'pattern' | 'source'>>

export interface ApiPredictionRow {
  id: string
  user_id: string
  company_domain: string
  top_pattern: string
  ai_latency_ms: number
  tokens_used: number
  estimated_cost: number
  created_at: string
}

export type ApiPredictionInsert = Pick<
  ApiPredictionRow,
  'user_id' | 'company_domain' | 'top_pattern'
> &
  Partial<Omit<ApiPredictionRow, 'id' | 'created_at' | 'user_id' | 'company_domain' | 'top_pattern'>>

export interface LearnedPatternRow {
  id: string
  company_domain: string
  pattern: string
  success_count: number
  failure_count: number
  confidence_boost: number
  injected: boolean
  last_verified: string
  created_at: string
  updated_at: string
}

export type LearnedPatternInsert = Omit<LearnedPatternRow, 'id' | 'created_at' | 'updated_at'>

export interface PatternFeedbackLogRow {
  id: string
  email: string | null
  pattern: string
  company_domain: string
  worked: boolean
  contact_id: string | null
  created_at: string
}

export type PatternFeedbackLogInsert = Omit<PatternFeedbackLogRow, 'id' | 'created_at'>

export interface DomainCache {
  company_name: string
  domain: string
  verified: boolean
  mx_records: unknown
  email_provider: string | null
  last_verified: string
}

export type DomainCacheInsert = DomainCache

export interface DomainResolutionCacheRow {
  company_name: string
  domain: string
  source: 'known_db' | 'clearbit' | 'brandfetch' | 'heuristic'
  timestamp: string
}

export type DomainResolutionCacheInsert = Pick<
  DomainResolutionCacheRow,
  'company_name' | 'domain' | 'source'
> &
  Partial<Pick<DomainResolutionCacheRow, 'timestamp'>>

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
