# Email Verification Guide

## What does "verified" mean?

When Ellyn shows a green **Verified** badge on an email address, it means the Abstract Email Validation API made a real deliverability check and confirmed that a mailbox exists at that address. This is not just a pattern guess — a mail server responded and acknowledged the inbox.

| Status | Icon | What it means |
|--------|------|---------------|
| **Verified** | ✓ green | Abstract API confirmed the mailbox exists |
| **Invalid** | ✗ red | Abstract API confirmed the address is a hard bounce — do not use |
| **Unverified** | ? gray | No determination yet — address still has a pattern-based confidence score |

**Unverified does not mean wrong.** An unverified email is a pattern-based best guess with a confidence score between 10 and 85. You can still select and use it — confidence scores tell you how likely it is to be correct.

---

## Why are some emails "unverified"?

Several things can cause an email to remain unverified:

1. **Daily quota exhausted** — Each user has a daily verification limit (10/day on Free, 100/day on Pro). Once the limit is reached, patterns are still generated but address-level verification is skipped for the rest of the day. Quota resets at midnight UTC.

2. **No MX records on domain** — If the company domain has no mail server records, there is nothing to verify against. All patterns for that domain will be unverified.

3. **Abstract API returned UNKNOWN** — The API could not make a determination. The base pattern score is kept and the address can be retried on the next request.

4. **API timeout** — Each verification attempt has a 10-second timeout. If the API is slow, the attempt is skipped gracefully.

---

## Confidence scores explained

Every email pattern gets a confidence score from 0 to 100.

| Score | Meaning |
|-------|---------|
| **95** | Abstract API confirmed DELIVERABLE — mailbox exists |
| **70–85** | High pattern confidence (e.g. `first.last` for Google Workspace, or a learned pattern) |
| **50–69** | Medium pattern confidence — plausible but less common format |
| **35–45** | Abstract API returned RISKY — catch-all mailbox or spam-trap risk |
| **10–34** | Low confidence — unusual format or domain couldn't be resolved |
| **5** | Abstract API confirmed UNDELIVERABLE — hard bounce |

The **86–94 range is reserved** and not currently assigned. Only Abstract API confirmations reach 95.

### How confidence is calculated

1. A base score is assigned from the email pattern (company size, role, provider preference).
2. Provider adjustments are applied (e.g. `first.last` is boosted on Google Workspace, penalised on small custom domains).
3. The score is capped at **85** for any unverified pattern.
4. If Abstract API verification runs, the score is replaced by the deliverability-based score above.

---

## Catch-all domains (RISKY)

Some companies configure their mail server to accept every email address, regardless of whether a real inbox exists. Abstract API labels these as `RISKY` and Ellyn assigns a confidence of 35–45.

This is the correct signal — it means the domain exists and could receive the email, but you cannot confirm whether a specific person's inbox is set up. Common in small and mid-size businesses.

---

## Daily verification limits

Abstract API calls are counted per user per UTC day.

| Plan | Verifications per day | Reset |
|------|-----------------------|-------|
| Free | 10 | Midnight UTC |
| Pro | 100 | Midnight UTC |

Each request verifies the top 3 highest-confidence patterns. If you have 4+ verifications remaining, a full request uses 3. If you have fewer than 3 remaining, only that many are verified. If quota is 0, all patterns are returned with pattern-based scores only.

Cache hits from previous verifications **do not count against your quota**. A previously verified email (within 7 days) is returned instantly at no cost.

---

## Cost structure

| Action | Cost |
|--------|------|
| Domain resolution (known/Clearbit/Brandfetch) | $0 |
| DNS MX verification | $0 |
| Pattern generation | $0 |
| Abstract API address verification (live call) | $0.001 per address |
| Abstract API address verification (cache hit) | $0 |

**Maximum cost per request:** $0.003 (3 addresses × $0.001)

For 1,000 email generation requests per month, the maximum verification cost is **$3/month** — versus $49/month for Hunter.io.

---

## Verification accuracy

| Scenario | Accuracy |
|----------|----------|
| Known domain + Abstract DELIVERABLE | ~98% |
| Known domain + pattern only | ~85–95% |
| Inferred domain + Abstract DELIVERABLE | ~90–95% |
| Inferred domain + pattern only | ~50–85% |
| Catch-all domain (RISKY) | Cannot determine specific inbox |

---

## How to get the most from verification

- **Provide `companyDomain` directly** when you know it — this skips domain resolution and saves time.
- **Use the Pro plan** if you generate emails for many contacts daily — 100 verifications/day vs 10 on Free.
- **Check confidence scores**, not just verification status. A 75-confidence unverified email from a known domain is often more reliable than a 50-confidence "verified" email from an inferred domain.
- **Treat RISKY as a signal, not a failure.** RISKY means catch-all; the email format may still be correct.

---

## Verification caching

Verified addresses are cached for **7 days**. If you look up the same email address again within 7 days, you get the cached result instantly at no cost.

Only `DELIVERABLE`, `UNDELIVERABLE`, and `RISKY` results are cached. `UNKNOWN` results and errors are not cached — they are retried on the next request.

---

## Environment variables

```env
# Required for address-level verification
ABSTRACT_API_KEY=your_key_here

# Optional: Google Custom Search (100 free queries/day)
GOOGLE_CUSTOM_SEARCH_API_KEY=your-key
GOOGLE_SEARCH_ENGINE_ID=your-engine-id
```

If `ABSTRACT_API_KEY` is not set, email patterns are still generated and returned with pattern-based confidence scores. No errors are shown to users.
