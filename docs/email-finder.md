# Email Finder

Last updated: 2026-03-05

## Purpose

The Email Finder is Ellyn's core differentiator — a 3-phase pipeline that discovers professional email addresses with high accuracy at ~100x lower cost than competitors like Hunter.io. It takes a person's name and company, resolves the company domain, generates candidate email patterns, and verifies them via SMTP probe or MX validation.

---

## Architecture Overview

```
User Input (firstName, lastName, company)
  │
  ▼
┌──────────────────────────────────────────────┐
│ Phase 1: Domain Resolution                   │
│  Clearbit → Brandfetch → Google CSE → AI     │
│  (cascading fallback, any can succeed)       │
│  Cache: domain_cache table + Redis           │
└──────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────┐
│ Phase 2: Pattern Generation & Ranking        │
│  Enhanced patterns → LLM ranking (Gemini)    │
│  Candidates: first.last, firstlast, f.last,  │
│  first_last, flast, first, etc.              │
│  Pattern learning boosts known-good formats  │
└──────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────┐
│ Phase 3: Verification                        │
│  MX check → SMTP probe (custom servers)      │
│  Confidence scoring: 10–92 scale             │
└──────────────────────────────────────────────┘
  │
  ▼
Response: { email, pattern, confidence, verified, badge }
```

### Key Design Decisions

1. **Cascading domain resolution**: Multiple providers (Clearbit, Brandfetch, Google CSE) are tried in order. If all fail, AI inference (`/api/v1/ai/infer-domain`) attempts to guess the domain from the company name. This maximizes coverage across company types.

2. **Pattern learning system**: Every successful/failed verification is recorded in `pattern_learning` and `learned_patterns` tables. Over time, the system learns which email patterns each company uses (e.g., "Acme Corp uses first.last@acme.com") and boosts those patterns for future lookups.

3. **Graceful degradation**: Every external dependency is optional. The pipeline never crashes due to a missing API key — it simply skips that layer and falls through to the next.

4. **SMTP probe**: For non-Google/non-Microsoft domains, direct SMTP handshake is free and definitive.

---

## What Is Accomplished

| Capability | Status | Details |
|-----------|--------|---------|
| Multi-provider domain resolution | ✅ Done | Clearbit → Brandfetch → Google CSE → AI inference. `lib/domain-resolution-service.ts` |
| Enhanced pattern generation | ✅ Done | 10+ pattern formats with cultural name handling. `lib/enhanced-email-patterns.ts` |
| LLM-assisted pattern ranking | ✅ Done | Gemini Flash 2.0 ranks candidates by likelihood. Falls back to static ordering. |
| MX record verification | ✅ Done | DNS-based MX lookup via `lib/mx-verification.ts`. |
| SMTP probe (direct handshake) | ✅ Done | External Go microservice at `smtp-probe-service/`. API route: `POST /api/v1/smtp-probe` |
| Pattern learning (recording) | ✅ Done | Records success/failure per domain pattern. `lib/pattern-learning.ts` |
| Pattern learning (boosting) | ✅ Done | Learned patterns get confidence boost in ranking. `lib/db/migrations/037_intelligence_system.sql` |
| Admin pattern injection | ✅ Done | `POST /api/admin/inject-patterns` for manual pattern seeding. |
| Domain resolution logging | ✅ Done | Fire-and-forget writes to `domain_resolution_logs` for accuracy tracking. |
| Structured pipeline logging | ✅ Done | Event and metric logs in `lib/email-finder/pipeline.ts`. See `docs/EMAIL_FINDER_PIPELINE_LOGGING.md` |
| Domain caching (DB + Redis) | ✅ Done | `domain_cache` table + Redis/Vercel KV for hot lookups. |
| Quota enforcement | ✅ Done | Email lookups decrement `user_quotas.email_generations_used`. |
| User feedback loops | ✅ Done | `pattern-feedback` and `email-feedback` routes for explicit user corrections. |
| Confidence score system | ✅ Done | 10–92 scale. See `docs/EMAIL_VERIFICATION_GUIDE.md` for full reference. |
| Company intelligence/brief | ✅ Done | `POST /api/v1/ai/company-brief` generates AI research summaries. |

## What Is Not Yet Accomplished

| Capability | Status | Notes |
|-----------|--------|-------|
| Bulk email discovery (batch API) | ❌ Not started | Currently one-at-a-time; no batch endpoint for CSV-style bulk lookups. |
| Catch-all domain handling | ⚠️ Partial | Detected but confidence scoring is basic (35–45). No secondary verification strategy. |
| International name patterns | ⚠️ Partial | Enhanced patterns handle some cultural formats, but CJK and Arabic names need more work. |
| SMTP probe auto-scaling | ❌ Not started | The Go microservice is single-instance; no auto-scaling or queue-based architecture yet. |
| Historical accuracy dashboard | ⚠️ Partial | Admin has domain accuracy charts, but no user-facing accuracy metrics. |
| Webhook/async verification | ❌ Not started | All verification is synchronous. Long-running verifications can time out on Vercel's 10s edge limit. |

---

## Pipeline Entry Points (API Routes)

All routes have both a legacy (`/api/`) and versioned (`/api/v1/`) form.

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/enrich` | POST | **Primary endpoint.** End-to-end domain + pattern + verification pipeline. |
| `/api/v1/predict-patterns` | POST | Pattern-only candidate prediction (no verification). |
| `/api/v1/predict-email` | POST | Extended AI-assisted prediction with LLM ranking. |
| `/api/v1/resolve-domain` | POST | Domain-only lookup (no pattern generation). |
| `/api/v1/resolve-domain-v2` | POST | Improved domain resolution with v2 cascade logic. |
| `/api/v1/verify-email` | POST | Standalone email verification (MX-only). |
| `/api/v1/confirm-domain` | POST | Confirm/lock a domain association to a company. |
| `/api/v1/learning/record` | POST | Record outcome of email prediction for pattern learning. |
| `/api/v1/pattern-feedback` | POST | User feedback on suggested email patterns. |
| `/api/v1/email-feedback` | POST | User feedback on a predicted email address. |
| `/api/v1/ai/infer-domain` | POST | AI-assisted company domain inference from name/context. |
| `/api/v1/ai/company-brief` | POST | AI-generated company research brief. |
| `/api/v1/smtp-probe` | POST | Direct SMTP handshake verification (non-Google/MS domains). |
| `/api/v1/smtp-probe/health` | GET | Health check for the SMTP probe service. |

---

## Core Files

| File | Responsibility |
|------|---------------|
| `app/api/enrich/route.ts` | Main pipeline orchestrator. Calls domain resolution → pattern generation → verification. |
| `lib/email-finder/pipeline.ts` | 3-phase pipeline implementation with structured logging. |
| `lib/email-finder/index.ts` | Public export for the email finder module. |
| `lib/domain-resolution-service.ts` | Multi-provider domain resolution with cascade fallback. |
| `lib/domain-lookup.ts` | Individual provider implementations (Clearbit, Brandfetch, Google CSE). |
| `lib/domain-inference.ts` | AI-based domain inference from company name. |
| `lib/smart-tld-resolver.ts` | TLD resolution and validation. |
| `lib/enhanced-email-patterns.ts` | Candidate email pattern generation (10+ formats). |
| `lib/email-patterns.ts` | Base pattern generation utilities. |
| `lib/email-verification.ts` | Verification orchestration (MX → SMTP). |
| `lib/mx-verification.ts` | DNS MX record lookup and validation. |
| `lib/smtp-probe.ts` | SMTP probe client (calls external Go service). |
| `lib/pattern-learning.ts` | Pattern learning system (record + boost). |
| `lib/llm-domain-prediction.ts` | LLM-based domain prediction. |
| `lib/llm-client.ts` | LLM client abstraction (Gemini → Mistral → DeepSeek). |
| `lib/company-intelligence.ts` | Company intelligence and research briefs. |
| `lib/lead-scoring.ts` | Lead scoring based on contact attributes and engagement. |

---

## Pattern Learning System

### How It Works

1. **Recording**: When a user verifies an email (success or failure), the outcome is recorded via `POST /api/v1/learning/record`. This writes to `pattern_learning` table with domain, pattern format, and result.

2. **Learned patterns table** (migration 037): `learned_patterns` stores aggregated success/failure counts per domain+pattern combination, plus a `confidence_boost` integer.

3. **Boosting**: During pattern ranking (Phase 2), the system queries `learned_patterns` for the target domain. Patterns with high success rates get their confidence scores boosted, pushing them to the top of the candidate list.

4. **Admin injection**: `POST /api/admin/inject-patterns` allows manual seeding of known patterns (e.g., from customer feedback or industry knowledge). Injected patterns are marked with `injected = true`.

5. **Feedback loops**: Users can provide explicit corrections via `pattern-feedback` and `email-feedback` routes, which feed back into the learning system.

### Tables

- `pattern_learning` — per-lookup outcome tracking (domain, pattern, success/fail, timestamp)
- `learned_patterns` — aggregated domain+pattern stats with confidence boost (migration 037)
- `domain_resolution_logs` — audit log of every domain resolution attempt

---

## Graceful Fallback Rules

| Missing Resource | Behavior |
|-----------------|----------|
| `GOOGLE_AI_API_KEY` | Skip Gemini ranking; use static confidence ordering. |
| `CLEARBIT_API_KEY` | Skip Clearbit layer in domain resolution; fall through to Brandfetch/Google CSE. |
| `MISTRAL_API_KEY` / `DEEPSEEK_API_KEY` | Skip fallback LLM providers; return best available non-LLM output. |
| Redis/KV unavailable | Fall through to direct DB lookups; no caching. Pipeline logs a warning. |
| SMTP probe service down | Skip SMTP verification; return result with pattern confidence only. |

All optional-provider failures are caught and logged — they never crash the request.

---

## Environment Variables

| Variable | Required? | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `GOOGLE_AI_API_KEY` | No | Gemini Flash 2.0 for pattern ranking |
| `MISTRAL_API_KEY` | No | Mistral 3B fallback LLM |
| `DEEPSEEK_API_KEY` | No | DeepSeek R1 fallback LLM |
| `CLEARBIT_API_KEY` | No | Clearbit domain resolution |
| `GOOGLE_CUSTOM_SEARCH_API_KEY` | No | Google Custom Search for domain resolution |
| `GOOGLE_SEARCH_ENGINE_ID` | No | Google CSE engine ID |

---

## Standard Success Response Shape

```json
{
  "success": true,
  "result": {
    "email": "jane.doe@acme.com",
    "pattern": "first.last",
    "confidence": 85,
    "verified": true,
    "badge": "verified | most_probable | domain_no_mx",
    "verificationSource": "mx_only | smtp_probe"
  },
  "domain": "acme.com",
  "metadata": {
    "companySize": "51-200",
    "emailProvider": "google",
    "domainSource": "clearbit",
    "patternsChecked": 6
  }
}
```

---

## Confidence Score Reference

| Score | Meaning |
|-------|---------|
| 92 | SMTP confirmed — mail server accepted the address |
| 70–85 | High pattern confidence (provider preference match) |
| 50–69 | Medium pattern confidence |
| 35–45 | Catch-all domain — server accepts all addresses |
| 10–34 | Low confidence — unusual format or domain issues |

---

## SMTP Probe Service

The SMTP probe is an external Go microservice (`smtp-probe-service/`) that performs direct SMTP handshakes. It is deployed separately from the Next.js app.

- **Why Go?** SMTP handshakes require raw TCP connections with timeouts, which Go handles more efficiently than Node.js edge functions with their 10s timeout.
- **Health check**: `GET /api/v1/smtp-probe/health`
- **Deployment docs**: `smtp-probe-service/DEPLOY.md`
