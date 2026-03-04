# Email Finder

Last updated: 2026-03-04

The enrich pipeline is implemented in `app/api/enrich/route.ts` and runs with graceful degradation when optional providers are unavailable.

## Pipeline Status

| Phase | Status | Notes |
| --- | --- | --- |
| Domain resolution cascade | ✅ | Multi-layer fallback in `lib/domain-resolution-service.ts`. |
| Pattern generation | ✅ | Candidate generation in `lib/enhanced-email-patterns.ts`. |
| Pattern ranking with LLM | ✅ | Uses Gemini when available, static fallback when not. |
| MX verification | ✅ | Always attempted first via `lib/mx-verification.ts`. |
| SMTP verification (ZeroBounce) | ✅ | Up to 2 checks; skipped when API key is missing. |
| Domain resolution logging | ✅ | Writes to `domain_resolution_logs` fire-and-forget. |

## API Routes

All routes have both a legacy (`/api/`) and versioned (`/api/v1/`) form.

| Route | Status | Purpose |
| --- | --- | --- |
| `POST /api/v1/enrich` | ✅ | End-to-end domain + pattern + verification pipeline. |
| `POST /api/v1/predict-patterns` | ✅ | Pattern-only candidate prediction endpoint. |
| `POST /api/v1/predict-email` | ✅ | Extended AI-assisted prediction endpoint. |
| `POST /api/v1/resolve-domain` | ✅ | Domain-only lookup route. |
| `POST /api/v1/resolve-domain-v2` | ✅ | Improved domain resolution (v2 cascade). |
| `POST /api/v1/verify-email` | ✅ | Standalone email verification (ZeroBounce or MX). |
| `POST /api/v1/zerobounce-verify` | ✅ | ZeroBounce-only verification endpoint. |
| `POST /api/v1/confirm-domain` | ✅ | Confirm/lock a domain association to a company. |
| `POST /api/v1/learning/record` | ✅ | Record outcome of email prediction (success/failure) for pattern learning. |
| `POST /api/v1/pattern-feedback` | ✅ | User feedback on suggested email patterns. |
| `POST /api/v1/email-feedback` | ✅ | User feedback on a predicted email address. |
| `POST /api/v1/ai/infer-domain` | ✅ | AI-assisted company domain inference from name/context. |
| `POST /api/v1/ai/company-brief` | ✅ | AI-generated company research brief. |
| `POST /api/v1/smtp-probe` | ✅ | Direct SMTP handshake verification (non-Google/MS domains). |

## Pattern Learning System

- `lib/pattern-learning.ts` and `lib/learning-system.ts` — record successes/failures per domain to improve future predictions.
- Learning data stored in `pattern_learning` table.
- Feedback routes (`pattern-feedback`, `email-feedback`) allow explicit user corrections.

## Graceful Fallback Rules

- ✅ Missing `GOOGLE_AI_API_KEY`: skip Gemini ranking and use static confidence ordering.
- ✅ Missing `ZEROBOUNCE_API_KEY`: skip SMTP verification and return `most_probable` result.
- ✅ Missing `CLEARBIT_API_KEY`: skip Clearbit layer in domain resolution.
- ✅ Missing optional LLM providers (Mistral/DeepSeek): return best available non-LLM output.
- ✅ Optional-provider failures do not crash the request; pipeline falls through to next layer.

## Environment Variables by Layer

| Layer/Capability | Env vars | Required? |
| --- | --- | --- |
| Supabase auth and DB access | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Required |
| Gemini (primary ranking/generation) | `GOOGLE_AI_API_KEY` | Optional |
| Mistral fallback | `MISTRAL_API_KEY` | Optional |
| DeepSeek fallback | `DEEPSEEK_API_KEY` | Optional |
| ZeroBounce SMTP verification | `ZEROBOUNCE_API_KEY` | Optional |
| Clearbit domain layer | `CLEARBIT_API_KEY` | Optional |
| Google search domain layer | `GOOGLE_CUSTOM_SEARCH_API_KEY`, `GOOGLE_SEARCH_ENGINE_ID` | Optional |

## Standard Success Response Shape

```json
{
  "success": true,
  "result": {
    "email": "string",
    "pattern": "string",
    "confidence": 0,
    "verified": false,
    "badge": "verified | most_probable | domain_no_mx",
    "verificationSource": "zerobounce | mx_only"
  },
  "domain": "string",
  "metadata": {
    "companySize": "string",
    "emailProvider": "string",
    "domainSource": "string",
    "patternsChecked": 0
  }
}
```
