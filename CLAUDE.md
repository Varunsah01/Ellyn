# Ellyn — Master Reference

**What:** Email discovery + outreach platform for job seekers and SMB sales professionals. Finds professional emails with 95%+ accuracy at 100x lower cost than Hunter.io.
**Company:** Eigenspace Technologies PVT. Ltd.
**Core value prop:** "Find anyone's professional email. Reach out with confidence."

---

## Documentation Index

| File | When to use it |
|------|---------------|
| [`docs/email-finder.md`](docs/email-finder.md) | Working on email lookup, domain resolution, pattern generation, ZeroBounce verification, pattern learning |
| [`docs/dashboard-webapp.md`](docs/dashboard-webapp.md) | Working on dashboard pages, persona system, contacts, settings, AI drafting, templates, analytics, landing page |
| [`docs/dashboard-architecture.md`](docs/dashboard-architecture.md) | Understanding HOW the dashboard works: provider tree, auth gate, sidebar nav, data loading, all major user flows step by step |
| [`docs/sequences.md`](docs/sequences.md) | Working on outreach sequences: builder, enrollment, tracker, step types, API routes |
| [`docs/billing-auth.md`](docs/billing-auth.md) | Working on DodoPayments, subscription flow, quota system, auth strategy, security |
| [`docs/database-infra.md`](docs/database-infra.md) | Working on DB schema, migrations, Redis caching, env vars, deployment |
| [`docs/extension.md`](docs/extension.md) | Working on the Chrome Extension: sidepanel, auth bridge, message contracts, layout rules |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router), TypeScript |
| UI | React 18, Tailwind CSS 3.4, shadcn/ui (Radix), Framer Motion |
| Icons | lucide-react ^0.563.0 |
| Database | Supabase (PostgreSQL + RLS) |
| Cache | Vercel KV / Upstash Redis |
| Auth | Supabase Auth (JWT in HTTP-only cookies, `@supabase/ssr`) |
| Payments | DodoPayments (NOT Stripe) — `lib/dodo.ts` |
| AI | Gemini Flash 2.0 (primary) → Mistral 3B → DeepSeek R1 (fallbacks) |
| Email Validation | ZeroBounce API |
| Domain Lookup | Clearbit, Brandfetch, Google Custom Search |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Error Monitoring | Sentry |
| Extension | Chrome Extension (Manifest V3) |
| Deployment | Vercel |

---

## Project Structure (Top Level)

```
app/
  api/                   # All API routes (see docs for details)
  dashboard/             # Dashboard pages (settings/, upgrade/)
  admin/                 # Admin dashboard
  auth/                  # Login, signup, forgot-password
  extension-auth/        # Extension auth bridge
  tracker/               # Activity tracking (job seeker persona)
  templates/             # Email template pages

lib/
  email-finder/          # Core email discovery pipeline
  supabase/server.ts     # createServiceRoleClient() — async, always await
  supabase/client.ts     # createClient() — browser client
  quota.ts               # QuotaExceededError, increment helpers
  dodo.ts                # DodoPayments lazy Proxy singleton
  sequence-engine.ts     # Outreach sequence execution
  cache/redis.ts         # Redis/KV cache layer
  db/migrations/         # Numbered SQL migrations (run manually)
  ai/                    # AI integration (Gemini, Anthropic)

components/
  dashboard/DashboardShell.tsx   # Main layout wrapper
  subscription/                  # PlanBadge, UpgradePrompt, QuotaWarningBanner
  sequences/                     # VisualSequenceBuilder, StepConfigPanel, etc.
  landing/                       # Landing page sections
  ui/                            # shadcn/ui primitives

context/
  SubscriptionContext.tsx         # Global subscription state
  PersonaContext.tsx              # job_seeker | smb_sales persona

extension/                       # Chrome Extension (Manifest V3)
  sidepanel.html / scripts/sidepanel.js  — authoritative UI files
```

---

## Coding Conventions — Quick Reference

### Naming

| Context | Convention |
|---------|-----------|
| DB columns | `snake_case` |
| Variables & functions | `camelCase` |
| React components | `PascalCase` |
| Constants | `UPPER_SNAKE_CASE` |

### Must-Follow Patterns for Every API Route

```typescript
// 1. Server Supabase client — ALWAYS async/await
const supabase = await createServiceRoleClient()  // from lib/supabase/server.ts

// 2. Auth guard on every protected route
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

// 3. Validate request body with Zod before any DB operation

// 4. Quota exceeded response shape
return NextResponse.json(
  { error: 'quota_exceeded', feature, used, limit, plan_type, upgrade_url },
  { status: 402 }
)

// 5. Fire-and-forget async (analytics, logging)
void asyncFn().catch(err => console.error(err))
```

### Key Imports

```typescript
import { createServiceRoleClient } from '@/lib/supabase/server'    // server
import { createClient } from '@/lib/supabase/client'               // browser
import { showToast } from '@/lib/toast'
import { QuotaExceededError, incrementEmailGeneration } from '@/lib/quota'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
```

### Other Rules

- Dashboard pages: always wrap with `DashboardShell` + `PageHeader`
- UI components: `components/ui/Button`, `Card`, `CardContent`, `CardHeader`, `CardTitle`, etc.
- Plain button-based tabs preferred over shadcn Tabs (avoids `bg-midnight-violet` conflicts)
- Pricing imports: use lowercase path `@/components/landing/pricing/`
- Admin routes: under `app/api/admin/` only; guard with `lib/auth/admin-endpoint-guard.ts`
- Migrations: `lib/db/migrations/` — numbered, idempotent; run manually in Supabase SQL editor
- Plan types: `'free' | 'starter' | 'pro'` from `user_profiles.plan_type`

---

## Plans & Quotas

| Plan | Email Lookups/mo | AI Drafts/mo | Price |
|------|-----------------|--------------|-------|
| Free | 50 | 0 | $0 |
| Starter | 500 | 150 | $14.99/mo · $39.99/qtr · $149/yr |
| Pro | 1,500 | 500 | $34.99/mo · $89.99/qtr · $279/yr |

---

## Pre-PR Checks

```bash
npm run lint
npx tsc --noEmit
```

---

## Legal

- **Privacy Policy:** `PRIVACY.md`
- **Terms of Service:** `TERMS.md`
- Governing law: jurisdiction of Eigenspace Technologies PVT. Ltd.
