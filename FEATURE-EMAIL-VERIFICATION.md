# Email Verification Feature

## Overview

Email verification in Ellyn uses a two-layer approach to give each generated address a reliable confidence score:

1. **DNS MX verification** â€” free, always on. Confirms the target domain has a functioning mail server and identifies the email provider (Google Workspace, Microsoft 365, etc.).
2. **Abstract API address verification** â€” $0.001/call, runs on the top 3 candidates per discovery request. Performs a real deliverability check against the Abstract Email Validation API and returns a definitive `DELIVERABLE`, `UNDELIVERABLE`, `RISKY`, or `UNKNOWN` label.

SMTP handshake verification is **not used**. It was removed because major providers block port-25 probes, making results unreliable and misleading.

---

## How Verification Works

### Step 1 â€” Domain MX check (every request)

```
verifyDomainMxRecords(domain) â†’ DomainVerificationResult
```

- Resolves MX records via Node.js `dns.resolveMx`
- Result cached 24 hours in Redis/Vercel KV
- Detects email provider from MX hostnames:
  - `*.google.com` / `*.googlemail.com` â†’ `google`
  - `*.outlook.com` / `*.office365.com` / `*.microsoft.com` â†’ `microsoft`
  - Everything else â†’ `custom`
- If the domain has **no MX records**, address-level verification is **skipped entirely** â€” there is no mail server to verify against.

### Step 2 â€” Pattern confidence scoring

Each generated pattern receives a base confidence from `calculateEnhancedConfidence()`:

| Factor | Effect |
|--------|--------|
| Provider preference match (e.g. `first.last` on Google Workspace) | +5 to +15 |
| Provider preference penalty (e.g. `f.last` on Microsoft 365) | âˆ’5 |
| Domain unresolvable (no MX, ENOTFOUND) | âˆ’15, floored at 10 |
| Invalid email format | âˆ’40, floored at 5 |
| Maximum for unverified patterns | **capped at 85** |

The 86â€“95 band is reserved exclusively for addresses confirmed deliverable by the Abstract API.

### Step 3 â€” Abstract API address verification (top 3 per request)

Runs in parallel on the 3 highest-confidence patterns using `Promise.allSettled`. Each call has a 10-second timeout.

```
  &email=john.doe@acme.com
```

The deliverability label maps directly to the final confidence score:

| Abstract label | Meaning | Confidence | Status shown |
|----------------|---------|-----------|--------------|
| `DELIVERABLE` | SMTP confirmed mailbox exists | **95** | âœ“ Verified |
| `UNDELIVERABLE` | SMTP confirmed hard bounce | **5** | âœ— Invalid |
| `RISKY` | Catch-all / spam-trap risk | **35â€“45** (based on `quality_score`) | ? Unverified |
| `UNKNOWN` | Abstract couldn't determine | Base confidence unchanged | ? Unverified |
| (API error / timeout) | No determination | Base confidence unchanged | ? Unverified |

After scoring, all patterns are re-sorted descending by confidence before being returned.

---

## Daily Verification Quotas

Abstract API calls are counted per user per UTC day to control costs.

| Plan | Daily limit | Quota reset |
|------|-------------|-------------|
| Free | **10 verifications/day** | Midnight UTC |
| Pro | **100 verifications/day** | Midnight UTC |

When a user's quota is exhausted, the discovery request still succeeds â€” patterns are returned with their pattern-based confidence scores and `verificationStatus: 'unverified'`. No error is surfaced to the user.

Quota is tracked via the `api_costs` table (counting rows with `service='abstract'` and `metadata.source='abstract'` for the current UTC day).

---

## Caching

Address verification results are cached in Redis/Vercel KV for **7 days**:

- **Cache key:** `email:verification:<normalised-email>`
- A cache hit costs $0 (no Abstract API call) and is logged to `api_costs` with `cost_usd: 0` and `source: 'cache'` for accurate cache-hit-rate reporting.
- Only `DELIVERABLE`, `UNDELIVERABLE`, and `RISKY` results are cached. `UNKNOWN`, errors, and timeouts are **not cached** so they can be retried on the next request.

---

## API Endpoints

### `POST /api/generate-emails`

Main discovery endpoint. Generates patterns and automatically verifies the top 3.

**Request:**
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "companyName": "Acme",
  "companyDomain": "acme.com",
  "role": "Head of Sales"
}
```

**Response:**
```json
{
  "success": true,
  "domain": "acme.com",
  "domainSource": "provided",
  "companySize": "medium",
  "verification": {
    "verified": true,
    "hasMxRecords": true,
    "mxRecordCount": 2,
    "emailProvider": "google",
    "providerName": "Google Workspace",
    "status": { "icon": "âœ“", "text": "Valid domain", "color": "text-green-600" }
  },
  "learning": {
    "hasLearnedPatterns": false,
    "learnedPatternCount": 0
  },
  "emails": [
    {
      "email": "jane.doe@acme.com",
      "pattern": "first.last",
      "confidence": 95,
      "learned": false,
      "verificationStatus": "verified",
      "verification": {
        "domainVerified": true,
        "formatValid": true,
        "emailProvider": "google"
      }
    },
    {
      "email": "j.doe@acme.com",
      "pattern": "f.last",
      "confidence": 65,
      "learned": false,
      "verificationStatus": "unverified",
      "verification": {
        "domainVerified": true,
        "formatValid": true,
        "emailProvider": "google"
      }
    }
  ],
  "message": "Generated 8 email patterns with verification",
  "metadata": {
    "firstName": "Jane",
    "lastName": "Doe",
    "companyName": "Acme",
    "role": "Head of Sales"
  }
}
```

**Error responses:**

| Status | Body | Cause |
|--------|------|-------|
| 401 | `{ "error": "Unauthorized" }` | Not signed in |
| 402 | `{ "error": "quota_exceeded", "feature": "email_generation", ... }` | Monthly email generation quota hit |
| 400 | `{ "error": "Validation failed", "details": [...] }` | Missing/invalid fields |
| 400 | `{ "error": "Could not determine company domain" }` | Domain unknown and not inferrable |

---

### `POST /api/verify-email`

Standalone per-address verifier. Checks the `verified_emails` Redis cache first, then calls Abstract API.

**Request:**
```json
{
  "email": "jane.doe@acme.com",
  "baseConfidence": 75
}
```

**Response:**
```json
{
  "success": true,
  "email": "jane.doe@acme.com",
  "deliverability": "DELIVERABLE",
  "confidence": 95,
  "verificationStatus": "verified",
  "cached": false,
  "rateLimit": { "source": "abstract" }
}
```

When the daily quota is exhausted this endpoint returns HTTP 402:
```json
{
  "error": "verification_quota_exceeded",
  "used": 10,
  "limit": 10,
  "planType": "free",
  "resetAt": "2026-02-20T00:00:00.000Z"
}
```

---

## Cost Tracking

Every Abstract API call (and every cache hit) is recorded in the `api_costs` table:

```sql
-- Live API call
INSERT INTO api_costs (user_id, service, cost_usd, metadata) VALUES (
  'user-uuid',
  'abstract',
  0.001,
  '{
    "endpoint": "verify-email",
    "email": "jane.doe@acme.com",
    "domain": "acme.com",
    "deliverability": "DELIVERABLE",
    "source": "abstract",
    "costModel": "$0.001 per verification",
    "calledFrom": "generate-emails"
  }'
);

-- Cache hit (no charge)
INSERT INTO api_costs (user_id, service, cost_usd, metadata) VALUES (
  'user-uuid',
  'abstract',
  0.000,
  '{ "endpoint": "verify-email", "source": "cache", ... }'
);
```

Admin stats are available at `GET /api/admin/verification-stats` (requires `x-admin-secret` header). Returns period stats (today / 7 days / 30 days), top domains, per-user usage, and cache hit rate.

---

## Confidence Score Reference

| Score range | Meaning |
|-------------|---------|
| 95 | Abstract API: DELIVERABLE â€” mailbox confirmed |
| 86â€“94 | (reserved â€” not currently assigned) |
| 70â€“85 | High pattern confidence (Google first.last, learned patterns) |
| 50â€“69 | Medium pattern confidence |
| 35â€“45 | Abstract API: RISKY â€” catch-all or spam-trap risk |
| 10â€“34 | Low pattern confidence or unresolvable domain |
| 5 | Abstract API: UNDELIVERABLE â€” hard bounce confirmed |

---

## Verification Status Types

```typescript
type EmailVerificationStatus = 'verified' | 'invalid' | 'unverified'
```

| Status | Icon | When assigned |
|--------|------|---------------|
| `verified` | âœ“ green | Abstract API returned `DELIVERABLE` |
| `invalid` | âœ— red | Abstract API returned `UNDELIVERABLE` |
| `unverified` | ? gray | Abstract returned `RISKY`/`UNKNOWN`, timed out, quota exhausted, or no MX records |

**Do not disable a "Select" button for `unverified` emails.** An unverified email still has pattern-based confidence; users should be able to select it. Only `invalid` emails should be visually de-emphasised.

---

## Environment Variables

```env
# Required for address-level verification

# Optional: override daily verification limits (defaults: free=10, pro=100)
# (not currently exposed; change DAILY_VERIFICATION_LIMITS in lib/verification-quota.ts)
```


---

## Architecture Diagram

```
POST /api/generate-emails
        â”‚
        â”œâ”€ Auth + quota check (incrementEmailGeneration)
        â”‚
        â”œâ”€ Domain resolution (provided â†’ known â†’ cache â†’ inferred)
        â”‚
        â”œâ”€ verifyDomainMxRecords(domain)         â† DNS, cached 24h
        â”‚       â””â”€ detects: google / microsoft / custom
        â”‚
        â”œâ”€ generateSmartEmailPatternsCached(...)  â† 8+ patterns
        â”‚
        â”œâ”€ calculateEnhancedConfidence(...)       â† per pattern, cap 85
        â”‚
        â”œâ”€ getDailyVerificationQuota(userId)      â† DB count query
        â”‚       â””â”€ if allowed && hasMxRecords:
        â”‚               â””â”€ verifyEmailAddress Ã— 3  â† Abstract API, 10s timeout
        â”‚                       â””â”€ calculateDeliverabilityConfidence()
        â”‚
        â””â”€ sort by confidence, return
```

---

## Security & Privacy

- Abstract API calls are made **server-side only**. The API key is never exposed to the browser.
- Email addresses are stored in Redis only as a normalised hash key; the raw address appears in the cache value but is not indexed or queryable.
- Cost records in `api_costs` store the email for audit purposes but access is restricted to service-role clients.
- Daily quotas prevent runaway API spend. The fail-open policy (quota check errors â†’ allow) ensures infra issues never block users.

---

## Troubleshooting

**All emails show "unverified"**
- Verify the user has remaining daily quota (`GET /api/admin/verification-stats`).
- Confirm the target domain has MX records (`verifyDomainMxRecords` result in response body).

**Abstract API returns all `RISKY`**
- The domain likely uses a catch-all mailbox (accepts all addresses). This is normal for many SMB domains. Confidence 35â€“45 is the correct signal.

**Verification quota exhausted too quickly**
- Check `/api/admin/verification-stats` for per-user breakdown.
- Consider upgrading users to Pro (100/day) or adjusting `DAILY_VERIFICATION_LIMITS` in `lib/verification-quota.ts`.

**Costs higher than expected**
- Ensure the Redis cache is functioning. A healthy cache hit rate should be 40â€“60% for active users. Check `cacheHitRate` in the admin stats endpoint.
