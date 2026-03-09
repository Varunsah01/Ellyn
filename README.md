# ELLYN

ELLYN is a Next.js 14 + Supabase platform for email discovery and outreach. It combines domain resolution, pattern prediction, verification, contacts management, sequences, analytics, templates, and subscription billing.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Supabase (Auth + Postgres + RLS)
- Tailwind + shadcn/ui
- DodoPayments (subscriptions)

## Quick Start

1. Clone the repository.
2. Install dependencies.
3. Copy env template.
4. Fill required environment variables.
5. Run SQL migrations in Supabase.
6. Start the app.

```bash
git clone <your-repo-url>
cd Ellyn
npm install
cp .env.example .env.local
# edit .env.local
npm run dev
```

Open http://localhost:3000.

## Database Migration Order

Run migrations from `lib/db/migrations/` in order.

Minimum required baseline:

- `000_ensure_complete_foundation.sql`

This migration is idempotent and includes signup trigger automation for `user_profiles` and `user_quotas`.

## Environment Variables

### Required

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Optional (feature-dependent)

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
- `ADMIN_API_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`
- `CRON_SECRET`

## Scripts

- `npm run dev`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run security:scan`
- `npm run security:install-hooks`
- `npm run extension:public-config`

## Documentation

- `docs/dashboard-webapp.md`
- `docs/dashboard-architecture.md`
- `docs/sequences.md`
- `docs/billing-auth.md`
- `docs/email-finder.md`
- `docs/database-infra.md`
- `docs/extension.md`
- `docs/security/secret-inventory.md`
- `docs/security/secret-rotation-runbook.md`
- `docs/security/history-cleanup.md`
