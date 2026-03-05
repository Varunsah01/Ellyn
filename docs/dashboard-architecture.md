# Dashboard Architecture

Last updated: 2026-03-05

## Purpose

This document describes HOW the Ellyn dashboard works at an architectural level: the provider tree, authentication flow, middleware, data loading patterns, admin dashboard, and all major user flows.

---

## Architecture Diagram

```
Browser Request
  │
  ▼
middleware.ts (Edge)
  ├── /dashboard/** → session check → redirect to /auth/login if missing
  ├── /tracker/** → session check
  ├── /admin/** → session check
  └── Public allowlist → pass through
  │
  ▼
app/dashboard/layout.tsx (Server Component)
  ├── Server-side session check (defense-in-depth)
  └── Renders provider tree:
      │
      SubscriptionProvider
        └── PersonaProvider
              └── DashboardShell (withChrome)
                    ├── Sidebar (persona-aware nav)
                    ├── QuotaWarningBanner
                    └── {children} ← page content
```

### Design Rationale

1. **Double auth check (middleware + layout)**: The middleware is the primary gate, but the layout performs a redundant check. This prevents any edge case where middleware might be bypassed (e.g., during Vercel ISR regeneration or client-side navigation bugs).

2. **Provider tree ordering**: `SubscriptionProvider` wraps `PersonaProvider` because persona changes can trigger subscription context refreshes (different features per persona).

3. **Shell as chrome owner**: `DashboardShell` owns all persistent UI (sidebar, header, banner) so individual pages don't need to manage layout chrome.

---

## Auth and Routing Flow

### Step-by-Step

1. **Request arrives** → `middleware.ts` runs on all requests
2. **Route classification**:
   - Protected: `/dashboard/**`, `/tracker/**`, `/admin/**`
   - Public allowlist: `/`, `/auth/**`, `/api/v1/auth/**`, `/api/v1/pricing-region`, `/api/webhooks/**`, `/api/track/**`
3. **Session check**: Middleware reads Supabase session from HTTP-only cookie
4. **No session** → `302` redirect to `/auth/login?redirect=<originalPath>`
5. **Has session** → request continues to page/API route
6. **Layout check** (server component): `app/dashboard/layout.tsx` re-checks session, redirects if missing

### Auth Pages

| Page | Purpose |
|------|---------|
| `/auth/login` | Login with email/password or OAuth |
| `/auth/signup` | Registration with password strength indicator |
| `/auth/forgot-password` | Password reset flow via Supabase |
| `/auth/callback` | OAuth callback handler (route handler) |

### Auth Components

- `components/auth/AuthFormLayout.tsx` — shared layout for auth pages (logo, card, background)
- `components/auth/PasswordStrengthIndicator.tsx` — real-time password strength feedback

---

## Supabase Client Layers

| Client | File | Use Case | Auth Level |
|--------|------|----------|------------|
| `createServiceRoleClient()` | `lib/supabase/server.ts` | API routes, admin ops, bypasses RLS | Service role (full access) |
| `createClient()` (server) | `lib/supabase/server.ts` | Server components, session reads | Request-scoped user session |
| `createClient()` (browser) | `lib/supabase/client.ts` | Client components, realtime | Anon key + user session cookie |

### Why Two Server Clients?

- `createServiceRoleClient()` bypasses Row Level Security — used when the API route needs to read/write data that RLS would block (e.g., admin operations, cross-user queries)
- `createClient()` (server) respects RLS — used when the route should only access the authenticated user's data

**Convention**: All API routes use `createServiceRoleClient()` (async, must be awaited) for database operations. The service role client is safe because each API route independently validates `auth.getUser()` before proceeding.

---

## Provider Tree

### `context/SubscriptionContext.tsx`

**What it does:**
- Fetches `GET /api/v1/subscription/status` on mount
- Stores: `plan_type`, `subscription_status`, `email_used/limit`, `ai_draft_used/limit`, `period_start/end`
- Exposes `refresh()` for on-demand re-fetch (called after checkout, plan change, etc.)

**What it provides:**
```ts
{
  plan: 'free' | 'starter' | 'pro'
  isLoading: boolean
  emailUsed: number
  emailLimit: number
  aiDraftUsed: number
  aiDraftLimit: number
  refresh: () => Promise<void>
}
```

### `context/PersonaContext.tsx`

**What it does:**
- Reads persona from localStorage (fast initial render)
- Verifies against server via `GET /api/v1/user/persona`
- Persists changes via `PATCH /api/v1/user/persona`

**What it provides:**
```ts
{
  persona: 'job_seeker' | 'smb_sales'
  setPersona: (p: Persona) => Promise<void>
  isJobSeeker: boolean
  isSalesRep: boolean
}
```

**Design decision**: localStorage bootstrap prevents a flash of wrong persona on page load. Server sync ensures consistency if persona was changed on another device.

---

## Dashboard Shell

`components/dashboard/DashboardShell.tsx` provides:

| Feature | Implementation |
|---------|---------------|
| Sidebar (desktop) | Fixed left panel with persona-aware nav items |
| Mobile sidebar | Collapsible hamburger menu |
| Persona toggle | Wired to `PersonaContext.setPersona` |
| User profile block | Avatar, name, plan badge |
| Plan badge | `components/subscription/PlanBadge.tsx` — shows current plan |
| Quota warning banner | `components/subscription/QuotaWarningBanner.tsx` — shows at 80% usage |
| Main content container | Scrollable area for page content |

### Sidebar Navigation (Persona-Aware)

Navigation items are defined in `lib/constants/navigation.ts`:

| Item | Job Seeker | SMB Sales |
|------|-----------|-----------|
| Home | ✅ | ✅ |
| Discovery | ✅ | ✅ |
| Contacts | ✅ | ✅ |
| Tracker | ✅ | ❌ |
| Pipeline | ❌ | ✅ |
| Leads | ❌ | ✅ |
| Sequences | ✅ | ✅ |
| Templates | ✅ | ✅ |
| Analytics | ✅ | ✅ |
| Performance | ✅ | ✅ |
| Sent | ✅ | ✅ |
| Settings | ✅ | ✅ |

---

## Onboarding Flow

### Architecture

```
New user signs up
  │
  ▼
PersonaOnboardingGate checks persona
  ├── No persona set → PersonaOnboardingModal (choose job_seeker or smb_sales)
  └── Persona set → Dashboard renders normally
  │
  ▼
OnboardingChecklist (dashboard home)
  ├── Tracks completion of: connect email, find first contact, create template, etc.
  └── Persisted via GET/PATCH /api/v1/user/onboarding (migration 016)
```

### Files

| File | Purpose |
|------|---------|
| `lib/onboarding.ts` | Onboarding step definitions and completion logic |
| `components/dashboard/OnboardingChecklist.tsx` | Dashboard home widget showing next steps |
| `components/dashboard/PersonaOnboardingModal.tsx` | First-time persona selection modal |
| `components/dashboard/PersonaOnboardingGate.tsx` | Blocks access until persona is selected |

### What's Accomplished

- ✅ Persona selection modal on first login
- ✅ Onboarding checklist on dashboard home
- ✅ Server-side onboarding progress persistence
- ✅ Onboarding triggers (migration 017)

### What's Not Accomplished

- ❌ Interactive dashboard tour (components exist: `DashboardTour.tsx`, `OnboardingTour.tsx` — but may not be fully wired)
- ❌ Email-based onboarding drip campaign
- ❌ Progressive feature unlocking based on onboarding completion

---

## Error and Loading Boundaries

| File | Purpose |
|------|---------|
| `app/dashboard/error.tsx` | React error boundary for all dashboard routes. Shows error message + retry button. |
| `app/dashboard/loading.tsx` | Global loading skeleton for dashboard route transitions. |

---

## Middleware

`middleware.ts` runs on all requests:

### Route Protection Rules

| Pattern | Behavior |
|---------|----------|
| `/dashboard/**` | Session required → redirect to login |
| `/tracker/**` | Session required → redirect to login |
| `/admin/**` | Session required → redirect to login |
| `/`, `/auth/**` | Public (pass through) |
| `/api/v1/auth/**` | Public (auth routes) |
| `/api/v1/pricing-region` | Public (pre-auth pricing) |
| `/api/webhooks/**` | Public (webhook endpoints) |
| `/api/track/**` | Public (email tracking pixels) |
| All other `/api/**` | Pass through (API routes handle their own auth) |

### Rate Limiting

- `middleware/rate-limit.ts` — rate limiting middleware integration
- Applied via `@upstash/ratelimit` with Redis-backed sliding window

---

## Admin Dashboard

### Architecture

Admin pages live under `app/admin/` and are protected by two layers:
1. **Middleware**: Same session check as dashboard routes
2. **Admin guard**: `lib/auth/admin-endpoint-guard.ts` checks `SECRET_ADMIN_TOKEN` header + optional `ADMIN_IP_WHITELIST`

### Admin Pages

| Page | Purpose | Status |
|------|---------|--------|
| `/admin/login` | Admin login (token-based) | ✅ |
| `/admin/dashboard` | Admin home with overview stats | ✅ |
| `/admin/dashboard/users` | User management: view all users, reset quotas | ✅ |
| `/admin/dashboard/integrations` | Integration health monitoring (Gmail, Outlook, ZeroBounce) | ✅ |
| `/admin/dashboard/verification` | Email verification statistics and charts | ✅ |
| `/admin/dashboard/domain-accuracy` | Domain resolution accuracy charts | ✅ |

### Admin API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/admin-auth/login` | Admin login |
| `POST /api/admin-auth/logout` | Admin logout |
| `GET /api/admin/domain-accuracy` | Domain accuracy metrics |
| `POST /api/admin/inject-patterns` | Inject known email patterns |
| `POST /api/admin/quota/reset` | Reset user quota |
| `POST /api/admin/refresh-lead-scores` | Recalculate all lead scores |
| `POST /api/admin/seed-templates` | Seed system email templates |
| `GET /api/admin/verification-cache` | Verification cache stats |
| `GET /api/admin/verification-stats` | Verification accuracy stats |
| `GET /api/v1/analytics/admin` | Admin analytics overview |

### Admin Components

| Component | Purpose |
|-----------|---------|
| `components/admin/AdminLogoutButton.tsx` | Logout button with session cleanup |
| `components/admin/AnalyticsDashboard.tsx` | Admin analytics dashboard |
| `components/admin/verification-dashboard.tsx` | Verification stats visualization |

### What's Not Accomplished (Admin)

- ❌ User impersonation (view as specific user)
- ❌ Bulk user management actions
- ❌ System health dashboard (uptime, error rates in real-time)
- ❌ Feature flag management UI
- ❌ Webhook/event log viewer

---

## Key Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useEmailIntegrations` | `hooks/useEmailIntegrations.ts` | Fetches Gmail + Outlook status in parallel; handles connect/disconnect |
| `useQuotaGate` | `hooks/useQuotaGate.ts` | Checks quota before performing a billable action; shows upgrade prompt if exceeded |
| `useRealtimeContacts` | `hooks/useRealtimeContacts.ts` | Supabase realtime subscription for contacts table changes |
| `useRealtimeManager` | `hooks/useRealtimeManager.ts` | Generic realtime subscription manager (used by pipeline, tracker) |
| `useKeyboardShortcuts` | `hooks/useKeyboardShortcuts.ts` | Register keyboard shortcuts for navigation and actions |
| `useResponsive` | `hooks/useResponsive.ts` | Responsive breakpoint detection |
| `useAuthForm` | `hooks/useAuthForm.ts` | Form validation for auth pages |
| `useContacts` | `lib/hooks/useContacts.ts` | Contact CRUD + filtering + pagination state |
| `useSequences` | `lib/hooks/useSequences.ts` | Sequence CRUD + state management |
| `useTracker` | `lib/hooks/useTracker.ts` | Job application tracker state |
| `useDashboardMetrics` | `lib/hooks/useDashboardMetrics.ts` | Dashboard home stat card data |
| `useAnalytics` | `lib/hooks/useAnalytics.ts` | Analytics page data fetching |
| `useAllUserTags` | `lib/hooks/useAllUserTags.ts` | Tag management across contacts |

---

## Data Flow Patterns

### Pattern 1: Page-Level Fetch (Most Pages)

```
Page Component mounts
  → Custom hook (e.g., useContacts) calls fetch()
  → GET /api/v1/contacts
  → API route: auth check → Supabase query → response
  → Hook updates state → component re-renders
```

### Pattern 2: Realtime Updates (Contacts, Pipeline)

```
Page Component mounts
  → useRealtimeContacts subscribes to Supabase realtime channel
  → Any INSERT/UPDATE/DELETE on contacts table
  → Supabase sends change event via WebSocket
  → Hook updates local state → component re-renders
```

### Pattern 3: Optimistic Updates (Quick Actions)

```
User clicks action (e.g., delete contact)
  → UI immediately removes item (optimistic)
  → API call fires in background
  → On success: no further action needed
  → On failure: revert UI + show error toast
```

### Pattern 4: Context-Driven Updates (Quota, Subscription)

```
User performs billable action (email lookup)
  → API route increments quota
  → Response includes updated usage
  → Component calls subscriptionContext.refresh()
  → QuotaWarningBanner re-evaluates threshold
```
