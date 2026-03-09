# Secret Inventory (Sanitized)

Last updated: 2026-03-09

## Severity Baseline
- Any confirmed secret found in tracked files or commit history must be treated as compromised.
- Historical commit status is unknown in this environment because `git` is unavailable here; maintainers must run the history scan workflow in [history-cleanup.md](/d:/Ellyn/docs/security/history-cleanup.md).

## Confirmed Exposure Candidates (Masked)

The following secret-like values were observed in local working files and/or previously hardcoded source. Values are intentionally masked and hashed for correlation only.

| Location | Type | Masked | SHA-256 prefix |
| --- | --- | --- | --- |
| `.env` / `.env.local` | Supabase publishable key | `sb_p...wP2B` | `f839322369d2ffc0` |
| `.env` / `.env.local` | Supabase service role key | `sbp_...32df` | `b992dc404cea7a80` |
| `.env` / `.env.local` | JWT-like token | `eyJh...GfXA` | `1e8d093d176193fd` |
| `.env` / `.env.local` | Google AI key | `AIza...N-6Q` | `549f34e6fb77d644` |
| `.env` / `.env.local` | Dodo webhook secret | `whse...7UPC` | `eb2f19da2b36cd28` |
| `extension/lib/supabase.js` (previous) | Hardcoded publishable key | `sb_p...wP2B` | `f839322369d2ffc0` |

Action: rotate/revoke first, then invalidate sessions/tokens where supported, then remove from future commits and handle history cleanup.

## Inventory

| Variable | Primary usage locations | Boundary | Provider | Rotation method | Compromise impact | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase/client.ts`, `app/layout.tsx`, extension public config | Public-by-design | Supabase | Dashboard/manual | Low to medium | Project URL, safe public metadata |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase/client.ts`, extension public config | Public-by-design | Supabase | Dashboard/manual | Medium | Public key; still remove hardcoded literals |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/server.ts`, seed scripts | Server-only | Supabase | Dashboard/manual | Critical | Full DB bypass/RLS bypass risk |
| `NEXT_PUBLIC_APP_URL` | Auth/OAuth redirects, server-side admin fetch | Public-by-design | App config | Deploy config | Medium | Bad value can break callback/redirect integrity |
| `NEXT_PUBLIC_CHROME_EXTENSION_ID` | `lib/extension-bridge.ts`, dashboard page | Public-by-design | Chrome extension | Chrome Web Store config | Low | Used for extension detection/bridge routing |
| `NEXT_PUBLIC_EXTENSION_ID` | `lib/extension-bridge.ts` | Public-by-design | Chrome extension | Deploy config | Low | Alias/fallback for extension ID |
| `NEXT_PUBLIC_EXTENSION_URL` | `app/dashboard/page.tsx` | Public-by-design | App config | Deploy config | Low | Web store link only |
| `DODO_PAYMENTS_API_KEY` | `lib/dodo.ts` | Server-only | DodoPayments | Dashboard/manual | Critical | Billing API control and charge operations |
| `DODO_PAYMENTS_WEBHOOK_KEY` | `app/api/v1/dodo/webhook/route.ts` | Server-only | DodoPayments | Dashboard/manual | Critical | Forged billing webhooks possible |
| `DODO_PAYMENTS_ENVIRONMENT` | `lib/dodo.ts` | Server-only | DodoPayments | Deploy config | Medium | Wrong value can route live traffic to wrong environment |
| `DODO_*_PRODUCT_ID_*` | `lib/pricing-config.ts` | Server-only | DodoPayments | Dashboard/manual | Medium | Misbilling/plan mismatch risk |
| `GOOGLE_AI_API_KEY` | `lib/ai/gemini.ts`, `lib/llm-client.ts`, API routes | Server-only | Google AI (Gemini) | Dashboard/manual | High | Quota theft / model abuse |
| `GEMINI_API_KEY` | `lib/ai/gemini.ts`, `lib/domain-inference.ts` | Server-only | Google AI (Gemini) | Dashboard/manual | High | Alias path; same risk as above |
| `GOOGLE_GENERATIVE_AI_API_KEY` | `lib/domain-inference.ts` | Server-only | Google AI | Dashboard/manual | High | Legacy alias; treat as secret |
| `MISTRAL_API_KEY` | `lib/llm-client.ts` | Server-only | Mistral | Dashboard/manual | High | Paid model abuse risk |
| `DEEPSEEK_API_KEY` | `lib/llm-client.ts` | Server-only | DeepSeek | Dashboard/manual | High | Paid model abuse risk |
| `ABSTRACT_EMAIL_VALIDATION_API_KEY` | `lib/abstract-email-validation.ts`, API routes | Server-only | Abstract API | Dashboard/manual | High | Paid verification abuse/data leakage |
| `GOOGLE_CUSTOM_SEARCH_API_KEY` | `lib/domain-resolution-service.ts`, `lib/domain-lookup.ts` | Server-only | Google CSE | Dashboard/manual | High | API quota/abuse |
| `GOOGLE_SEARCH_ENGINE_ID` | `lib/domain-resolution-service.ts` | Server-only | Google CSE | Dashboard/manual | Medium | Identifier only, but coupled with API key |
| `BRANDFETCH_CLIENT_ID` | domain resolution routes/services | Server-only | Brandfetch | Dashboard/manual | Medium | Tenant usage abuse |
| `CLEARBIT_API_KEY` | docs/env references (no current code path) | Server-only | Clearbit | Dashboard/manual | High | Legacy/optional integration |
| `ZEROBOUNCE_API_KEY` | docs/env references (no current code path) | Server-only | ZeroBounce | Dashboard/manual | High | Legacy/optional integration |
| `UPSTASH_REDIS_REST_URL` | `lib/rate-limit.ts`, pipeline cache path | Server-only | Upstash Redis | Dashboard/manual | Medium | Endpoint metadata; pair with token is sensitive |
| `UPSTASH_REDIS_REST_TOKEN` | `lib/rate-limit.ts` | Server-only | Upstash Redis | Dashboard/manual | High | Cache/data manipulation risk |
| `KV_REST_API_URL` | `lib/cache/redis.ts` | Server-only | Vercel KV | Dashboard/manual | Medium | Endpoint metadata |
| `KV_REST_API_TOKEN` | `lib/cache/redis.ts` | Server-only | Vercel KV | Dashboard/manual | High | Cache/data manipulation risk |
| `KV_REST_API_READ_ONLY_TOKEN` | env/docs references | Server-only | Vercel KV | Dashboard/manual | Medium | Read-only exposure still leaks cached data |
| `SENTRY_DSN` | `sentry.server.config.ts`, `sentry.edge.config.ts` | Server-only | Sentry | Dashboard/manual | Medium | Event spam/noise abuse |
| `NEXT_PUBLIC_SENTRY_DSN` | `sentry.client.config.ts` | Public-by-design | Sentry | Dashboard/manual | Low | DSN intentionally public |
| `SENTRY_ORG` | `next.config.js` | Server-only | Sentry | Dashboard/manual | Medium | Build metadata; low direct impact alone |
| `SENTRY_PROJECT` | `next.config.js` | Server-only | Sentry | Dashboard/manual | Medium | Build metadata; low direct impact alone |
| `SENTRY_AUTH_TOKEN` | build/source map upload | Server-only | Sentry | Dashboard/manual | High | Source map/project admin operations |
| `ADMIN_API_SECRET` | admin verification routes, admin fetch helper | Server-only | Internal admin auth | Manual | Critical | Admin stats/cache endpoints bypass risk |
| `ADMIN_SESSION_SECRET` | `lib/auth/admin-session.ts` | Server-only | Internal admin auth | Manual | Critical | Admin session forgery risk |
| `ADMIN_USERNAME` | admin auth login | Server-only | Internal admin auth | Manual | Medium | Account enumeration/support ops impact |
| `ADMIN_PASSWORD_HASH` | admin auth login | Server-only | Internal admin auth | Manual | High | Admin access risk if weak/reused |
| `SECRET_ADMIN_TOKEN` | `lib/auth/admin-endpoint-guard.ts` | Server-only | Internal admin auth | Manual | Critical | Debug/admin endpoint access bypass |
| `ADMIN_IP_WHITELIST` | `lib/auth/admin-endpoint-guard.ts` | Server-only | Internal admin auth | Deploy config | Medium | Incorrect list may expose admin endpoints |
| `ENABLE_DEBUG_ENDPOINTS` | `lib/auth/admin-endpoint-guard.ts` | Server-only | Internal admin auth | Deploy config | High | Misconfiguration can expose admin/debug APIs |
| `ANALYTICS_ADMIN_EMAILS` / `ADMIN_EMAILS` | `app/api/analytics/_helpers.ts` | Server-only | Internal authz | Deploy config | Medium | Admin analytics access scope |
| `GOOGLE_CLIENT_ID` | Gmail OAuth routes/helper | Server-only | Google OAuth | Cloud console/manual | Medium | Client ID generally public-ish but keep server-side |
| `GOOGLE_CLIENT_SECRET` | Gmail OAuth helper/routes | Server-only | Google OAuth | Cloud console/manual | Critical | OAuth token minting risk |
| `GMAIL_TOKEN_ENCRYPTION_KEY` | `lib/gmail-helper.ts` | Server-only | Internal crypto | Manual | Critical | Encrypted token disclosure risk |
| `MICROSOFT_CLIENT_ID` | Outlook OAuth helper/routes | Server-only | Microsoft OAuth | Azure portal/manual | Medium | Public-ish identifier, still server-managed |
| `MICROSOFT_CLIENT_SECRET` | Outlook OAuth helper/routes | Server-only | Microsoft OAuth | Azure portal/manual | Critical | OAuth token minting risk |
| `OUTLOOK_TOKEN_ENCRYPTION_KEY` | `lib/outlook-helper.ts` | Server-only | Internal crypto | Manual | Critical | Encrypted token disclosure risk |
| `CRON_SECRET` | `app/api/cron/check-replies/route.ts`, GH workflow | Server-only | Internal scheduler auth | Manual | High | Unauthorized cron execution risk |
| `SMTP_PROBE_SECRET` | `smtp-probe-service/index.js` | Server-only | SMTP probe service | Manual | High | Probe service abuse and false telemetry |
| `SMTP_PROBE_SERVICE_URL` | `app/api/v1/smtp-probe/health/route.ts` | Server-only | SMTP probe service | Deploy config | Medium | SSRF/misroute risk if altered |
| `ERROR_MONITORING_WEBHOOK_URL` | `lib/errors/error-handler.ts` | Server-only | Monitoring webhook | Manual | Medium | Alert exfiltration/spam risk |
| `ABSTRACT_API_KEY` | local env only; no active code reference | Server-only (legacy) | Abstract API (legacy) | Dashboard/manual | High | Treat as legacy secret until revoked |
| `ANTHROPIC_API_KEY` | local env only; no active code reference | Server-only (legacy) | Anthropic | Dashboard/manual | High | Legacy key; revoke if still active |
| `DODO_API_KEY` / `DODO_WEBHOOK_SECRET` | local env only; no active code reference | Server-only (legacy) | DodoPayments (legacy naming) | Dashboard/manual | Critical | Revoke if still active aliases |
| `KV_REDIS_URL` / `VERCEL_TOKEN` | local env only; no active code reference | Server-only (legacy) | Redis/Vercel | Dashboard/manual | Medium to high | Legacy values should be rotated/revoked if active |

## Client/Extension Boundary Review

- Fixed: hardcoded Supabase publishable key removed from tracked extension source (`extension/lib/supabase.js` now reads generated `extension/public-config.js`).
- Public-by-design keys allowed in client/extension:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_APP_URL`
  - extension IDs/URLs
- No non-`NEXT_PUBLIC_*` secret should be read from client bundles, extension scripts, or browser storage.
