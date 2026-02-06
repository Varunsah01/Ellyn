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

// ============================================================================
// Lead Management (From a previous implementation, may overlap with Contact)
// ============================================================================
export interface Lead {
  id: string;
  person_name: string;
  company_name: string;
  discovered_emails: EmailResult[];
  selected_email: string | null;
  status: "discovered" | "sent" | "bounced" | "replied";
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Contact Management
// ============================================================================

export interface Contact {
  id: string
  user_id: string

  // Contact Info
  first_name: string
  last_name: string
  full_name: string // computed field
  company: string
  role: string | null

  // Email
  inferred_email: string | null
  email_confidence: number | null
  confirmed_email: string | null

  // Enrichment Data
  company_domain: string | null
  company_industry: string | null
  company_size: string | null
  linkedin_url: string | null

  // Metadata
  source: 'manual' | 'extension' | 'csv_import'
  tags: string[]
  notes: string | null
  status: 'new' | 'contacted' | 'replied' | 'no_response'

  // Timestamps
  created_at: string
  updated_at: string
  last_contacted_at: string | null
}

// ============================================================================
// Email Drafts
// ============================================================================

export interface Draft {
  id: string
  user_id: string
  contact_id: string | null

  // Draft Content
  subject: string
  body: string

  // Template Reference
  template_id: string | null

  // Status
  status: 'draft' | 'sent' | 'scheduled'

  // Scheduling
  scheduled_for: string | null
  sent_at: string | null

  // Metadata
  personalization_variables: Record<string, any>

  // Timestamps
  created_at: string
  updated_at: string
}

// ============================================================================
// Email Templates
// ============================================================================

export interface EmailTemplate {
  id: string
  user_id: string | null

  // Template Content
  name: string
  subject: string
  body: string

  // Metadata
  category: 'referral' | 'follow_up' | 'coffee_chat' | 'info_interview' | 'custom'
  is_default: boolean
  use_count: number

  // Timestamps
  created_at: string
  updated_at: string
}

// ============================================================================
// API Usage Tracking
// ============================================================================

export interface ApiUsage {
  id: string
  user_id: string

  // API Details
  api_name: 'bright_data_company_enrichment' | 'bright_data_person_enrichment'
  endpoint: string

  // Request/Response
  request_params: Record<string, any> | null
  response_status: number | null
  response_time_ms: number | null

  // Cost Tracking
  cost_usd: number
  credits_used: number

  // Success/Error
  success: boolean
  error_message: string | null

  // Timestamps
  created_at: string
}

// ============================================================================
// User Settings
// ============================================================================

export interface UserSettings {
  user_id: string

  // Email Settings
  default_email_signature: string | null
  email_send_from: string | null

  // Notification Preferences
  notify_on_reply: boolean
  notify_on_bounce: boolean
  daily_summary_email: boolean

  // API Budget Limits
  monthly_api_budget_usd: number
  current_month_spend_usd: number

  // UI Preferences
  theme: 'light' | 'dark' | 'system'
  timezone: string

  // Timestamps
  created_at: string
  updated_at: string
}

// ============================================================================
// Pattern Learning (Machine Learning)
// ============================================================================

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

// ============================================================================
// Supporting Types
// ============================================================================

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
