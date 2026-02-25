# Ellyn - Complete Product & Architecture Reference

## What Is Ellyn?

Ellyn is an email discovery and outreach platform for job seekers and SMB sales professionals. It finds professional email addresses with 95%+ accuracy, verifies them, and helps users write personalized outreach emails — all at 100x lower cost than competitors like Hunter.io.

**Core value prop:** "Find anyone's professional email. Reach out with confidence."

**Company:** Eigenspace Technologies PVT. Ltd.

---

## Table of Contents

1. [Product Overview](#product-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Email Finder — Complete Architecture](#email-finder--complete-architecture) (domain resolution, pattern generation, verification, learning, end-to-end example)
5. [AI Features](#ai-features)
6. [Subscription & Billing](#subscription--billing)
7. [Chrome Extension](#chrome-extension)
8. [Dashboard & Lead Management](#dashboard--lead-management)
9. [Outreach Sequences](#outreach-sequences)
10. [Analytics & Observability](#analytics--observability)
11. [Authentication & Security](#authentication--security)
12. [Caching Strategy](#caching-strategy)
13. [Database Schema](#database-schema)
14. [API Routes Reference](#api-routes-reference)
15. [Environment Variables](#environment-variables)
16. [Coding Conventions](#coding-conventions)
17. [Deployment](#deployment)

---

## Product Overview

### Business Model

| Plan | Email Lookups/mo | AI Drafts/mo | Price |
|------|-----------------|--------------|-------|
| Free | 50 | 0 | $0 |
| Starter | 500 | 150 | $14.99/mo or $39.99/quarter |
| Pro | 1,500 | 500 | $34.99/mo, $89.99/quarter, $279/year |

### Cost Per Lookup

- Email pattern generation: free (local computation)
- Domain resolution: $0 (Clearbit/Brandfetch are free) to $0.001 (Google/LLM fallback)
- Email verification (ZeroBounce): ~$0.008/check
- Total per verified email: $0.001-$0.0025 (100x cheaper than Hunter.io)

### Target Users

Two primary audiences:
1. **Job seekers** who want to reach hiring managers, recruiters, and referral contacts directly via cold email rather than applying through job portals.
2. **SMB sales professionals**, SDRs, founders, and agencies who need to find prospect emails and run cold outreach campaigns at scale.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router), TypeScript |
| UI | React 18, Tailwind CSS 3.4, shadcn/ui (Radix primitives) |
| Database | Supabase (PostgreSQL) with Row-Level Security |
| Cache | Vercel KV / Upstash Redis |
| Auth | Supabase Auth (JWT in HTTP-only cookies via `@supabase/ssr`) |
| Payments | DodoPayments (NOT Stripe) |
| AI | Google Gemini Flash 2.0 (primary LLM), Mistral 3B (fallback), DeepSeek R1 (third fallback) |
| Email Validation | ZeroBounce API |
| Domain Lookup | Clearbit, Brandfetch, Google Custom Search |
| Error Monitoring | Sentry |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Animations | Framer Motion |
| Extension | Chrome Extension (Manifest V3) |
| Deployment | Vercel |

---

## Project Structure

```
app/
  api/
    enrich/              # Primary email discovery endpoint
    predict-patterns/    # Email pattern generation
    predict-email/       # Single email prediction
    resolve-domain/      # Domain resolution
    ai/                  # AI endpoints (enhance-draft, customize-tone, generate-template)
    v1/
      auth/              # Signup, password, Gmail/Outlook OAuth
      contacts/          # Lead CRUD
      dodo/webhook/      # DodoPayments webhook handler
      subscription/      # Checkout, status, portal, invoices
      pricing-region/    # Regional pricing
      analytics/         # Event tracking, user analytics
      admin/             # Admin operations (quota reset, etc.)
    admin/               # Admin analytics (domain-accuracy, verification-stats)
    quota/               # Quota status and checks
    extension/           # Extension sync endpoints
    sequences/           # Outreach sequence CRUD and execution
    email-templates/     # Template CRUD
  dashboard/             # Main dashboard pages
    settings/
      billing/           # Billing & Plan settings
    upgrade/             # Upgrade page
  admin/                 # Admin dashboard pages
  auth/                  # Login, signup, forgot-password
  extension-auth/        # Extension auth bridge
  tracker/               # Activity tracking
  templates/             # Email template pages

lib/
  email-finder/          # Core email discovery pipeline
  domain-resolution-service.ts  # Layered domain lookup
  domain-lookup.ts       # Domain resolution helpers
  enhanced-email-patterns.ts    # Pattern generation engine
  email-verification.ts  # Verification logic
  sequence-engine.ts     # Outreach sequence engine
  tracker-v2.ts          # Activity tracker
  dodo.ts                # DodoPayments client (lazy Proxy singleton)
  pricing-config.ts      # Plan/product ID mapping, getDodoProductId()
  quota.ts               # QuotaExceededError, incrementEmailGeneration(), incrementAIDraftGeneration()
  domain-resolution-analytics.ts  # Fire-and-forget analytics logger
  api-circuit-breaker.ts # Circuit breaker for external APIs
  toast.ts               # showToast utility
  supabase/
    server.ts            # createServiceRoleClient() — async, always await
    client.ts            # createClient() — browser client
  db/
    migrations/          # Numbered SQL migrations (run manually in Supabase)
  auth/
    admin-endpoint-guard.ts  # Admin route protection
  cache/
    redis.ts             # Redis/KV cache layer
  ai/                    # AI integration (Gemini, Anthropic)
  validation/            # Zod schemas
  context/
    AppRefreshContext.ts  # Global refresh trigger

components/
  dashboard/
    DashboardShell.tsx   # Main dashboard layout wrapper
  subscription/
    PlanBadge.tsx        # Plan indicator
    UpgradePrompt.tsx    # Upgrade CTA
    QuotaWarningBanner.tsx
  landing/               # Landing page sections (Hero, Pricing, FAQ, etc.)
  analytics/             # Analytics chart components
  admin/                 # Admin dashboard components
  ui/                    # shadcn/ui primitives (Button, Card, Dialog, etc.)

context/
  SubscriptionContext.tsx  # Global subscription state + SubscriptionProvider

hooks/
  useQuotaGate.ts        # Check quota before actions
  useSubscription()      # Access subscription context
  useRealtimeContacts()  # Supabase real-time contact updates

extension/               # Chrome Extension (Manifest V3)
  sidepanel/             # Extension UI
  scripts/               # Background scripts
  utils/                 # Extension utilities
  onboarding/            # Extension onboarding flow
```

---

## Email Finder — Complete Architecture

The email finder is Ellyn's core engine. It takes a person's name + company and returns a ranked list of probable email addresses. The system has **three major phases**.

```
User Input (name + company)
        │
        ▼
┌─────────────────────────────┐
│  PHASE 1: DOMAIN RESOLUTION │   6-layer cascade, early exit on hit
│  (company → domain)         │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  PHASE 2: PATTERN GENERATION │   6 candidate email formats generated;
│  (name + domain → emails)   │   Gemini Flash ranks & selects top 2
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  PHASE 3: VERIFICATION       │   MX check (always on) + sequential SMTP
│  & RANKING                   │   verify top 2 only; early exit on hit
└──────────┬──────────────────┘
           │
           ▼
    Ranked Email Results
```

### Entry Points

| Route | Purpose | File |
|-------|---------|------|
| `POST /api/enrich` | Full pipeline (domain + patterns + verify) | `app/api/enrich/route.ts` |
| `POST /api/predict-patterns` | Pattern generation only (domain already known) | `app/api/predict-patterns/route.ts` |
| `POST /api/predict-email` | Advanced v2 prediction with AI + learning | `app/api/predict-email/route.ts` |
| `POST /api/resolve-domain` | Domain resolution only | `app/api/resolve-domain/route.ts` |

### Input

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "companyName": "Tata Consultancy Services",
  "role": "Senior Software Engineer"
}
```

---

### Phase 1: Domain Resolution (company name → email domain)

**Location:** `lib/domain-resolution-service.ts`, `lib/domain-lookup.ts`

Resolves a company name to its email domain using a **6-layer cascade** that stops at the first successful hit:

| Layer | Source | Confidence | Cost | File / Function | Notes |
|-------|--------|-----------|------|-----------------|-------|
| 1 | Known company DB | 95% | Free | `getKnownDomain()` in `lib/enhanced-email-patterns.ts` | 100+ pre-configured companies, Redis cached 24h |
| 2 | Clearbit Logo API | 90% | Free | `lookupCompanyDomain()` in `lib/domain-lookup.ts` | HEAD request to `logo.clearbit.com/{company}.com` |
| 3 | Brandfetch API | 85% | Free | `brandfetchDomain()` in `lib/domain-lookup.ts` | `api.brandfetch.io/v2/search/{company}` |
| 4 | Claude Haiku (LLM) | 70% | ~$0.0002 | `predictDomainWithLLM()` in `lib/llm-domain-prediction.ts` | Returns 3 candidates, MX-verified in parallel, 30d cache |
| 5 | Google Custom Search | 75% | Free (100/day) | `googleSearchDomain()` in `lib/domain-lookup.ts` | Searches `"{company} official website"` |
| 6 | Heuristic guessing | 50% | Free | `heuristicDomainGuess()` → `smartResolveDomain()` in `lib/smart-tld-resolver.ts` | Tries TLDs (.com, .io, .ai, etc.) with MX verification |

**Company name normalization:** Lowercased, special chars removed, suffixes stripped (Inc, LLC, Corp, Ltd).

**Circuit Breaker** (`lib/api-circuit-breaker.ts`):
- Each external layer wrapped independently
- 10 consecutive failures → circuit opens for 5 minutes
- Error classification: `timeout` (retryable once), `rate_limit` / 429 (immediate open), `not_found` / 404 (terminal, no counter increment), `api_error` / 5xx (terminal)

**Caching:** Hits cached 7 days, misses cached 1 hour. Background refresh enabled to prevent stampede. Tags for targeted invalidation.

**MX Verification** (`lib/mx-verification.ts`):
- `dns.resolveMx()` with 2s timeout
- Detects provider: Google Workspace (`google.com`/`googlemail.com` in MX), Microsoft 365 (`outlook.com`/`microsoft.com`), or custom
- Cached 24h in Redis
- Returns `{ hasMX, mxCount, mxServers[], provider, verified }`

**Analytics:** Every resolution logged to `domain_resolution_logs` via fire-and-forget (`lib/domain-resolution-analytics.ts`).

**If all layers fail:** Returns 400 with suggestion to provide the company website URL directly.

---

### Phase 2: Email Pattern Generation (name + domain → candidate emails)

**Location:** `lib/enhanced-email-patterns.ts`, `lib/email-patterns.ts`

#### Step 2a: Build Company Profile

```typescript
{ domain: "tcs.com", estimatedSize: "enterprise", emailProvider: "google" }
```

Size estimation: Enterprise (pre-defined list or domain < 6 chars) → Large (secondary list) → Startup (`.io`/`.ai` domain or hyphenated) → Medium (default).

#### Step 2b: Pattern Templates (6 candidates)

The engine selects the 6 highest-confidence patterns for a given name + domain, drawn from the full template library: `first.last`, `flast`, `firstlast`, `first`, `last.first`, `f.last`, `first_last`, `lastfirst`, `first.l`, `firstl`, `last`, `first-last`, `f_last`, `last_first`, `last.first`.

Size, role, and provider adjustments (Steps 2c–2e) determine which 6 are selected and their confidence scores.

#### Step 2c: Confidence by Company Size

| Pattern | Enterprise | Startup | Medium |
|---------|-----------|---------|--------|
| `first.last` | 85% | 65% | 75% |
| `first` | 20% | 80% | 60% |
| `flast` | 65% | 45% | 35% |
| `firstlast` | 45% | 35% | 30% |
| `f.last` | 30% | 25% | 45% |

#### Step 2d: Role-Based Adjustments

| Role Keywords | Adjustments |
|---------------|------------|
| CEO, CTO, founder, president | `first` +25, `first.last` +10 |
| Engineer, developer | `first.last` +20, `flast` +10 |
| Recruiter, HR | `first.last` +15 |
| Sales, marketing | `first` +15, `first.last` +10 |

#### Step 2e: Email Provider Adjustments

| Provider | Boosts | Penalties |
|----------|--------|----------|
| Google Workspace | `first.last` +15 | `firstlast` -5 |
| Microsoft 365 | `firstlast` +10, `first` +10 | `f.last` -5 |

#### Step 2f: Name Parsing

Handles: titles (Mr/Dr/Prof), suffixes (Jr/Sr/III/PhD), hyphenated names (tries both `mary-jane` and `maryjane`), middle names.

#### Step 2g: Gemini Flash Ranking

After the 6 candidates are generated, all 6 are sent to **Gemini Flash** for AI-assisted ranking:

1. Gemini Flash receives the 6 email formats with their confidence scores and supporting context (name, domain, company size, email provider, role, historical patterns)
2. Gemini ranks the candidates and selects the **top 2 most probable emails**
3. Only these 2 emails proceed to Phase 3 verification

**Fallback:** If Gemini Flash is unavailable, the top 2 by static confidence score are used.

System now generates 6 candidate email formats. Gemini Flash ranks them and selects the top 2 most probable emails for verification.

**Cache:** Patterns cached 24h, key built from `[domain, firstName, lastName, role, companySize, emailProvider]`.

#### Advanced: AI-Enhanced Prediction (v2)

**Entry point:** `POST /api/predict-email`

Uses Claude Haiku (`claude-3-5-haiku-20241022`) to rank patterns with contextual intelligence:

1. Validate input — domain must have valid MX records
2. Detect industry & provider via `lib/company-intelligence.ts`
3. Send context to Claude: name, domain, company size, industry, provider, historical patterns, LinkedIn URL
4. Claude returns ranked patterns with confidence + reasoning as JSON
5. Apply learned boosts from `pattern_learning` table
6. Fallback to static size-based distribution if Claude fails
7. Deduplicate, sort by confidence desc; Gemini Flash selects top 2 for verification

**Cost:** Input $0.80/M tokens, Output $4.00/M tokens, Cache read $0.08/M tokens. System prompt cached 1h. Token usage logged to `api_predictions` table (fire-and-forget).

**Rate limit:** 50 requests/hour per user (429 with `Retry-After`).

---

### Phase 3: Verification & Ranking

#### Step 0: Primary Pattern Check (Domain Memory Fast Path)

Before any other verification step:
- Query Redis (`cache:domain-primary-pattern:{domain}`, TTL 7d) or `pattern_learning` where `is_primary = true`
- **If primary pattern found:** Generate only 3 candidate patterns, skip Gemini Flash ranking, attempt SMTP verification on primary pattern directly
  - If verified → stop and return immediately with `badge: "verified"`
  - If not verified → fall back to standard flow (6 patterns + Gemini ranking)
- **If no primary pattern:** Proceed with standard flow

Primary pattern check counts as SMTP attempt #1. Maximum remains 2 SMTP attempts per request.

#### Tier 1: MX Record Check (Free, Always On)

- DNS lookup via `dns.resolveMx()`, 2s timeout
- Validates domain can receive email
- Cached 24h — key: `cache:mx-verification:email-verification:{domain}`

#### Tier 2: SMTP Verification via ZeroBounce (Sequential, Cost-Optimized)

Verification proceeds sequentially against the 2 Gemini-ranked candidates and stops as soon as one is confirmed. **Never more than 2 ZeroBounce checks per request.**

**Flow:**

1. **Verify rank #1 email** (Gemini's top pick) via ZeroBounce SMTP check
   - If **verified** → return immediately with `badge: "verified"`. Do not check rank #2.
   - If **not verified** → proceed to step 2.

2. **Verify rank #2 email** via ZeroBounce SMTP check
   - If **verified** → return immediately with `badge: "verified"`.
   - If **not verified** → do not verify any further candidates.

3. **If neither is verified** → return rank #1 as unverified with `badge: "most_probable"` (LLM-suggested).

**Properties:**
- Cost: ~$0.0002/check, max $0.0004/request (2 checks)
- Cached 7 days
- Confidence adjustments: verified = **+50%**, risky = **+10-20%**, undeliverable = **set to 5%**

#### Verification Quotas

| Plan | Verifications/day |
|------|------------------|
| Free | 10 |
| Starter | 50 |
| Pro | 100 |

---

### Pattern Learning System

**Location:** `lib/learning-system.ts`, data in `pattern_learning` table

Feedback loop that improves accuracy over time:

1. User reports email success (reply) or bounce
2. System records outcome per domain + pattern
3. On future lookups, boosts applied via `getLearnedPatterns()` / `applyLearnedBoosts()`:

```
boost = (successRate - 50) / 2     // Range: -25 to +25
newConfidence = clamp(5, 95, baseConfidence + boost)
```

Minimum **3 attempts** before learning kicks in (statistical significance).

**Pattern Promotion:** If `success_rate ≥ 80%` AND `total_attempts ≥ 5` → set `is_primary = true` for that domain.

**Pattern Demotion:** If the primary pattern bounce rate exceeds 40% over the last 10 attempts → set `is_primary = false`, re-enable Gemini ranking for that domain.

---

### Domain Pattern Memory System

When a pattern is SMTP-verified successfully for a domain, the system stores it as the **primary pattern** for that domain. This turns Ellyn into a self-optimizing domain intelligence engine.

**On SMTP verification success:**
- Set `is_primary = true` on the `pattern_learning` row for that domain + pattern
- Record `last_verified_at` timestamp
- Cache under `cache:domain-primary-pattern:{domain}` (TTL 7 days)

**On future lookups for the same domain:**
1. Check Redis (`cache:domain-primary-pattern:{domain}`) or query `pattern_learning` where `is_primary = true`
2. If a primary pattern exists:
   - Generate only **3 candidate patterns** (not 6)
   - Skip Gemini Flash ranking entirely
   - Attempt SMTP verification on the primary pattern directly
   - If verified → stop and return immediately
   - If not verified → fall back to the standard 6-pattern + Gemini ranking flow
3. If no primary pattern → use the default flow (6 patterns → Gemini ranking → sequential verification)

**Benefits:**
- Reduces LLM calls by skipping Gemini on warm domains
- Lower latency for repeat lookups on known domains
- Improves accuracy over time as the system learns per-domain conventions
- Maximum SMTP attempts remains 2 per request; primary pattern counts as attempt #1

---

### End-to-End Example

**Input:** `{ firstName: "John", lastName: "Doe", companyName: "Tata Consultancy Services", role: "Senior Software Engineer" }`

1. **Domain Resolution:** Known DB miss → Clearbit miss (timeout) → Brandfetch miss → LLM hit: `tcs.com` (70%, MX-verified)
2. **Company Profile:** domain=`tcs.com`, size=`enterprise`, provider=`google`
3. **Patterns:** Engine generates 6 candidates using enterprise template + engineer boost + Google boost → `john.doe@tcs.com` (95%), `jdoe@tcs.com` (75%), `johndoe@tcs.com` (55%), `j.doe@tcs.com` (45%), `john@tcs.com` (30%), `doejohn@tcs.com` (20%)
4. **Gemini Flash Ranking:** Selects top 2 → rank #1: `john.doe@tcs.com`, rank #2: `jdoe@tcs.com`
5. **Learning:** `first.last` has 90% historical success on `tcs.com` → +20 boost (capped at 95%)
6. **Verification:** `john.doe@tcs.com` sent to ZeroBounce → confirmed deliverable → stop immediately, `jdoe@tcs.com` not checked

**If verified (rank #1 confirmed):**
```json
{
  "success": true,
  "result": {
    "email": "john.doe@tcs.com",
    "pattern": "first.last",
    "confidence": 95,
    "verified": true,
    "verificationSource": "zerobounce",
    "badge": "verified"
  },
  "topRecommendation": "john.doe@tcs.com",
  "metadata": { "companySize": "enterprise", "emailProvider": "Google Workspace", "domainSource": "llm" }
}
```

**If neither candidate verified:**
```json
{
  "success": true,
  "result": {
    "email": "john.doe@tcs.com",
    "pattern": "first.last",
    "confidence": 92,
    "verified": false,
    "badge": "most_probable"
  },
  "topRecommendation": "john.doe@tcs.com",
  "metadata": { "companySize": "enterprise", "emailProvider": "Google Workspace", "domainSource": "llm" }
}
```

**Domain Memory Fast Path example** (warm domain):

```json
{
  "success": true,
  "topResult": {
    "email": "john.doe@tcs.com",
    "pattern": "first.last",
    "verified": true,
    "source": "primary_pattern",
    "optimization": "domain_memory",
    "badge": "verified"
  }
}
```

### Core Design Principles

1. **Fail-safe cascade** — each layer independent; failure doesn't block the next
2. **Cost-first ordering** — free methods before paid (DNS → Clearbit → Brandfetch → Gemini → ZeroBounce)
3. **Aggressive caching** — Redis + in-memory fallback, background refresh, tagged invalidation
4. **Circuit breakers** — prevent cascading failures to external APIs
5. **Learning loop** — historical success/bounce data improves future predictions
6. **Non-blocking analytics** — all logging is fire-and-forget
7. **Self-Optimizing Intelligence** — verified domain patterns become primary for future predictions, reducing LLM usage and latency over time

---

## AI Features

### Email Drafting (Gemini Flash)

| Endpoint | Action |
|----------|--------|
| `POST /api/ai/generate-template` | Generate email from scratch with context |
| `POST /api/ai/enhance-draft` | Improve existing draft |
| `POST /api/ai/customize-tone` | Change tone (professional, casual, friendly, confident, humble) |

- Model: `gemini-2.0-flash-exp` (cheapest, ~$0.000016/operation)
- Fallback: `gemini-1.5-flash`
- Rate limits: 100 operations/hour, 500/month
- AI never auto-sends — only suggests text

### LLM Stack (Domain Prediction & Pattern Ranking)

All LLM tasks — domain prediction, pattern prediction, and email ranking — use a unified 3-tier fallback chain (`lib/llm-client.ts`):

1. **Gemini Flash 2.0** (`gemini-2.0-flash-exp`) — primary, cheapest (~$0.0000188/1K input tokens)
2. **Mistral 3B** (`ministral-3b-latest`) — fallback if Gemini is unavailable
3. **DeepSeek R1** (`deepseek-reasoner`) — third fallback; `<think>` blocks are stripped before returning

**Domain prediction** — Cascade layer 4; predicts company email domains from company name. Especially effective for acronyms and non-obvious names. Cached 30 days on hit, 1 hour on miss.

**Pattern ranking** — After generating 6 candidates in Phase 2, Gemini Flash ranks them and selects the top 2 for SMTP verification.

### Personalization Engine

- Extracts context from LinkedIn profiles: education, skills, activity, social proof
- Generates smart icebreakers:
  - Shared school (95% relevance)
  - Mutual connections (90%)
  - Recent activity (85%)
- Company-specific context for 15+ major tech companies
- Subject line generator with quality scoring

---

## Subscription & Billing

### Payment Processor: DodoPayments (NOT Stripe)

**Client:** `lib/dodo.ts` — lazy Proxy-based singleton (`dodopayments` npm package)

### Key Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/subscription/checkout` | POST | `dodo.subscriptions.create()` → returns `payment_link` |
| `/api/v1/subscription/status` | GET | DB-only subscription status check |
| `/api/v1/subscription/portal` | POST | `dodo.customers.customerPortal.create(customerId)` → `{ link }` |
| `/api/v1/subscription/invoices` | GET | `dodo.payments.list({ customer_id })` |
| `/api/v1/dodo/webhook` | POST | Webhook handler with Standard Webhooks verification |

### Webhook Events

| Event | Action |
|-------|--------|
| `subscription.active` | Set plan, status='active' |
| `subscription.renewed` | Set status='active' |
| `subscription.updated` | Update status from event data |
| `subscription.on_hold` | Set status='past_due' |
| `subscription.cancelled` / `.expired` / `.failed` | Set plan='free', status='canceled' |

Webhook verification uses `client.webhooks.unwrap()` with headers: `webhook-id`, `webhook-signature`, `webhook-timestamp`.

### Product IDs

Configured per plan and billing cycle via env vars:
- `DODO_STARTER_PRODUCT_ID_GLOBAL_MONTHLY`, `_QUARTERLY`
- `DODO_PRO_PRODUCT_ID_GLOBAL_MONTHLY`, `_QUARTERLY`, `_YEARLY`

Helper: `getDodoProductId(region)` in `lib/pricing-config.ts`

### Quota System (`lib/quota.ts`)

- `QuotaExceededError` — thrown when limit reached
- `incrementEmailGeneration(userId)` — atomic increment with check
- `incrementAIDraftGeneration(userId)` — AI draft quota check
- Quota exceeded response: `402 { error: 'quota_exceeded', feature, used, limit, plan_type, upgrade_url }`
- Monthly reset via SQL function `reset_expired_quotas()`

### UI Components

- `context/SubscriptionContext.tsx` + `SubscriptionProvider` (wrapped in dashboard layout)
- `components/subscription/PlanBadge.tsx`, `UpgradePrompt.tsx`, `QuotaWarningBanner.tsx`
- `hooks/useQuotaGate.ts` — gate actions behind quota check
- `app/dashboard/upgrade/page.tsx`, `app/dashboard/settings/billing/page.tsx`

### DB Columns (in `user_profiles`)

- `plan_type` (free | starter | pro)
- `subscription_status` (active | past_due | cancelled | paused)
- `dodo_customer_id` — stored in `stripe_customer_id` column (legacy naming)
- `dodo_subscription_id` — stored in `stripe_subscription_id` column (legacy naming)
- `dodo_product_id`

---

## Chrome Extension

**Location:** `extension/` directory

- Manifest V3 Chrome Extension
- Sidepanel UI for LinkedIn profile extraction
- Extracts profile data from LinkedIn pages (name, company, role, education, etc.)
- Syncs contacts to web app via:
  - `POST /api/extension/sync-contact` (single)
  - `POST /api/extension/sync-batch` (batch)
- Auth bridge: `app/extension-auth/` connects extension sessions to web app
- Extension heartbeat tracked via `extension_last_seen` in `user_profiles`

### Extension Onboarding

- 5-step interactive guided tour with spotlight effects
- Progress checklist tracking 5 milestones
- Contextual empty states (queue, drafts, not on LinkedIn, no API key)
- Keyboard shortcuts: `?` help, `Ctrl+Enter` send, `Ctrl+E` edit, `Ctrl+K` copy

### Email Verification Badges

If SMTP verification succeeds for either of the top 2 Gemini-ranked candidates, a **Verified** badge is shown next to the email in the extension sidepanel and dashboard. If verification fails for both candidates, the LLM's most probable email is displayed without a verified badge, labelled as "Most Probable (LLM Suggested)".

---

## Dashboard & Lead Management

### Main Dashboard (`/dashboard`)

- Contacts table with search, filter, pagination (TanStack React Table, 20 leads/page)
- Email discovery form with real-time progress indicators
- Discovery history
- CSV export
- Layout: `DashboardShell` wrapper with sidebar navigation

### Lead Lifecycle

Status tracking: `discovered → sent → bounced → replied`

### Settings (`/dashboard/settings/`)

Sidebar layout with tabs: Account | Billing & Plan

---

## Outreach Sequences

**Location:** `lib/sequence-engine.ts`, `lib/tracker-v2.ts`

| Route | Purpose |
|-------|---------|
| `GET/POST /api/sequences` | CRUD sequences |
| `POST /api/sequences/[id]/enroll` | Enroll contacts in sequence |
| `POST /api/sequences/execute` | Execute next sequence step |

- Multi-step email sequences with configurable timing and conditions
- Contact enrollment and step tracking
- Components: `SequenceBuilder.tsx`, `SequenceTimeline.tsx`, `SequenceCard.tsx`

---

## Analytics & Observability

### User Analytics

- Overview metrics: total contacts, drafts, emails sent, reply rate
- Time-series charts (Recharts): contacts added, email activity trends
- Sequence performance table (sortable)
- Contact insights: top companies, job titles, source breakdown
- Activity heatmap: day x hour grid
- Date range filters with period comparison
- PDF/CSV export

### Admin Analytics

| Endpoint | Dashboard |
|----------|-----------|
| `GET /api/admin/domain-accuracy` | Domain resolution accuracy (pie + bar charts) |
| `GET /api/admin/verification-stats` | Email verification stats |

### Domain Resolution Logging

`lib/domain-resolution-analytics.ts` — fire-and-forget logger writes to `domain_resolution_logs` table with:
- Layers attempted (JSONB)
- Resolution source
- Confidence score
- Timing data

### Error Monitoring

Sentry integration for error tracking and performance monitoring. Source maps uploaded in CI/CD.

---

## Authentication & Security

### Auth Strategy

- Supabase Auth with JWT stored in HTTP-only cookies (`@supabase/ssr`)
- Row-Level Security (RLS) on all Supabase tables
- Service-role client (`createServiceRoleClient()` from `lib/supabase/server.ts`) for privileged operations — **async, always await**
- Browser client: `createClient()` from `lib/supabase/client.ts`

### Security Measures

- CSRF protection via `edge-csrf` library
- Admin endpoint guard: `lib/auth/admin-endpoint-guard.ts` (token + IP whitelist)
- Rate limiting via Upstash Redis
- Source map hiding in production
- No third-party data sales

### Admin Protection

- `SECRET_ADMIN_TOKEN` env var for admin API auth
- `ADMIN_IP_WHITELIST` for IP-based access control
- `ENABLE_DEBUG_ENDPOINTS` toggle

---

## Caching Strategy

| Cache | Key Pattern | TTL | Purpose |
|-------|-------------|-----|---------|
| Domain lookup | `cache:domain-lookup:clearbit:{company}` | 7d hit, 1h miss | Domain resolution |
| MX verification | `cache:mx-verification:email-verification:{domain}` | 24h | DNS MX records |
| Email patterns | `cache:email-patterns:{domain}` | 7d | Generated patterns |
| Primary pattern | `cache:domain-primary-pattern:{domain}` | 7d | Fast path — skip Gemini if primary known |
| Rate limiting | Per-user keys | Monthly | Quota enforcement |

Redis layer: Vercel KV (`KV_REST_API_URL`) with Upstash fallback (`UPSTASH_REDIS_REST_URL`).

Background refresh enabled to prevent cache stampede.

---

## Database Schema

### Core Tables

**user_profiles**
- `id` (UUID, FK to auth.users), `full_name`, `email`, `avatar_url`
- `plan_type` (free|starter|pro), `subscription_status` (active|past_due|cancelled|paused)
- `dodo_customer_id`, `dodo_subscription_id`, `dodo_product_id`
- `extension_last_seen`

**user_quotas**
- `user_id`, `email_lookups_used`, `email_lookups_limit`
- `ai_draft_generations_used`
- `period_start`, `period_end`, `reset_date`

**contacts**
- `id`, `user_id`, `first_name`, `last_name`, `email`, `company_name`, `role`
- `linkedin_url`, `phone`, `discovery_source`, `created_at`, `updated_at`
- Real-time subscriptions enabled

**email_templates** — `id`, `user_id`, `name`, `subject`, `body`, `tone`

**sequences** — `id`, `user_id`, `name`, `description`, `steps` (JSONB)

**sequence_enrollments** — `id`, `sequence_id`, `contact_id`, `status`, `current_step_index`, `next_step_at`

**domain_cache** — `company_name` (PK), `domain`, `mx_records` (JSONB), `last_verified` (TTL: 7d)

**domain_resolution_logs** — `id`, `user_id`, `company_name`, `domain`, `layers_attempted` (JSONB), `resolution_source`, `confidence_score`

**pattern_learning** — `domain`, `pattern`, `success_count`, `total_attempts`, `success_rate`, `is_primary` (boolean, default false), `last_verified_at` (timestamp)
- Index: `idx_pattern_learning_primary ON pattern_learning(domain, is_primary)`

**dodo_webhook_events** — `id`, `event_type`, `user_id`, `raw_payload` (JSONB), `processed_at`

**activity_log** — Event tracking for analytics and audit

### SQL Functions

- `reset_expired_quotas()` — Monthly quota reset
- `ensure_user_quota(user_id)` — Auto-create quota record if missing
- `check_and_increment_quota(user_id)` — Atomic increment with limit check
- `check_and_increment_ai_draft(user_id)` — AI draft quota check

### Migrations

Located in `lib/db/migrations/` (numbered, idempotent, run manually in Supabase SQL editor):
- `001_complete_foundation.sql` — Base schema
- `006_subscription_quotas.sql` — Quota system + `ai_draft_generations_used`
- `008_starter_plan.sql` — Starter plan support
- `009_extension_heartbeat.sql` — Extension tracking

---

## API Routes Reference

### Email Discovery
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/enrich` | Full pipeline: domain + patterns + verification |
| POST | `/api/predict-patterns` | Pattern generation only |
| POST | `/api/predict-email` | Single email prediction |
| POST | `/api/resolve-domain` | Domain resolution only |
| POST | `/api/resolve-domain-v2` | Enhanced domain resolver |

### Auth
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/v1/auth/signup` | User registration |
| POST | `/api/v1/auth/validate-password` | Password validation |
| POST | `/api/v1/auth/change-password` | Change password |
| GET | `/api/v1/auth/gmail` | Gmail OAuth flow |
| POST | `/api/v1/auth/outlook` | Outlook integration |

### Contacts
| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/v1/contacts` | List / create contacts |
| GET/PATCH/DELETE | `/api/v1/contacts/[id]` | Individual contact ops |

### Subscription
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/v1/subscription/checkout` | Create checkout (returns `payment_link`) |
| GET | `/api/v1/subscription/status` | DB-only status |
| POST | `/api/v1/subscription/portal` | Customer portal link |
| GET | `/api/v1/subscription/invoices` | List invoices |
| POST | `/api/v1/dodo/webhook` | Webhook handler |
| GET | `/api/v1/pricing-region` | Get pricing region |

### AI
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/ai/generate-template` | Generate email from scratch |
| POST | `/api/ai/enhance-draft` | Enhance existing draft |
| POST | `/api/ai/customize-tone` | Change email tone |

### Quota
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/quota/status` | Current quota usage |
| GET | `/api/quota/check` | Check if action allowed |

### Analytics & Admin
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/v1/analytics/route` | Track events |
| GET | `/api/v1/analytics/user` | User analytics |
| GET | `/api/admin/domain-accuracy` | Domain resolution stats |
| GET | `/api/admin/verification-stats` | Verification stats |

### Extension
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/extension/sync-contact` | Sync single contact |
| POST | `/api/extension/sync-batch` | Batch sync contacts |

### Sequences
| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/sequences` | CRUD sequences |
| POST | `/api/sequences/[id]/enroll` | Enroll contacts |
| POST | `/api/sequences/execute` | Execute next step |

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Chrome Extension
NEXT_PUBLIC_CHROME_EXTENSION_ID=

# ZeroBounce Email Validation
ZEROBOUNCE_API_KEY=

# LLM Stack (Gemini primary, Mistral fallback, DeepSeek third fallback)
GOOGLE_AI_API_KEY=
MISTRAL_API_KEY=
DEEPSEEK_API_KEY=

# Redis / Vercel KV (cache + rate limiting)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
KV_REST_API_URL=
KV_REST_API_TOKEN=

# DodoPayments
DODO_PAYMENTS_API_KEY=
DODO_PAYMENTS_WEBHOOK_KEY=
DODO_PAYMENTS_ENVIRONMENT=test_mode  # or live_mode
DODO_STARTER_PRODUCT_ID_GLOBAL_MONTHLY=
DODO_STARTER_PRODUCT_ID_GLOBAL_QUARTERLY=
DODO_PRO_PRODUCT_ID_GLOBAL_MONTHLY=
DODO_PRO_PRODUCT_ID_GLOBAL_QUARTERLY=
DODO_PRO_PRODUCT_ID_GLOBAL_YEARLY=

# Sentry
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=ellyn
SENTRY_AUTH_TOKEN=

# Admin
ENABLE_DEBUG_ENDPOINTS=false
SECRET_ADMIN_TOKEN=
ADMIN_IP_WHITELIST=127.0.0.1
```

---

## Coding Conventions

### Naming
| Context | Convention | Example |
|---------|-----------|---------|
| Database columns | snake_case | `email_lookups_used` |
| Variables & functions | camelCase | `incrementEmailGeneration` |
| React components | PascalCase | `PlanBadge.tsx` |
| Component files | PascalCase | `components/subscription/PlanBadge.tsx` |
| Hooks | camelCase | `hooks/useQuotaGate.ts` |
| Constants | UPPER_SNAKE_CASE | `DODO_PRO_PRODUCT_ID` |

### Patterns
- **Supabase server client:** `createServiceRoleClient()` from `lib/supabase/server.ts` — **async, always await**
- **Supabase browser client:** `createClient()` from `lib/supabase/client.ts`
- **Toast notifications:** `showToast` from `lib/toast`
- **Dashboard pages:** Import `DashboardShell` from `components/dashboard/DashboardShell`
- **Fire-and-forget async:** `void asyncFn().catch(err => console.error(err))`
- **Admin-only routes:** Under `app/api/admin/`
- **SQL migrations:** `lib/db/migrations/` (numbered, e.g., `008_starter_plan.sql`)
- **Quota exceeded:** Return `402 { error: 'quota_exceeded', feature, used, limit, plan_type, upgrade_url }`
- **Pricing imports:** Use lowercase `@/components/landing/pricing/`
- **UI components:** `components/ui/Button`, `Card`, `CardContent`, `CardHeader`, `CardTitle`, etc.
- Conversion helpers: `toSnakeCase`, `toCamelCase`, `toPascalCase` from `lib/utils/naming.ts`

### Pre-PR Checks
```bash
npm run lint
npx tsc --noEmit
```

---

## Deployment

### Platform: Vercel

- Automatic deployments from git
- Environment variables managed in Vercel dashboard
- ESLint errors ignored during build (configured in `next.config.js`)

### Pre-Deployment Checklist

1. All env vars set in Vercel dashboard
2. Database migrations run in Supabase SQL editor
3. Sentry DSN configured for error monitoring
4. DodoPayments webhook URL registered
5. Chrome Extension ID set for extension auth

### Post-Deployment

- Smoke test: `/api/enrich` with known company
- Check Sentry for errors
- Verify webhook delivery in DodoPayments dashboard
- Test extension sync flow

### Architectural Patterns Summary

| Pattern | Where Used |
|---------|-----------|
| Layered Cascade | Domain resolution (6 layers) |
| Circuit Breaker | External API resilience (`lib/api-circuit-breaker.ts`) |
| Cache-Aside | Redis + in-memory caching |
| Lazy Proxy Singleton | DodoPayments client (`lib/dodo.ts`) |
| Context + Hooks | Global subscription state |
| RLS + Service Role | Database security |
| Fire-and-Forget | Analytics logging |
| Webhook Handler | DodoPayments events |
| Rate Limiter | Per-user request throttling |
| Admin Guard | Privileged endpoint protection |

---

## Landing Page

- **Theme:** Light — off-white (#FAFAFA), deep purple text (#2D2B55)
- **Typography:** Fraunces serif for headings, DM Sans for body
- **Tone:** Professional, trustworthy, enterprise-ready — appeals to both job seekers and sales professionals
- **Sections:** Hero → Use Cases → Features → How It Works → Trust & Compliance → Pricing → Testimonials → About → FAQ → Final CTA → Footer
- **Dual-audience strategy:** Unified messaging throughout (audience-neutral language), with a dedicated Use Cases section showing both audiences side-by-side
- **Compliance emphasis:** Trust & Compliance section covers data protection, CAN-SPAM/GDPR, and no-LinkedIn-automation pledge
- **Design:** Generous spacing (120px), max 1200px width, soft shadows, rounded corners

---

## Legal

- **Privacy Policy:** `PRIVACY.md` — No third-party data sales; collects name, email, professional info
- **Terms of Service:** `TERMS.md` — Governing law: jurisdiction of Eigenspace Technologies PVT. Ltd.
