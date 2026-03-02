# Dashboard Architecture

Last updated: 2026-03-02

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
