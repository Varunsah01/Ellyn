# Dashboard Architecture

Last updated: 2026-03-04

## Auth and Routing Flow

1. `middleware.ts` protects `/dashboard/**`, `/tracker/**`, and `/admin/**`.
2. Public allowlist includes `/`, `/auth/**`, `/api/v1/auth/**`, and `/api/v1/pricing-region`.
3. If no session is found, middleware redirects to `/auth/login?redirect=<path>`.
4. `app/dashboard/layout.tsx` performs a server-side session check again and redirects to `/auth/login` if missing.

## Provider Tree (Current)

`app/dashboard/layout.tsx` renders:

```tsx
<SubscriptionProvider>
  <PersonaProvider>
    <DashboardShell withChrome>{children}</DashboardShell>
  </PersonaProvider>
</SubscriptionProvider>
```

## Supabase Client Layers

- Server client: `lib/supabase/server.ts`
  - ✅ `createServiceRoleClient()` for admin/service-role operations.
  - ✅ `createClient()` for request-scoped server auth/session reads.
- Browser client: `lib/supabase/client.ts`
  - ✅ `createClient()` built with `@supabase/ssr` and anon credentials.

## Dashboard Shell Responsibilities

`components/dashboard/DashboardShell.tsx` provides:

- ✅ Sidebar (desktop) + mobile collapse behavior
- ✅ Persona-aware nav items
- ✅ Persona toggle wired to `PersonaContext`
- ✅ User profile and plan badge block
- ✅ Main content container and top-level dashboard chrome
- ✅ Quota warning banner integration

## Context Responsibilities

### `context/PersonaContext.tsx`

- ✅ Holds `persona: 'job_seeker' | 'smb_sales'`
- ✅ Loads local value, verifies against server (`GET /api/v1/user/persona`)
- ✅ Persists updates via `PATCH /api/v1/user/persona`
- ✅ Exposes `{ persona, setPersona, isJobSeeker, isSalesRep }`

### `context/SubscriptionContext.tsx`

- ✅ Fetches `/api/v1/subscription/status`
- ✅ Stores plan, subscription status, quota usage/limits, and loading state
- ✅ Exposes `refresh()`

## Error and Loading Boundaries

- ✅ `app/dashboard/error.tsx` handles dashboard route errors.
- ✅ `app/dashboard/loading.tsx` provides global dashboard loading skeletons.

## Middleware

`middleware.ts` runs on all requests:
- Protects `/dashboard/**`, `/tracker/**`, and `/admin/**`.
- Public allowlist: `/`, `/auth/**`, `/api/v1/auth/**`, `/api/v1/pricing-region`, `/api/webhooks/**`, `/api/track/**`.
- No session → redirects to `/auth/login?redirect=<path>`.
- Rate limiting middleware in `middleware/rate-limit.ts`.

## Onboarding Flow

- `lib/onboarding.ts` tracks onboarding step completion.
- `components/dashboard/OnboardingChecklist.tsx` surfaces next steps in the dashboard home.
- `components/dashboard/PersonaOnboardingModal.tsx` prompts new users to choose `job_seeker` or `smb_sales` persona.
- `components/dashboard/PersonaOnboardingGate.tsx` blocks access to persona-gated features until selection is made.
- `GET/PATCH /api/v1/user/onboarding` persists onboarding progress server-side (migration 016).

## Admin Dashboard

Routes under `app/admin/` — protected by `lib/auth/admin-endpoint-guard.ts` (checks `SECRET_ADMIN_TOKEN` header + optional IP whitelist):

| Page | Purpose |
|------|---------|
| `/admin/dashboard` | Admin home |
| `/admin/dashboard/users` | User management |
| `/admin/dashboard/integrations` | Integration health monitoring |
| `/admin/dashboard/verification` | Email verification statistics |
| `/admin/dashboard/domain-accuracy` | Domain resolution accuracy charts |
| `/admin/login` | Admin login page |

Admin API routes live under `app/api/admin/`:
- `domain-accuracy`, `verification-cache`, `verification-stats`, `seed-templates`, `quota/reset`, `refresh-lead-scores`

## Key Hooks

| Hook | Purpose |
|------|---------|
| `hooks/useEmailIntegrations.ts` | Fetches Gmail + Outlook status in parallel; handles connect/disconnect |
| `hooks/useQuotaGate.ts` | Checks quota before performing a billable action |
| `hooks/useRealtimeContacts.ts` | Supabase realtime subscription for contacts table |
| `hooks/useRealtimeManager.ts` | Generic realtime subscription manager |
| `hooks/useKeyboardShortcuts.ts` | Keyboard shortcut registration |
| `lib/hooks/useContacts.ts` | Contact CRUD + filtering state |
| `lib/hooks/useSequences.ts` | Sequence CRUD + state |
| `lib/hooks/useTracker.ts` | Job application tracker state |
| `lib/hooks/useDashboardMetrics.ts` | Dashboard home stats |
