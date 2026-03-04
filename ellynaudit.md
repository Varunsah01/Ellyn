# Ellyn Platform Audit

**Date:** 2026-03-04
**Scope:** Web App, Chrome Extension, Supabase Database, API Routes, Security

---

## 1. Feature Completeness Audit

### 1.1 Core Features

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Email discovery pipeline (3-phase) | [x] Complete | Clearbit/Brandfetch/Google fallback chain |
| 2 | ZeroBounce email verification | [x] Complete | API integration + quota tracking |
| 3 | MX verification | [x] Complete | Free fallback when ZeroBounce unavailable |
| 4 | Pattern learning from feedback | [x] Complete | `lib/learning-system.ts`, `lib/pattern-learning.ts` |
| 5 | Domain resolution (v1 + v2) | [x] Complete | Both routes functional |
| 6 | SMTP probe | [x] Complete | External service + health check route |
| 7 | AI email drafting (Gemini) | [x] Complete | With Mistral + DeepSeek fallbacks |
| 8 | Email template system | [x] Complete | User + system templates, CRUD, categories |
| 9 | Contacts management | [x] Complete | CRUD, batch import, CSV export, tags, lead scoring |
| 10 | Leads management | [x] Complete | CRUD, status tracking |
| 11 | Sequences (outreach automation) | [x] Complete | Builder, steps, enrollment, execution |
| 12 | Sequence tracker (kanban + list) | [x] Complete | With 30s polling, stats bar |
| 13 | Deal pipeline (CRM) | [x] Complete | Stages, drag-drop, won/lost |
| 14 | Application tracker (job seeker) | [x] Complete | Stages, kanban board |
| 15 | Gmail OAuth integration | [x] Complete | Send, read, token encryption (AES-256-GCM) |
| 16 | Outlook OAuth integration | [x] Complete | Send, read, token encryption (AES-256-GCM) |
| 17 | Email open tracking (pixel) | [x] Complete | Tracking pixel injection + dedup |
| 18 | Email click tracking | [x] Complete | Link wrapping + redirect handler |
| 19 | Reply detection (cron) | [x] Complete | Hourly cron polls Gmail/Outlook threads |
| 20 | DodoPayments billing | [x] Complete | Webhook handler, subscription flow |
| 21 | Persona system (job_seeker / smb_sales) | [x] Complete | Context provider, route guards |
| 22 | Onboarding flow | [x] Complete | Multi-step, progress tracking |
| 23 | Admin dashboard | [x] Complete | Analytics, quota reset, template seeding |
| 24 | Chrome Extension | [x] Complete | Sidepanel, content scripts, auth bridge |
| 25 | Sentry error monitoring | [x] Complete | With sanitization and alerts |
| 26 | Analytics dashboard | [x] Complete | Charts, date range, performance metrics |
| 27 | Suppression list | [x] Complete | Email blacklist management |
| 28 | Notifications page | [x] Complete | Dashboard page exists |

### 1.2 Incomplete / Not Working

| # | Feature | Status | Issue | Severity |
|---|---------|--------|-------|----------|
| 1 | `AppRefreshContext` provider | [ ] Missing | `lib/context/AppRefreshContext.ts` is imported by 3 hooks (`useAnalytics`, `useContacts`, `useRealtimeManager`) but the file does NOT exist. Dashboard data won't auto-refresh after mutations. | **CRITICAL** |
| 2 | Redis/KV caching | [ ] Not configured | `KV_REST_API_URL` and `KV_REST_API_TOKEN` are empty in `.env.local`. Falls back to in-memory cache (lost on cold start). | MEDIUM |
| 3 | Google Custom Search API | [ ] Not configured | `GOOGLE_CUSTOM_SEARCH_API_KEY` = `your_key_here`. Domain resolution fallback chain is degraded. | LOW |
| 4 | Orphaned extension file | [ ] Cleanup needed | `/extension/sidepanel.js` (807 lines) is an old unused version. `scripts/sidepanel.js` (4278 lines) is the real one. Should delete the orphan. | LOW |
| 5 | Database mostly empty | [ ] No production data | Only `user_profiles` (2 rows) and `contacts` (5 rows) have data. All other 20 tables have 0 rows. | INFO |

---

## 2. Security Audit

| # | Area | Status | Finding | Severity |
|---|------|--------|---------|----------|
| 1 | Auth guard on API routes | [x] Secure | All protected routes verify `supabase.auth.getUser()` or `getAuthenticatedUserFromRequest()` | - |
| 2 | Admin endpoint protection | [x] Secure | Admin routes guarded by `admin-endpoint-guard.ts` + session auth | - |
| 3 | CSRF protection | [x] Secure | `lib/csrf.ts` generates tokens; extension sends `X-CSRF-Token` | - |
| 4 | Rate limiting | [x] Secure | `lib/rate-limit.ts` + extension 100 contacts/hour | - |
| 5 | Token encryption | [x] Secure | Gmail + Outlook tokens encrypted with AES-256-GCM (separate keys) | - |
| 6 | RLS (Row Level Security) | [x] Enabled | All 22 tables have RLS enabled with proper policies | - |
| 7 | Cron endpoint auth | [x] Secure | `CRON_SECRET` Bearer token validation | - |
| 8 | Webhook verification | [x] Secure | DodoPayments webhook secret validation | - |
| 9 | Input validation | [x] Secure | Zod schemas on all API request bodies | - |
| 10 | SQL injection | [x] Secure | Supabase SDK parameterized queries throughout | - |
| 11 | Extension origin validation | [x] Secure | `ALLOWED_ORIGINS` checked for external messages | - |
| 12 | Supabase anon key in extension | [x] Acceptable | Publishable key only; RLS prevents unauthorized access | - |
| 13 | Admin credentials hardcoded | [ ] **RISK** | `ADMIN_USERNAME=admin`, `ADMIN_PASSWORD=password123` in `.env.local`. Must change for production. | **HIGH** |
| 14 | Circuit breaker for external APIs | [x] Implemented | `lib/api-circuit-breaker.ts` prevents cascade failures | - |
| 15 | Sentry data sanitization | [x] Secure | `lib/monitoring/sentry-sanitize.ts` strips PII | - |
| 16 | `email_pattern_cache` public read | [ ] **RISK** | RLS policy `Anyone can read pattern cache` (qual=`true`) exposes all cached email patterns to any authenticated user. Competitors could harvest patterns. | **MEDIUM** |
| 17 | Duplicate RLS policies | [ ] Cleanup | `sequences` table has duplicate policy: "Users can manage own sequences" AND "Users manage own sequences" (identical). Should drop one. | LOW |
| 18 | Env vars not documented | [ ] Incomplete | 15+ env vars used in code but not listed in `lib/env.ts` OPTIONAL list (Gmail/Outlook OAuth, encryption keys, SMTP probe, admin secrets, cost controls). | LOW |

---

## 3. Supabase Database Audit

### 3.1 Tables (22 total)

| # | Table | Exists | Has Data | RLS | FK Relationships |
|---|-------|--------|----------|-----|-----------------|
| 1 | `ai_drafts` | [x] | [ ] 0 rows | [x] | contact_id -> contacts, template_id -> email_templates |
| 2 | `api_costs` | [x] | [ ] 0 rows | [x] | - |
| 3 | `application_stages` | [x] | [ ] 0 rows | [x] | - |
| 4 | `contacts` | [x] | [x] 5 rows | [x] | stage_id -> application_stages |
| 5 | `deals` | [x] | [ ] 0 rows | [x] | contact_id -> contacts |
| 6 | `dodo_webhook_events` | [x] | [ ] 0 rows | [x] | - |
| 7 | `domain_resolution_logs` | [x] | [ ] 0 rows | [x] | - |
| 8 | `email_history` | [x] | [ ] 0 rows | [x] | lead_id -> leads, sequence_enrollment_id -> sequence_enrollments |
| 9 | `email_pattern_cache` | [x] | [ ] 0 rows | [x] | - |
| 10 | `email_templates` | [x] | [ ] 0 rows | [x] | - |
| 11 | `email_tracking_events` | [x] | [ ] 0 rows | [x] | draft_id -> ai_drafts, contact_id -> contacts |
| 12 | `gmail_credentials` | [x] | [ ] 0 rows | [x] | - |
| 13 | `known_company_domains` | [x] | [ ] 0 rows | [x] | - |
| 14 | `leads` | [x] | [ ] 0 rows | [x] | - |
| 15 | `outlook_credentials` | [x] | [ ] 0 rows | [x] | - |
| 16 | `sequence_enrollment_steps` | [x] | [ ] 0 rows | [x] | enrollment_id -> sequence_enrollments, step_id -> sequence_steps |
| 17 | `sequence_enrollments` | [x] | [ ] 0 rows | [x] | sequence_id -> sequences, contact_id -> contacts |
| 18 | `sequence_steps` | [x] | [ ] 0 rows | [x] | sequence_id -> sequences, template_id -> email_templates |
| 19 | `sequences` | [x] | [ ] 0 rows | [x] | - |
| 20 | `suppression_list` | [x] | [ ] 0 rows | [x] | - |
| 21 | `user_profiles` | [x] | [x] 2 rows | [x] | - |
| 22 | `user_quotas` | [x] | [ ] 0 rows | [x] | - |

### 3.2 Missing Tables (referenced in code but NOT in Supabase)

| # | Table | Referenced By | Impact |
|---|-------|--------------|--------|
| 1 | `drafts` | `app/api/drafts/`, `app/api/v1/drafts/` | Draft management routes will 500. Not same as `ai_drafts`. |
| 2 | `outreach` | `app/api/analytics/`, contacts enrichment | Analytics outreach metrics won't work |
| 3 | `activity_log` | `app/api/activity/`, `lib/utils/recordActivity.ts` | Activity recording will fail silently |
| 4 | `sequence_events` | `app/api/v1/sequences/[id]/route.ts` (returns events) | Sequence event timeline won't populate |
| 5 | `notification_log` | Referenced in docs | Notification system won't work |
| 6 | `user_preferences` | Referenced in docs | User settings storage missing |
| 7 | `extension_heartbeat` | Referenced in docs | Extension health monitoring won't work |
| 8 | `integration_logs` | Referenced in docs | API call logging won't work |
| 9 | `lead_scores` | Referenced in lead scoring | Lead score computation will fail |

### 3.3 Database Issues

| # | Issue | Details | Fix |
|---|-------|---------|-----|
| 1 | `email_history.user_id` has no FK constraint | Column exists but no `REFERENCES auth.users(id)` enforcement | Add FK in migration |
| 2 | `email_history.contact_id` has no FK constraint | Column exists but no `REFERENCES contacts(id)` enforcement | Add FK in migration |
| 3 | Duplicate unique constraint on `sequence_enrollments` | Both `sequence_enrollments_sequence_contact_key` AND `sequence_enrollments_sequence_id_contact_id_key` exist | Drop one |
| 4 | Redundant index on `dodo_webhook_events.event_id` | Has both unique constraint (auto-index) AND explicit `idx_dodo_events_event_id` | Drop redundant index |
| 5 | `known_company_domains` uses `bigint` PK | All other tables use `uuid`. Inconsistent but not breaking. | Cosmetic |
| 6 | Duplicate RLS policy on `sequences` | "Users can manage own sequences" and "Users manage own sequences" are identical | Drop one |

---

## 4. API Route Coverage Audit

### 4.1 Routes That Reference Missing Tables

| # | Route | Missing Table | Impact |
|---|-------|--------------|--------|
| 1 | `POST /api/activity` | `activity_log` | Activity tracking fails |
| 2 | `GET/POST /api/drafts` | `drafts` | Draft management fails |
| 3 | `GET /api/v1/sequences/[id]` | `sequence_events` | Event history returns empty |
| 4 | Analytics routes | `outreach` | Outreach metrics return zeros |

### 4.2 V1 API Routes (All Exist)

| Category | Routes | Status |
|----------|--------|--------|
| Auth | signup, change-password, validate-password, gmail/outlook OAuth | [x] All exist |
| Contacts | CRUD, batch, import, export, tags, lead-score, stage | [x] All exist |
| Sequences | CRUD, enroll, execute, stats, reply | [x] All exist |
| AI | draft-email, enhance-draft, generate-template, customize-tone, adjust-tone, company-brief, enhance-template, infer-domain | [x] All exist |
| Analytics | user, admin, performance, schedule-report, track-email, track-lookup | [x] All exist |
| Email | gmail send, outlook send, status, disconnect | [x] All exist |
| Billing | checkout, invoices, portal, status, webhook | [x] All exist |
| Templates | CRUD, system templates | [x] All exist |
| Leads | CRUD | [x] All exist |
| Deals | CRUD, won, lost, stats | [x] All exist |
| Pipeline stages | CRUD, reorder | [x] All exist |
| Tracker | CRUD, stats | [x] All exist |
| Quota | check, status, rollback | [x] All exist |
| Suppression | CRUD | [x] All exist |
| Admin | quota reset, analytics, domain accuracy, verification cache, seed templates | [x] All exist |
| Cron | check-replies | [x] Exists |

---

## 5. Chrome Extension Audit

| # | Component | Status | Notes |
|---|-----------|--------|-------|
| 1 | Manifest V3 configuration | [x] Complete | Proper permissions, content scripts, CSP |
| 2 | Background service worker | [x] Complete | 13+ message types handled |
| 3 | Sidepanel UI | [x] Complete | `scripts/sidepanel.js` (4278 lines) |
| 4 | LinkedIn content scripts | [x] Complete | 3-tier extraction (JSON-LD, OpenGraph, DOM) |
| 5 | Auth bridge (web <-> extension) | [x] Complete | JWT token passing via `externally_connectable` |
| 6 | Contact sync (single + batch) | [x] Complete | With queue, fallback, retry |
| 7 | All API endpoints exist | [x] Complete | 27+ endpoints verified |
| 8 | Error reporting to Sentry | [x] Complete | `/api/extension-errors` route |
| 9 | Quota checking | [x] Complete | Pre-flight check before lookups |
| 10 | Origin validation | [x] Complete | `ALLOWED_ORIGINS` whitelist |
| 11 | Rate limiting | [x] Complete | 100 contacts/hour enforced |
| 12 | Orphaned `sidepanel.js` at root | [ ] Cleanup | Old 807-line version; `scripts/sidepanel.js` is authoritative |

---

## 6. Dashboard Pages Audit

| # | Page | Route | Status |
|---|------|-------|--------|
| 1 | Home dashboard | `/dashboard` | [x] Complete |
| 2 | Email discovery | `/dashboard/discovery` | [x] Complete |
| 3 | Contacts list | `/dashboard/contacts` | [x] Complete |
| 4 | Contact detail | `/dashboard/contacts/[id]` | [x] Complete |
| 5 | Leads list | `/dashboard/leads` | [x] Complete |
| 6 | Lead detail | `/dashboard/leads/[id]` | [x] Complete |
| 7 | Sequences list | `/dashboard/sequences` | [x] Complete |
| 8 | New sequence (gallery) | `/dashboard/sequences/new` | [x] Complete |
| 9 | Create sequence | `/dashboard/sequences/create` | [x] Complete |
| 10 | Sequence detail | `/dashboard/sequences/[id]` | [x] Complete |
| 11 | Edit sequence | `/dashboard/sequences/[id]/edit` | [x] Complete |
| 12 | Enroll contacts | `/dashboard/sequences/[id]/enroll` | [x] Complete |
| 13 | Pipeline (deals) | `/dashboard/pipeline` | [x] Complete |
| 14 | Templates | `/dashboard/templates` | [x] Complete |
| 15 | New template | `/dashboard/templates/new` | [x] Complete |
| 16 | Analytics | `/dashboard/analytics` | [x] Complete |
| 17 | Performance | `/dashboard/performance` | [x] Complete |
| 18 | Sent emails | `/dashboard/sent` | [x] Complete |
| 19 | Tracker | `/dashboard/tracker` | [x] Complete |
| 20 | Notifications | `/dashboard/notifications` | [x] Complete |
| 21 | Settings | `/dashboard/settings` | [x] Complete |
| 22 | Billing settings | `/dashboard/settings/billing` | [x] Complete |
| 23 | Upgrade | `/dashboard/upgrade` | [x] Complete |
| 24 | Billing upgrade | `/dashboard/billing/upgrade` | [x] Complete |

---

## 7. Environment Variables Audit

### 7.1 Configured and Working

| Variable | Status | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | [x] Set | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | [x] Set | Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | [x] Set | Server-side DB access |
| `NEXT_PUBLIC_APP_URL` | [x] Set | OAuth redirects |
| `ANTHROPIC_API_KEY` | [x] Set | Claude API |
| `GEMINI_API_KEY` | [x] Set | Gemini AI |
| `GOOGLE_AI_API_KEY` | [x] Set | Gemini (alternate key name) |
| `ZEROBOUNCE_API_KEY` | [x] Set | Email verification |
| `ABSTRACT_EMAIL_VALIDATION_API_KEY` | [x] Set | Email validation |
| `DODO_API_KEY` | [x] Set | DodoPayments |
| `DODO_WEBHOOK_SECRET` | [x] Set | Webhook verification |
| `GOOGLE_CLIENT_ID` | [x] Set | Gmail OAuth |
| `GOOGLE_CLIENT_SECRET` | [x] Set | Gmail OAuth |
| `GMAIL_TOKEN_ENCRYPTION_KEY` | [x] Set | AES-256-GCM encryption |
| `MICROSOFT_CLIENT_ID` | [x] Set | Outlook OAuth |
| `MICROSOFT_CLIENT_SECRET` | [x] Set | Outlook OAuth |
| `OUTLOOK_TOKEN_ENCRYPTION_KEY` | [x] Set | AES-256-GCM encryption |
| `ADMIN_SESSION_SECRET` | [x] Set | Admin auth |
| `ADMIN_USERNAME` | [x] Set | Admin login (CHANGE THIS) |
| `ADMIN_PASSWORD` | [x] Set | Admin login (CHANGE THIS) |
| `CRON_SECRET` | [x] Set | Cron job auth |
| `NEXT_PUBLIC_CHROME_EXTENSION_ID` | [x] Set | Extension communication |

### 7.2 Missing / Placeholder

| Variable | Status | Impact |
|----------|--------|--------|
| `GOOGLE_CUSTOM_SEARCH_API_KEY` | [ ] `your_key_here` | Domain resolution fallback degraded |
| `GOOGLE_SEARCH_ENGINE_ID` | [ ] `your_key_here` | Same as above |
| `KV_REST_API_URL` | [ ] Empty | No persistent Redis cache (uses in-memory) |
| `KV_REST_API_TOKEN` | [ ] Empty | Same |
| `KV_REST_API_READ_ONLY_TOKEN` | [ ] Empty | Same |
| `SMTP_PROBE_SERVICE_URL` | [ ] Not set | SMTP probe won't work |
| `SMTP_PROBE_SECRET` | [ ] Not set | SMTP probe auth |
| `DODO_PRO_PRODUCT_ID_GLOBAL_QUARTERLY` | [ ] Empty | Quarterly billing unavailable |
| `DODO_PRO_PRODUCT_ID_GLOBAL_YEARLY` | [ ] Empty | Yearly billing unavailable |
| `ERROR_MONITORING_WEBHOOK_URL` | [ ] Not set | No external error alerts |
| `EXTERNAL_API_BUDGET_DAILY_USD` | [ ] Not set | No API cost ceiling |
| `ADMIN_EMAILS` | [ ] Not set | Admin email whitelist |

---

## 8. Priority Action Items

### CRITICAL (Must Fix)

| # | Item | Details |
|---|------|---------|
| 1 | Create `lib/context/AppRefreshContext.ts` | Missing file imported by `useAnalytics`, `useContacts`, `useRealtimeManager`. Dashboard data refresh is broken without this. |
| 2 | Create missing DB tables | `drafts`, `outreach`, `activity_log`, `sequence_events` are referenced by API routes but don't exist in Supabase. Routes will 500. |
| 3 | Change admin credentials | `ADMIN_PASSWORD=password123` is insecure for any non-local environment. |

### HIGH (Should Fix)

| # | Item | Details |
|---|------|---------|
| 4 | Restrict `email_pattern_cache` RLS | Current policy allows ANY authenticated user to read ALL cached patterns. Change to service_role only or user-scoped. |
| 5 | Add FK constraints to `email_history` | `user_id` and `contact_id` columns have no foreign key enforcement. |
| 6 | Configure Redis (Vercel KV) | Without it, cached data is lost on every cold start. |
| 7 | Set up SMTP probe service | `SMTP_PROBE_SERVICE_URL` is empty; SMTP verification pathway is non-functional. |

### MEDIUM (Nice to Have)

| # | Item | Details |
|---|------|---------|
| 8 | Drop duplicate RLS policy on `sequences` | Two identical policies exist. |
| 9 | Drop duplicate unique constraint on `sequence_enrollments` | Two identical constraints exist. |
| 10 | Delete orphaned `/extension/sidepanel.js` | Old version causes confusion. |
| 11 | Configure Google Custom Search API | Improves domain resolution fallback chain. |
| 12 | Set quarterly/yearly Dodo product IDs | Only monthly billing works currently. |
| 13 | Document all 45+ env vars in `lib/env.ts` | 15+ vars are used but not in the validation list. |
| 14 | Drop redundant index on `dodo_webhook_events.event_id` | Unique constraint already creates an index. |

---

## 9. Summary Statistics

| Metric | Count |
|--------|-------|
| Total API routes | 127 |
| Dashboard pages | 24 |
| UI components | 70+ |
| Lib modules | 120+ |
| Supabase tables (existing) | 22 |
| Supabase tables (missing) | 5-9 |
| RLS policies | 42 |
| Foreign key relationships | 14 |
| Database indexes | 96 |
| Env vars (configured) | 22 |
| Env vars (missing/placeholder) | 12 |
| Extension files | 45+ |
| Extension API endpoints verified | 27 |
| Critical issues | 3 |
| High priority issues | 4 |
| Medium priority issues | 7 |
