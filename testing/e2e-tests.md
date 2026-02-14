# End-to-End Testing Plan

## Test Environment Setup
- [ ] Local Next.js server running on `http://localhost:3000`
- [ ] Supabase database reachable from local app
- [ ] Migrations applied:
  - [ ] `lib/db/migrations/001_complete_foundation.sql`
  - [ ] `lib/db/migrations/003_quota_management.sql`
  - [ ] `lib/db/migrations/004_analytics_tracking.sql`
- [ ] Chrome extension loaded unpacked from `extension/`
- [ ] Test LinkedIn profile set (public profiles allowed)
- [ ] API keys configured (`ANTHROPIC_API_KEY`, `ABSTRACT_API_KEY`)
- [ ] Extension auth bridge validated (`AUTH_SUCCESS` message reaches extension)
- [ ] Dev tools ready:
  - [ ] Chrome extension service worker logs
  - [ ] Network tab in web app
  - [ ] Supabase SQL editor for validation queries

## Core Test Scenarios

### Scenario 1: Happy Path (Cache Miss)
1. Open LinkedIn profile: `https://www.linkedin.com/in/satya-nadella`
2. Open extension sidepanel
3. Click `Find Email`
4. Verify stages in order:
   - [ ] `Extracting LinkedIn data...`
   - [ ] `Resolving company domain...`
   - [ ] `Generating email patterns...`
   - [ ] `Verifying email...`
5. Verify result card:
   - [ ] Email returned (`satya.nadella@microsoft.com` or plausible variant)
   - [ ] Confidence displayed
   - [ ] Source shown (`abstract_verified` / `llm_best_guess`)
   - [ ] Cost displayed
6. Verify DB writes:
   - [ ] `user_quotas.email_lookups_used` incremented (via `/api/quota/check`)
   - [ ] `api_costs` row inserted for Anthropic and/or Abstract calls
   - [ ] `email_lookups` row inserted via analytics tracking
7. Verify UI actions:
   - [ ] `Copy` places email on clipboard
   - [ ] `Save to Contacts` stores locally (or backend if wired later)
   - [ ] Toast appears for both actions
8. Submit feedback:
   - [ ] `Yes` sends `/api/pattern-feedback` payload
   - [ ] Feedback UI hides after submit

### Scenario 2: Happy Path (Cache Hit)
1. Run lookup again for same company domain
2. Verify:
   - [ ] Response time significantly reduced
   - [ ] Source indicates cache when applicable (`cache_verified`)
   - [ ] Cost lower than full path
   - [ ] Quota still decremented

### Scenario 3: Quota Limit Reached
1. Exhaust free quota (`25/month`)
2. On next lookup:
   - [ ] `/api/quota/check` returns `429`
   - [ ] Extension shows upgrade CTA
   - [ ] Reset date appears (if provided)
   - [ ] Find button is disabled or blocked

### Scenario 4: Domain Resolution Failure
1. Use profile at unknown/ambiguous company
2. Verify:
   - [ ] Error card appears
   - [ ] Message is actionable
   - [ ] Retry button retriggers workflow
   - [ ] Quota behavior matches product policy

### Scenario 5: Verification Timeout / Provider Error
1. Simulate latency or block Abstract API
2. Verify:
   - [ ] Timeout handled without hanging UI
   - [ ] Fallback path returns partial result if available
   - [ ] Warning/error is visible
   - [ ] Service worker does not crash

### Scenario 6: LinkedIn Extraction Edge Cases
1. Test profiles with:
   - [ ] Single-word names
   - [ ] Non-English characters
   - [ ] Sparse profile metadata
2. Verify:
   - [ ] Clear error if extraction fails
   - [ ] No uncaught runtime exceptions
   - [ ] Manual fallback path remains usable

### Scenario 7: Offline / Intermittent Network
1. Disconnect network
2. Trigger lookup
3. Verify:
   - [ ] User sees clear network error
   - [ ] UI recovers after reconnect
   - [ ] Local cached actions (feedback queue) remain stable

## Performance Tests
- [ ] First uncached lookup: median under `5s` end-to-end
- [ ] Cached lookup: under `100ms` to visible result
- [ ] Sidepanel render: under `200ms` from open to interactive
- [ ] 100 consecutive lookups without memory growth regressions
- [ ] Service worker survives repeated wake/sleep cycles

## Security Tests
- [ ] No secret keys inside extension bundle
- [ ] Auth required for protected APIs
- [ ] User isolation enforced by RLS
- [ ] Quota and endpoint rate limits enforced
- [ ] Inputs sanitized in `predict-patterns`, `verify-email`, `track-lookup`
- [ ] CORS behavior verified for extension + web app origins

## Analytics and Cost Validation
- [ ] `/api/analytics/user?period=month` returns non-empty metrics after lookups
- [ ] `/api/analytics/admin?period=day` works for admin only
- [ ] CSV export works (`/api/analytics/user?format=csv`)
- [ ] Cost precision stored at 6 decimal places (`cost_usd`)
- [ ] Daily/weekly/monthly totals match DB query spot checks

## Cross-Browser (Optional)
- [ ] Chrome 120+
- [ ] Edge 120+
- [ ] Brave latest

## SQL Validation Queries
```sql
-- Quota usage
select user_id, email_lookups_used, email_lookups_limit, period_end
from public.user_quotas
order by updated_at desc
limit 10;

-- Recent API costs
select service, cost_usd, created_at, metadata
from public.api_costs
order by created_at desc
limit 20;

-- Recent lookup analytics
select domain, email, pattern, success, cache_hit, cost_usd, created_at
from public.email_lookups
order by created_at desc
limit 20;
```

## Exit Criteria (Must Pass Before Launch)
- [ ] All critical scenarios (1-5) pass
- [ ] No blocker/sev-1 issues open
- [ ] Monitoring and alerting active in production
- [ ] Rollback rehearsal completed
- [ ] QA sign-off recorded
