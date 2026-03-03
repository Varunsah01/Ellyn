# Database and Infrastructure

Last updated: 2026-03-03

## Database Foundation

Primary baseline migration:

- ✅ `lib/db/migrations/000_ensure_complete_foundation.sql`
  - Idempotent schema creation/column backfill/constraints
  - RLS enabled for all core tables
  - Core indexes created
  - Contacts realtime publication enabled
  - Functions created: `ensure_user_quota`, `handle_new_user`, `reset_expired_quotas`
  - Trigger created: `on_auth_user_created`

Signup automation status:

- ✅ New `auth.users` records automatically create:
  - `user_profiles`
  - `user_quotas`

## Core Tables (Present)

### Foundation Tables (000)
- ✅ `user_profiles` — plan, subscription, persona, extension heartbeat
- ✅ `user_quotas` — email lookup / AI draft quotas per billing period
- ✅ `contacts` — core contact records (see column notes below)
- ✅ `email_templates` — user + system templates
- ✅ `sequences` — outreach sequence definitions
- ✅ `sequence_steps` — individual steps per sequence
- ✅ `sequence_enrollments` — contacts enrolled in sequences
- ✅ `sequence_enrollment_steps` — per-step execution tracking
- ✅ `domain_cache` — cached company→domain mappings
- ✅ `pattern_learning` — email pattern success rates per domain
- ✅ `domain_resolution_logs` — resolution attempt audit log
- ✅ `dodo_webhook_events` — DodoPayments webhook audit log
- ✅ `activity_log` — user activity feed

### Feature Tables (added by numbered migrations)
- ✅ `ai_drafts` — AI-generated email drafts (001)
- ✅ `email_lookups` — email lookup analytics (001/004)
- ✅ `api_costs` — API cost tracking (001/004)
- ✅ `email_pattern_cache` — pattern cache by domain (001)
- ✅ `sequence_events` — sequence execution events (004)
- ✅ `email_tracking_events` — open/click/reply tracking (012)
- ✅ `application_stages` — job seeker Kanban columns (013)
- ✅ `deals` — B2B deal pipeline for SMB sales (014)
- ✅ `suppression_list` — email suppression/unsubscribe (015)
- ✅ `application_tracker` — simple job application tracker (024)

### Tables Added by Migration 025 (previously missing)
- ✅ `leads` — legacy lead records (used by /api/leads/ and Gmail send)
- ✅ `gmail_credentials` — Gmail OAuth token storage
- ✅ `email_history` — Gmail send log
- ✅ `drafts` — email drafts (separate from ai_drafts; used by /api/drafts/)
- ✅ `outreach` — per-contact outreach events (analytics, /api/contacts/ enrichment)

### contacts Table — Column Notes
Two generations of schema coexist (both supported after migration 025):

| Column | Source | Used by |
|--------|--------|---------|
| `company_name` | 000 baseline | v1/contacts routes |
| `company` | 001 / extension | batch import, extension sync, analytics |
| `full_name` | generated | drafts foreign-key join |
| `inferred_email` | 025 | extension, contacts route, analytics |
| `confirmed_email` | 025 | analytics email patterns |
| `email_confidence` | 025 | contacts sort/filter (0–100 scale) |
| `email_verified` | 025 | extension sync |
| `source` | 025 | contacts filter ('manual'\|'extension'\|'csv_import') |
| `last_contacted_at` | 025 | tracker analytics |
| `company_domain` | 025 | extension sync |
| `lead_score_cache` | 022 | contacts list enrichment |

`contacts.status` now allows: `new`, `contacted`, `replied`, `no_response`, `discovered`, `sent`, `bounced` (updated in 025).

## Migration Inventory

| Migration | Status |
| --- | --- |
| `000_ensure_complete_foundation.sql` | ✅ complete |
| `001_complete_foundation.sql` | ✅ present |
| `003_activity_log.sql` | ✅ present |
| `003_lean_schema.sql` | ✅ present |
| `003_onboarding.sql` | ✅ present |
| `003_quota_management.sql` | ✅ present |
| `004_analytics_tracking.sql` | ✅ present |
| `004_sequences.sql` | ✅ present |
| `005_email_prediction_learning.sql` | ✅ present |
| `006_subscription_quotas.sql` | ✅ present |
| `007_email_report_schedule.sql` | ✅ present |
| `007_quota_rollback.sql` | ✅ present |
| `008_enable_contacts_realtime.sql` | ✅ present |
| `008_starter_plan.sql` | ✅ present |
| `009_extension_heartbeat.sql` | ✅ present |
| `010_rich_template_library.sql` | ✅ present |
| `010_user_persona.sql` | ✅ present |
| `011_template_categories.sql` | ✅ present |
| `012_email_tracking.sql` | ✅ present |
| `013_application_tracker.sql` | ✅ present |
| `014_deal_pipeline.sql` | ✅ present |
| `015_suppression.sql` | ✅ present |
| `016_onboarding_progress.sql` | ✅ present |
| `017_onboarding_triggers.sql` | ✅ present |
| `018_system_template_rls.sql` | ✅ present |
| `019_sequences_complete.sql` | ✅ present |
| `020_analytics_functions.sql` | ✅ present |
| `021_default_stages.sql` | ✅ present |
| `022_lead_score_cache.sql` | ✅ present |
| `023_sequence_tracker_columns.sql` | ✅ present |
| `024_application_tracker.sql` | ✅ present |
| `025_complete_missing_tables.sql` | ✅ present — **run this** |

## Environment Variables

### Required

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Optional

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_CHROME_EXTENSION_ID`
- `GOOGLE_AI_API_KEY`
- `MISTRAL_API_KEY`
- `DEEPSEEK_API_KEY`
- `ZEROBOUNCE_API_KEY`
- `CLEARBIT_API_KEY`
- `GOOGLE_CUSTOM_SEARCH_API_KEY`
- `GOOGLE_SEARCH_ENGINE_ID`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`
- `DODO_PAYMENTS_API_KEY`
- `DODO_PAYMENTS_WEBHOOK_KEY`
- `DODO_PAYMENTS_ENVIRONMENT`
- `DODO_STARTER_PRODUCT_ID_GLOBAL_MONTHLY`
- `DODO_STARTER_PRODUCT_ID_GLOBAL_QUARTERLY`
- `DODO_STARTER_PRODUCT_ID_GLOBAL_YEARLY`
- `DODO_PRO_PRODUCT_ID_GLOBAL_MONTHLY`
- `DODO_PRO_PRODUCT_ID_GLOBAL_QUARTERLY`
- `DODO_PRO_PRODUCT_ID_GLOBAL_YEARLY`
- `DODO_PRO_PRODUCT_ID_GLOBAL`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_DSN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_AUTH_TOKEN`
- `ENABLE_DEBUG_ENDPOINTS`
- `SECRET_ADMIN_TOKEN`
- `ADMIN_IP_WHITELIST`
