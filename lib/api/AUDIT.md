# API Route Audit — B1–B8 Hardening Pass

## Legend
- ✅ Verified / implemented
- ⚠️ Partial / relies on helper
- ❌ Not applicable / not present

## Checklist columns
| Column | Meaning |
|--------|---------|
| Auth | User ID validated server-side |
| Validation | All request bodies parsed with Zod |
| Rate limit | Per-user request throttling applied |
| Plan limit | Checked before creating new records |
| user_id filter | All DB queries scoped to authenticated user |
| Fire-and-forget | Logging is non-blocking |

---

## B1 — Onboarding / Persona

| Route | Auth | Validation | Rate limit | Plan limit | user_id filter | F&F |
|-------|------|-----------|-----------|-----------|---------------|-----|
| `GET /api/v1/user/persona` | ✅ | n/a | ❌ | n/a | ✅ | n/a |
| `PATCH /api/v1/user/persona` | ✅ | ✅ Zod | ✅ 10/hr | n/a | ✅ | n/a |

---

## B2 — Application Tracker (Job Seeker)

| Route | Auth | Validation | Rate limit | Plan limit | user_id filter | F&F |
|-------|------|-----------|-----------|-----------|---------------|-----|
| `GET /api/v1/stages` | ✅ requirePersona | n/a | ❌ read | n/a | ✅ | n/a |
| `POST /api/v1/stages` | ✅ requirePersona | ✅ Zod | ❌ low volume | ⚠️ 15-stage cap | ✅ | n/a |
| `PATCH /api/v1/stages/[id]` | ✅ requirePersona | ✅ Zod | ❌ low volume | n/a | ✅ | n/a |
| `DELETE /api/v1/stages/[id]` | ✅ requirePersona | n/a | ❌ low volume | n/a | ✅ | n/a |
| `POST /api/v1/stages/reorder` | ✅ requirePersona | ✅ Zod | ✅ 30/hr | n/a | ✅ | n/a |
| `PATCH /api/v1/contacts/[id]/stage` | ✅ requirePersona | ✅ Zod | ❌ low volume | n/a | ✅ | ✅ activity_log |
| `PATCH /api/v1/contacts/[id]/application` | ✅ requirePersona | ✅ Zod | ❌ low volume | n/a | ✅ | n/a |
| `GET /api/v1/tracker/stats` | ✅ requirePersona | n/a | ❌ read | n/a | ✅ | n/a |

---

## B3 — Deal Pipeline (SMB Sales)

| Route | Auth | Validation | Rate limit | Plan limit | user_id filter | F&F |
|-------|------|-----------|-----------|-----------|---------------|-----|
| `GET /api/v1/deals` | ✅ requirePersona | n/a | ❌ read | n/a | ✅ | n/a |
| `POST /api/v1/deals` | ✅ requirePersona | ✅ Zod | ✅ 30/hr | ✅ checkPlanLimit | ✅ | n/a |
| `GET /api/v1/deals/[id]` | ✅ requirePersona | n/a | ❌ read | n/a | ✅ | n/a |
| `PATCH /api/v1/deals/[id]` | ✅ requirePersona | ✅ Zod | ❌ low volume | n/a | ✅ | n/a |
| `DELETE /api/v1/deals/[id]` | ✅ requirePersona | n/a | ❌ low volume | n/a | ✅ | n/a |
| `POST /api/v1/deals/[id]/won` | ✅ requirePersona | ✅ Zod | ❌ low volume | n/a | ✅ | ✅ recordActivity |
| `POST /api/v1/deals/[id]/lost` | ✅ requirePersona | ✅ Zod | ❌ low volume | n/a | ✅ | ✅ recordActivity |
| `GET /api/v1/deals/stats` | ✅ requirePersona | n/a | ❌ read | n/a | ✅ | n/a |

---

## B4 — Batch Import / Lead Score / Suppression

| Route | Auth | Validation | Rate limit | Plan limit | user_id filter | F&F |
|-------|------|-----------|-----------|-----------|---------------|-----|
| `POST /api/v1/contacts/import` | ✅ | ✅ Zod | ✅ 5/hr | ✅ checkPlanLimit | ✅ | n/a |
| `POST /api/v1/contacts/batch` | ✅ | ✅ Zod | ✅ 20/hr | ⚠️ no new records | ✅ | n/a |
| `POST /api/v1/contacts/[id]/lead-score` | ✅ | n/a | ❌ low volume | n/a | ✅ | n/a |
| `POST /api/admin/refresh-lead-scores` | ✅ adminGuard | n/a | n/a (admin) | n/a | ✅ | n/a |
| `GET /api/v1/suppression` | ✅ | n/a | ❌ read | n/a | ✅ | n/a |
| `POST /api/v1/suppression` | ✅ | ✅ Zod | ❌ low volume | n/a | ✅ | n/a |
| `DELETE /api/v1/suppression/[email]` | ✅ | n/a | ❌ low volume | n/a | ✅ | n/a |

---

## B5 — Sequences (Enroll + Execute + Reply)

| Route | Auth | Validation | Rate limit | Plan limit | user_id filter | F&F |
|-------|------|-----------|-----------|-----------|---------------|-----|
| `POST /api/sequences/[id]/enroll` | ✅ | ✅ Zod | ✅ 10/hr | ✅ enrollmentLimits | ✅ | n/a |
| `GET /api/sequences/execute` | ✅ | n/a | ❌ read | n/a | ✅ | n/a |
| `POST /api/sequences/execute` | ✅ | ✅ Zod | ✅ 60/hr | n/a | ✅ | ✅ tracking events |
| `POST /api/sequences/reply` | ✅ | ✅ Zod | ❌ low volume | n/a | ✅ | ✅ suppression upsert |

---

## New Infrastructure

| File | Purpose |
|------|---------|
| `lib/api/response.ts` | Standardized `ok()` / `err()` / `unauthorized()` / `notFound()` / `quotaExceeded()` / `validationError()` helpers |
| `lib/api/validate.ts` | `parseBody()` — Zod schema parsing with structured error response |
| `lib/api/auth.ts` | `getAuthUser()` — discriminated union auth, no throwing |
| `lib/rate-limit.ts` | `checkApiRateLimit()` + `rateLimitExceeded()` — sliding window, fail-open |
| `lib/plan-limits.ts` | `PLAN_LIMITS`, `getLimit()`, `checkPlanLimit()` — single source of truth for plan caps |
| `lib/env.ts` | Zod env schema — validates required env vars at import time |
| `lib/context/AppRefreshContext.tsx` | Extended `RefreshScope` with `'deals'` and `'stages'` |
| `hooks/useRealtimeManager.ts` | Single Supabase Realtime channel for all dashboard tables |
| `lib/db/migrations/022_lead_score_cache.sql` | `lead_score_cache`, `lead_score_grade`, `lead_score_computed_at` columns on `contacts` |
| `lib/suppression.ts` | `isSuppressed()` / `filterSuppressed()` utility |

---

## Known Gaps / Future Work

- `lib/api/response.ts` helpers not yet applied to all legacy routes (safe to add incrementally)
- `lib/api/auth.ts` `getAuthUser()` not yet wired to all routes (existing `getAuthenticatedUser` still used; both are valid)
- `lib/env.ts` imported in new routes only; existing routes still use `process.env` directly
- Rate limiting not applied to low-volume CRUD operations (PATCH/DELETE individual records) — acceptable given low attack surface

---

## Service-role-only configuration tables

- `public.system_configs` is intentionally **not client-accessible**.
- RLS is `service_role`-only in migration `040_system_configs.sql`, and direct reads/writes from normal client JWTs (`anon`/`authenticated`) are blocked.
- Any future API endpoint touching system configs must use trusted server-side credentials (service role) and enforce explicit admin authorization in route logic before mutation.
