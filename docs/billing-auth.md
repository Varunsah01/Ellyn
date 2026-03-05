# Billing and Authentication

Last updated: 2026-03-05

## Purpose

This document covers the payment/billing system (DodoPayments), authentication strategy (Supabase Auth), quota enforcement, and the admin authentication layer.

---

## Architecture Overview

### Payment Flow

```
User clicks "Upgrade" on /dashboard/upgrade
  │
  ▼
POST /api/v1/subscription/checkout
  ├── Validates plan_type + billing_cycle
  ├── Resolves Dodo product ID from env vars
  ├── Creates/reuses Dodo customer (user.email)
  ├── Creates subscription → returns payment_link
  └── Frontend redirects to DodoPayments checkout
  │
  ▼
User completes payment on DodoPayments
  │
  ▼
POST /api/v1/dodo/webhook (webhook callback)
  ├── Signature verification (HMAC)
  ├── Updates user_profiles: plan_type, subscription_id
  ├── Resets/adjusts user_quotas for new plan
  ├── Persists webhook event in dodo_webhook_events
  └── Returns 200
  │
  ▼
User returns to /dashboard/upgrade?upgraded=true
  ├── Success state shown
  └── SubscriptionContext.refresh() fetches new plan data
```

### Auth Flow

```
User visits /auth/signup
  ├── Client-side validation (Zod schema, password strength)
  ├── POST /api/v1/auth/signup
  │     ├── createServiceRoleClient().auth.admin.createUser()
  │     ├── Trigger: on_auth_user_created → creates user_profiles + user_quotas
  │     └── Returns { success, user }
  └── Redirect to /auth/login
  │
  ▼
User visits /auth/login
  ├── supabase.auth.signInWithPassword()
  ├── Session stored in HTTP-only cookie
  └── Redirect to /dashboard (or ?redirect= target)
```

### Key Design Decisions

1. **DodoPayments (not Stripe)**: Chosen for cost-effectiveness and regional pricing support. The `lib/dodo.ts` singleton is a lazy Proxy — it only initializes when first accessed, avoiding cold-start overhead.

2. **Legacy column naming**: `user_profiles.stripe_customer_id` and `stripe_subscription_id` were kept from an early prototype. They now store Dodo IDs — renaming was deemed too risky for a running production system.

3. **Webhook-driven plan updates**: Plan changes happen exclusively via webhook, not inline during checkout. This ensures consistency even if the user closes the tab during payment.

4. **Quota as separate table**: `user_quotas` is separate from `user_profiles` to allow independent quota resets (monthly cycle) without touching profile data.

---

## What Is Accomplished

### Authentication — Complete

| Feature | Status | Details |
|---------|--------|---------|
| Email/password signup | ✅ | Via service role admin API with password validation |
| Email/password login | ✅ | Supabase Auth with session cookie |
| Password reset (forgot) | ✅ | Via Supabase built-in flow |
| Password change | ✅ | `POST /api/v1/auth/change-password` (auth-required) |
| Password validation | ✅ | `POST /api/v1/auth/validate-password` with strength scoring |
| Session management | ✅ | HTTP-only cookies via `@supabase/ssr` |
| Token refresh | ✅ | `POST /api/auth/refresh-token` |
| CSRF protection | ✅ | `edge-csrf` middleware + `CsrfFetchProvider` component |
| Admin auth (separate) | ✅ | Token-based via `SECRET_ADMIN_TOKEN` header |
| Gmail OAuth | ✅ | Full OAuth 2.0 flow with CSRF state (see `docs/email-sending.md`) |
| Outlook OAuth | ✅ | Full OAuth 2.0 flow with CSRF state (see `docs/email-sending.md`) |
| Extension auth bridge | ✅ | `app/extension-auth/page.tsx` bridges session to Chrome Extension |

### Billing — Complete

| Feature | Status | Details |
|---------|--------|---------|
| DodoPayments integration | ✅ | `lib/dodo.ts` singleton with lazy initialization |
| Checkout flow | ✅ | Plan + cycle selection → Dodo subscription creation → payment_link redirect |
| Webhook handling | ✅ | Signature verification, plan updates, event persistence |
| Subscription status | ✅ | `GET /api/v1/subscription/status` returns plan, state, quotas |
| Customer portal | ✅ | `POST /api/v1/subscription/portal` returns Dodo portal link |
| Invoice listing | ✅ | `GET /api/v1/subscription/invoices` (graceful empty response) |
| Regional pricing | ✅ | `GET /api/v1/pricing-region` detects user region for pricing |
| Upgrade UX | ✅ | `/dashboard/upgrade` with monthly/quarterly/yearly toggle, plan comparison |
| Alternate upgrade entry | ✅ | `/dashboard/billing/upgrade` |
| Success state | ✅ | `?upgraded=true` shows success UI + refreshes subscription context |

### Quota System — Complete

| Feature | Status | Details |
|---------|--------|---------|
| Quota tracking | ✅ | `user_quotas` table tracks email_generations_used, ai_drafts_used |
| Quota enforcement | ✅ | `incrementEmailGeneration()` and `incrementAIDraftGeneration()` |
| Quota status API | ✅ | `GET /api/v1/quota/status` returns full usage breakdown |
| Quota check API | ✅ | `POST /api/v1/quota/check` pre-validates before action |
| Quota rollback | ✅ | `POST /api/v1/quota/rollback` undoes failed operation increments |
| Admin quota reset | ✅ | `POST /api/admin/quota/reset` for support operations |
| Quota warning banner | ✅ | Shows in dashboard when usage > 80% of limit |
| Upgrade prompt | ✅ | `components/subscription/UpgradePrompt.tsx` blocks free-plan AI features |

---

## What Is Not Yet Accomplished

| Feature | Status | Notes |
|---------|--------|-------|
| Plan downgrade handling | ⚠️ Partial | Webhook handles upgrades, but downgrade mid-cycle behavior is unclear |
| Prorated billing | ❌ Not started | DodoPayments may handle this, but not explicitly configured |
| Annual plan cancellation refunds | ❌ Not started | No refund policy enforcement in code |
| Usage-based billing overage | ❌ Not started | Hard limit only; no pay-as-you-go overage option |
| Multi-seat / team billing | ❌ Not started | Currently single-user only |
| Payment method update UI | ❌ Not started | Users must use Dodo customer portal |
| Billing history export | ❌ Not started | No PDF invoice download |
| Social login (Google/GitHub OAuth) | ❌ Not started | Only email/password auth for app login |
| Two-factor authentication | ❌ Not started | No 2FA support |
| API key authentication | ⚠️ Partial | `GET/POST /api/v1/account/api-key` routes exist, but usage may be limited |

---

## Auth Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `POST /api/v1/auth/signup` | POST | Creates auth user via service role admin API |
| `POST /api/v1/auth/change-password` | POST | Auth-required password update |
| `POST /api/v1/auth/validate-password` | POST | Validates password against policy without changing it |
| `GET /api/v1/auth/gmail` | GET | Initiates Google OAuth flow (CSRF state + redirect) |
| `GET /api/v1/auth/outlook` | GET | Initiates Microsoft OAuth flow (CSRF state + redirect) |
| `POST /api/auth/refresh-token` | POST | Refreshes auth session token |
| `POST /api/admin-auth/login` | POST | Admin login (token-based) |
| `POST /api/admin-auth/logout` | POST | Admin logout |

---

## Subscription/Billing Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `POST /api/v1/subscription/checkout` | POST | Plan + cycle validation, Dodo customer create/reuse, subscription creation, returns `payment_link` |
| `POST /api/v1/subscription/portal` | POST | Returns Dodo customer portal link for existing customer |
| `GET /api/v1/subscription/status` | GET | Returns plan, subscription state, quota usage/limits |
| `GET /api/v1/subscription/invoices` | GET | Returns `{ invoices: [] }` when no customer/invoices |
| `POST /api/v1/dodo/webhook` | POST | Signature verification + subscription state updates + event persistence |
| `GET /api/v1/pricing-region` | GET | Detects user pricing region |

---

## Quota Contracts (`lib/quota.ts`)

```ts
export class QuotaExceededError extends Error {
  constructor(feature: string, used: number, limit: number, plan_type: string)
}

export async function incrementEmailGeneration(
  userId: string
): Promise<{ used: number; limit: number; plan_type: string }>

export async function incrementAIDraftGeneration(
  userId: string
): Promise<{ used: number; limit: number; plan_type: string }>

export async function getUserQuota(userId: string): Promise<{
  email: { used: number; limit: number; remaining: number }
  ai_draft: { used: number; limit: number; remaining: number }
  reset_date: string | null
  period_start: string | null
  period_end: string | null
  plan_type: string
}>
```

### Plan Limits

| Plan | Email Lookups/mo | AI Drafts/mo | Price |
|------|-----------------|--------------|-------|
| Free | 50 | 0 | $0 |
| Starter | 500 | 150 | $14.99/mo, $39.99/qtr, $149/yr |
| Pro | 1,500 | 500 | $34.99/mo, $89.99/qtr, $279/yr |

### Quota 402 Response Shape

```json
{
  "error": "quota_exceeded",
  "feature": "email_generation",
  "used": 50,
  "limit": 50,
  "plan_type": "free",
  "upgrade_url": "/dashboard/upgrade"
}
```

---

## SMTP Probe Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `POST /api/v1/smtp-probe` | POST | Direct SMTP handshake verification (non-Google/MS domains) |
| `GET /api/v1/smtp-probe/health` | GET | Health check for SMTP probe service |
| `POST /api/v1/settings/test-smtp` | POST | Tests a custom SMTP configuration |

---

## Admin Auth Architecture

Admin routes are protected by two layers:

1. **Middleware-level**: Standard session check (same as dashboard)
2. **Endpoint-level**: `lib/auth/admin-endpoint-guard.ts`
   - Checks `SECRET_ADMIN_TOKEN` header
   - Optional `ADMIN_IP_WHITELIST` (comma-separated IPs)
   - Both must pass for the request to proceed

### Admin Auth Files

| File | Purpose |
|------|---------|
| `lib/auth/admin-credentials.ts` | Admin credential validation |
| `lib/auth/admin-endpoint-guard.ts` | Admin endpoint protection (token + IP) |
| `lib/auth/admin-session.ts` | Admin session management |
| `lib/auth/api-user.ts` | Extract user from API request |
| `lib/auth/client-fetch.ts` | Authenticated client-side fetch wrapper |
| `lib/auth/helpers.ts` | Auth helper utilities |

---

## Environment Variables

### Auth

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `SECRET_ADMIN_TOKEN` | Yes (admin) | Admin endpoint auth token |
| `ADMIN_IP_WHITELIST` | No | Comma-separated admin IP allowlist |

### Billing

| Variable | Required | Purpose |
|----------|----------|---------|
| `DODO_PAYMENTS_API_KEY` | Yes (billing) | DodoPayments API key |
| `DODO_PAYMENTS_WEBHOOK_KEY` | Yes (billing) | Webhook signature verification key |
| `DODO_PAYMENTS_ENVIRONMENT` | Yes (billing) | `test` or `live` |
| `DODO_STARTER_PRODUCT_ID_GLOBAL_MONTHLY` | Yes (billing) | Product ID for Starter monthly |
| `DODO_STARTER_PRODUCT_ID_GLOBAL_QUARTERLY` | Yes (billing) | Product ID for Starter quarterly |
| `DODO_STARTER_PRODUCT_ID_GLOBAL_YEARLY` | Yes (billing) | Product ID for Starter yearly |
| `DODO_PRO_PRODUCT_ID_GLOBAL_MONTHLY` | Yes (billing) | Product ID for Pro monthly |
| `DODO_PRO_PRODUCT_ID_GLOBAL_QUARTERLY` | Yes (billing) | Product ID for Pro quarterly |
| `DODO_PRO_PRODUCT_ID_GLOBAL_YEARLY` | Yes (billing) | Product ID for Pro yearly |

### Email OAuth

| Variable | Required | Purpose |
|----------|----------|---------|
| `GOOGLE_CLIENT_ID` | Yes (Gmail) | Google OAuth 2.0 Web Client ID |
| `GOOGLE_CLIENT_SECRET` | Yes (Gmail) | Google OAuth 2.0 Client Secret |
| `GMAIL_TOKEN_ENCRYPTION_KEY` | Yes (Gmail) | 64-char hex for AES-256-GCM |
| `MICROSOFT_CLIENT_ID` | Yes (Outlook) | Azure AD Application ID |
| `MICROSOFT_CLIENT_SECRET` | Yes (Outlook) | Azure AD Client Secret |
| `OUTLOOK_TOKEN_ENCRYPTION_KEY` | Yes (Outlook) | 64-char hex for AES-256-GCM |

---

## Security Measures

| Measure | Implementation |
|---------|---------------|
| CSRF protection | `edge-csrf` middleware generates/validates tokens |
| HTTP-only session cookies | `@supabase/ssr` handles cookie management |
| Row Level Security (RLS) | All core tables have RLS policies (hardened in migration 029) |
| Token encryption | AES-256-GCM for Gmail/Outlook OAuth tokens |
| Webhook signature verification | HMAC signature check on DodoPayments webhooks |
| Admin IP whitelist | Optional IP-based access restriction for admin routes |
| Password strength policy | Custom validation with common password list check |
| Rate limiting | `@upstash/ratelimit` with Redis-backed sliding window |
| Sentry error monitoring | Client + server + edge Sentry integration |
| RLS hardening | Migration 029 tightens policies across all core tables |
| Pattern cache RLS fix | Migration 036 removes open SELECT policy on `email_pattern_cache` |
