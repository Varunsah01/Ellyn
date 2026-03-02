# Database and Infrastructure

Last updated: 2026-03-02

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

- ✅ `user_profiles`
- ✅ `user_quotas`
- ✅ `contacts`
- ✅ `email_templates`
- ✅ `sequences`
- ✅ `sequence_steps`
- ✅ `sequence_enrollments`
- ✅ `sequence_enrollment_steps`
- ✅ `domain_cache`
- ✅ `pattern_learning`
- ✅ `domain_resolution_logs`
- ✅ `dodo_webhook_events`
- ✅ `activity_log`

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
