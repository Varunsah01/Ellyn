# Database and Infrastructure

Last updated: 2026-03-05

## Purpose

This document covers the database schema, all migrations, Redis caching, environment variables, deployment configuration, and infrastructure decisions.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ Vercel (Deployment)                                      │
│  ├── Next.js 14 App Router (Edge + Serverless Functions) │
│  ├── Sentry (Error Monitoring)                           │
│  └── Environment Variables                               │
└─────────────────────────────────────────────────────────┘
           │                    │
           ▼                    ▼
┌──────────────────┐  ┌──────────────────┐
│ Supabase         │  │ Vercel KV /      │
│  (PostgreSQL)    │  │ Upstash Redis    │
│  ├── Auth        │  │  ├── Domain cache│
│  ├── RLS         │  │  ├── MX cache    │
│  ├── Realtime    │  │  ├── Rate limits │
│  └── Storage     │  │  └── Session data│
└──────────────────┘  └──────────────────┘
           │
           ▼
┌──────────────────┐
│ External Services│
│  ├── DodoPayments│
│  ├── ZeroBounce  │
│  ├── Clearbit    │
│  ├── Brandfetch  │
│  ├── Google CSE  │
│  ├── Gemini API  │
│  ├── Gmail API   │
│  ├── MS Graph API│
│  └── Sentry      │
└──────────────────┘
```

### Key Infrastructure Decisions

1. **Supabase over raw Postgres**: Supabase provides auth, realtime subscriptions, RLS, and storage out of the box. This eliminated the need for a separate auth service, WebSocket server, and file storage solution.

2. **Vercel KV / Upstash Redis dual support**: Both `@vercel/kv` and `@upstash/redis` are configured. Vercel KV is used in production (deployed on Vercel), while Upstash can be used directly in development or non-Vercel environments.

3. **Edge + Serverless mix**: Middleware runs on Edge Runtime (for speed). API routes run on Serverless (Node.js) for full Node.js API access (crypto, DNS lookups, etc.).

4. **Numbered migrations**: SQL files are numbered and idempotent. They must be run manually in the Supabase SQL editor (no automated migration runner). This is intentional — production schema changes are carefully reviewed before application.

---

## Database Foundation

Primary baseline migration:

- `lib/db/migrations/000_ensure_complete_foundation.sql`
  - Idempotent schema creation / column backfill / constraints
  - RLS enabled for all core tables
  - Core indexes created
  - Contacts realtime publication enabled
  - Functions: `ensure_user_quota`, `handle_new_user`, `reset_expired_quotas`
  - Trigger: `on_auth_user_created` → auto-creates `user_profiles` + `user_quotas`

### Signup Automation

When a new `auth.users` record is created:
1. Trigger `on_auth_user_created` fires
2. Creates `user_profiles` row (plan_type = 'free')
3. Creates `user_quotas` row (with free plan limits)

---

## Core Tables

### Foundation Tables (migration 000)

| Table | Purpose | RLS |
|-------|---------|-----|
| `user_profiles` | Plan type, subscription IDs, persona, extension heartbeat | ✅ |
| `user_quotas` | Email lookup / AI draft quotas per billing period | ✅ |
| `contacts` | Core contact records (name, email, company, source, status) | ✅ |
| `email_templates` | User + system email templates | ✅ |
| `sequences` | Outreach sequence definitions | ✅ |
| `sequence_steps` | Individual steps per sequence | ✅ |
| `sequence_enrollments` | Contacts enrolled in sequences | ✅ |
| `sequence_enrollment_steps` | Per-step execution tracking | ✅ |
| `domain_cache` | Cached company → domain mappings | ✅ |
| `pattern_learning` | Email pattern success rates per domain | ✅ |
| `domain_resolution_logs` | Resolution attempt audit log | ✅ |
| `dodo_webhook_events` | DodoPayments webhook audit log | ✅ |
| `activity_log` | User activity feed | ✅ |

### Feature Tables (added by numbered migrations)

| Table | Migration | Purpose | RLS |
|-------|-----------|---------|-----|
| `ai_drafts` | 001 | AI-generated email drafts | ✅ |
| `email_lookups` | 001/004 | Email lookup analytics | ✅ |
| `api_costs` | 001/004 | API cost tracking | ✅ |
| `email_pattern_cache` | 001 | Pattern cache by domain | ✅ (hardened in 036) |
| `sequence_events` | 004 | Sequence execution events | ✅ |
| `email_tracking_events` | 012 | Open/click/reply tracking | ✅ |
| `application_stages` | 013 | Job seeker Kanban columns | ✅ |
| `deals` | 014 | B2B deal pipeline for SMB sales | ✅ |
| `suppression_list` | 015 | Email suppression/unsubscribe | ✅ |
| `application_tracker` | 024 | Simple job application tracker | ✅ |
| `leads` | 025 | Legacy lead records | ✅ |
| `gmail_credentials` | 025/027 | Gmail OAuth token storage (AES-256-GCM) | ✅ |
| `email_history` | 025/027/033 | Email send log with sequence linking | ✅ |
| `drafts` | 025/035 | User email drafts (separate from ai_drafts) | ✅ |
| `outreach` | 025 | Per-contact outreach events | ✅ |
| `outlook_credentials` | 031 | Outlook OAuth token storage (AES-256-GCM) | ✅ |
| `learned_patterns` | 037 | Aggregated domain+pattern intelligence | ✅ (service_role only) |
| `pattern_feedback_log` | 037 | User feedback on email patterns | ✅ |

### `contacts` Table — Column Notes

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
| `source` | 025 | contacts filter ('manual' \| 'extension' \| 'csv_import') |
| `last_contacted_at` | 025 | tracker analytics |
| `company_domain` | 025 | extension sync |
| `lead_score_cache` | 022 | contacts list enrichment |

`contacts.status` allows: `new`, `contacted`, `replied`, `no_response`, `discovered`, `sent`, `bounced` (updated in 025).

---

## Migration Inventory

| Migration | Status | Purpose |
|-----------|--------|---------|
| `000_ensure_complete_foundation.sql` | ✅ | Base schema, RLS, triggers, functions |
| `001_complete_foundation.sql` | ✅ | Extended schema (ai_drafts, email_lookups, api_costs, email_pattern_cache) |
| `003_activity_log.sql` | ✅ | Activity log table |
| `003_lean_schema.sql` | ✅ | Schema optimization |
| `003_lean_schema_rollback.sql` | ✅ | Rollback for lean schema (safety net) |
| `003_onboarding.sql` | ✅ | Onboarding tables |
| `003_quota_management.sql` | ✅ | Quota management functions |
| `004_analytics_tracking.sql` | ✅ | Analytics tracking tables |
| `004_sequences.sql` | ✅ | Sequence steps, enrollment steps, events |
| `005_email_prediction_learning.sql` | ✅ | Pattern learning tables |
| `006_subscription_quotas.sql` | ✅ | Subscription-quota linking |
| `007_email_report_schedule.sql` | ✅ | Scheduled report configuration |
| `007_quota_rollback.sql` | ✅ | Quota rollback function |
| `008_enable_contacts_realtime.sql` | ✅ | Supabase realtime for contacts |
| `008_starter_plan.sql` | ✅ | Starter plan configuration |
| `009_extension_heartbeat.sql` | ✅ | Extension heartbeat tracking |
| `010_rich_template_library.sql` | ✅ | Extended template schema |
| `010_user_persona.sql` | ✅ | User persona column |
| `011_template_categories.sql` | ✅ | Template category system |
| `012_email_tracking.sql` | ✅ | Email open/click tracking |
| `013_application_tracker.sql` | ✅ | Job application tracker stages |
| `014_deal_pipeline.sql` | ✅ | Deal pipeline for SMB sales |
| `015_suppression.sql` | ✅ | Email suppression list |
| `016_onboarding_progress.sql` | ✅ | Onboarding progress tracking |
| `017_onboarding_triggers.sql` | ✅ | Onboarding completion triggers |
| `018_system_template_rls.sql` | ✅ | RLS for system templates |
| `019_sequences_complete.sql` | ✅ | Complete sequence schema |
| `020_analytics_functions.sql` | ✅ | Stored functions for analytics |
| `021_default_stages.sql` | ✅ | Default pipeline stages |
| `022_lead_score_cache.sql` | ✅ | Lead score caching column |
| `023_sequence_tracker_columns.sql` | ✅ | Sequence tracking: opened_at, replied_at, skipped_at; attachments JSONB |
| `024_application_tracker.sql` | ✅ | Application tracker table |
| `025_complete_missing_tables.sql` | ✅ | Fills gaps: leads, gmail_credentials, email_history, drafts, outreach |
| `026_restore_contacts_columns.sql` | ✅ | Restores any dropped contact columns |
| `027_gmail_production.sql` | ✅ | Gmail production columns: gmail_email, token_expires_at, encrypted_version |
| `028_migration_tracking.sql` | ✅ | Migration audit/tracking table |
| `029_rls_hardening.sql` | ✅ | Tightens RLS policies across all core tables |
| `030_sequence_performance_stats.sql` | ✅ | Sequence performance columns + stored functions |
| `031_outlook_credentials.sql` | ✅ | Outlook OAuth credential storage |
| `033_email_tracking_enhancements.sql` | ✅ | idempotency_key on tracking events; sequence_enrollment_id + provider_thread_id on email_history |
| `033_run_in_supabase.sql` | ✅ | Supabase-specific execution wrapper |
| `034_all_missing_tables.sql` | ✅ | Combined missing tables (covers 004, 023, 025, 027, 031, 033) |
| `035_create_missing_tables.sql` | ✅ | Creates: drafts, activity_log, outreach, sequence_events (with RLS) |
| `036_harden_email_pattern_cache_rls.sql` | ✅ | Removes open SELECT policy on email_pattern_cache (security fix) |
| `037_intelligence_system.sql` | ✅ | learned_patterns + pattern_feedback_log tables; email_history FK fixes |
| `TEMPLATE.sql` | — | Template for new migrations |
| `verify_schema.sql` | — | Schema verification queries |

### Migration Notes

- **No migration 032**: Numbering skipped (032 was likely abandoned or merged into 033)
- **Two 033 files**: `033_email_tracking_enhancements.sql` (the actual migration) and `033_run_in_supabase.sql` (wrapper for execution in Supabase SQL editor)
- **034 is a combined migration**: Consolidates several earlier migrations for fresh installations
- **All migrations are idempotent**: Safe to run multiple times (IF NOT EXISTS, DO $$ guards)

---

## Redis/KV Caching

### Architecture

```
lib/cache/redis.ts
  ├── Vercel KV (@vercel/kv) — primary in production
  ├── Upstash Redis (@upstash/redis) — fallback / dev
  └── Graceful fallback: if Redis unavailable, operations return null
```

### What Is Cached

| Cache Key Pattern | TTL | Purpose |
|------------------|-----|---------|
| `domain:{company}` | 24h | Company → domain resolution results |
| `mx:{domain}` | 1h | MX record lookup results |
| `pattern:{domain}` | 24h | Email pattern cache for domain |
| `rate:{userId}:{action}` | 1min | Rate limiting counters |

### Cache Tags

`lib/cache/tags.ts` defines cache tag constants for invalidation.

### Design Decision: Why Redis + DB Caching?

- **Redis** for hot path (email lookup pipeline): sub-millisecond reads, TTL-based expiry
- **DB** (`domain_cache`, `email_pattern_cache`) for persistence: survives Redis eviction, queryable for analytics
- Pattern: Redis is checked first → DB fallback → API call → write to both Redis and DB

---

## Environment Variables

### Required (App Won't Function Without These)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |

### Optional — External Services

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | App base URL (used in OAuth redirects, email links) |
| `NEXT_PUBLIC_CHROME_EXTENSION_ID` | Chrome Extension ID (for CORS allowlist) |
| `GOOGLE_AI_API_KEY` | Gemini Flash 2.0 (pattern ranking, AI drafting) |
| `MISTRAL_API_KEY` | Mistral 3B fallback LLM |
| `DEEPSEEK_API_KEY` | DeepSeek R1 fallback LLM |
| `ZEROBOUNCE_API_KEY` | ZeroBounce email verification |
| `CLEARBIT_API_KEY` | Clearbit domain resolution |
| `GOOGLE_CUSTOM_SEARCH_API_KEY` | Google Custom Search (domain resolution) |
| `GOOGLE_SEARCH_ENGINE_ID` | Google CSE engine ID |

### Optional — Redis/KV

| Variable | Purpose |
|----------|---------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `KV_REST_API_URL` | Vercel KV REST URL |
| `KV_REST_API_TOKEN` | Vercel KV REST token |
| `KV_REST_API_READ_ONLY_TOKEN` | Vercel KV read-only token |

### Optional — Billing

| Variable | Purpose |
|----------|---------|
| `DODO_PAYMENTS_API_KEY` | DodoPayments API key |
| `DODO_PAYMENTS_WEBHOOK_KEY` | Webhook signature key |
| `DODO_PAYMENTS_ENVIRONMENT` | `test` or `live` |
| `DODO_STARTER_PRODUCT_ID_GLOBAL_MONTHLY` | Starter monthly product ID |
| `DODO_STARTER_PRODUCT_ID_GLOBAL_QUARTERLY` | Starter quarterly product ID |
| `DODO_STARTER_PRODUCT_ID_GLOBAL_YEARLY` | Starter yearly product ID |
| `DODO_PRO_PRODUCT_ID_GLOBAL_MONTHLY` | Pro monthly product ID |
| `DODO_PRO_PRODUCT_ID_GLOBAL_QUARTERLY` | Pro quarterly product ID |
| `DODO_PRO_PRODUCT_ID_GLOBAL_YEARLY` | Pro yearly product ID |
| `DODO_PRO_PRODUCT_ID_GLOBAL` | Pro product ID (generic) |

### Optional — Email OAuth

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Client Secret |
| `GMAIL_TOKEN_ENCRYPTION_KEY` | 64-char hex for AES-256-GCM |
| `MICROSOFT_CLIENT_ID` | Azure AD Application ID |
| `MICROSOFT_CLIENT_SECRET` | Azure AD Client Secret |
| `OUTLOOK_TOKEN_ENCRYPTION_KEY` | 64-char hex for AES-256-GCM |

### Optional — Monitoring & Admin

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN (client-side) |
| `SENTRY_DSN` | Sentry DSN (server-side) |
| `SENTRY_ORG` | Sentry organization slug |
| `SENTRY_PROJECT` | Sentry project slug |
| `SENTRY_AUTH_TOKEN` | Sentry auth token (source maps) |
| `ENABLE_DEBUG_ENDPOINTS` | Enable debug/test endpoints |
| `SECRET_ADMIN_TOKEN` | Admin endpoint auth token |
| `ADMIN_IP_WHITELIST` | Comma-separated admin IP allowlist |

---

## Deployment

### Platform: Vercel

- **Framework**: Next.js 14 (auto-detected by Vercel)
- **Build command**: `next build` (configured in `next.config.js`)
- **Sentry integration**: Source maps uploaded during build via `@sentry/nextjs`
- **Edge functions**: Middleware runs on Edge Runtime
- **Serverless functions**: API routes run on Node.js 18+
- **Environment variables**: Set in Vercel project settings (not committed)

### `next.config.js` Highlights

- Sentry plugin wraps the Next.js config
- Source maps enabled for production error tracking
- Custom headers for security (CSP, HSTS, etc.)

### Monitoring

| Tool | Purpose | Config File |
|------|---------|-------------|
| Sentry | Error tracking + performance | `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` |
| Web Vitals | Core Web Vitals reporting | `components/monitoring/WebVitalsReporter.tsx` |
| Instrumentation | Server-side tracing | `instrumentation.ts`, `instrumentation-client.ts` |

### Testing Infrastructure

| Tool | Config | Purpose |
|------|--------|---------|
| Jest | `jest.config.js` | Unit tests |
| Jest (integration) | `jest.integration.config.js` | Integration tests |
| Playwright | `playwright.config.ts` | E2E browser tests |
| Testing Library | `jest.setup.js` | DOM testing utilities |

---

## What Is Not Yet Accomplished (Infrastructure)

| Feature | Status | Notes |
|---------|--------|-------|
| Automated migration runner | ❌ | Migrations run manually in Supabase SQL editor |
| Database backups automation | ❌ | Relies on Supabase built-in backups |
| CI/CD pipeline | ⚠️ Partial | Vercel auto-deploys from Git, but no CI test runner configured |
| Staging environment | ❌ | No separate staging Supabase instance |
| Database connection pooling | ❌ | Uses Supabase direct connection (no PgBouncer config) |
| Redis cluster / failover | ❌ | Single Upstash Redis instance |
| Log aggregation | ⚠️ Partial | Sentry for errors, but no centralized log management |
| Health check endpoints | ⚠️ Partial | API root returns 200, SMTP probe has health check, but no comprehensive health dashboard |
| Feature flags | ❌ | No feature flag system (LaunchDarkly, etc.) |
| Database schema versioning | ⚠️ Partial | Migration 028 adds tracking table, but not fully utilized |
