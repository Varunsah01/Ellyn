# Deployment Checklist

## Pre-Deployment

### Environment Variables
- [ ] `NEXT_PUBLIC_SUPABASE_URL` configured
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configured
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configured
- [ ] `ANTHROPIC_API_KEY` configured
- [ ] `QUOTA_ADMIN_API_KEY` configured
- [ ] `ANALYTICS_ADMIN_EMAILS` (or auth metadata admin role strategy) configured
- [ ] `SLACK_WEBHOOK_URL` configured (for cost alerts)
- [ ] `SENDGRID_API_KEY` + `ALERT_EMAIL_TO` configured (optional email alerts)

### Database
- [ ] Run production migrations in order:
  - [ ] `lib/db/migrations/001_complete_foundation.sql` (baseline for clean DBs)
  - [ ] `lib/db/migrations/003_quota_management.sql`
  - [ ] `lib/db/migrations/004_analytics_tracking.sql`
- [ ] Confirm required functions exist:
  - [ ] `check_and_increment_quota`
  - [ ] `get_quota_status`
  - [ ] `get_user_analytics`
  - [ ] `get_admin_analytics`
- [ ] Confirm RLS enabled and policies active on:
  - [ ] `user_quotas`
  - [ ] `api_costs`
  - [ ] `email_lookups`
- [ ] Confirm monthly quota reset schedule exists (`pg_cron`) or Supabase Cron equivalent
- [ ] Verify indexes present (`idx_user_quotas_*`, `idx_api_costs_*`, `idx_lookups_*`)

### Backend Deploy (Next.js)
- [ ] Run local verification:
  - [ ] `npm run build`
  - [ ] `npx tsc --noEmit`
  - [ ] `npm run test`
- [ ] Deploy:
```bash
vercel --prod
```
- [ ] Smoke test critical APIs on production:
  - [ ] `/api/quota/check`
  - [ ] `/api/quota/status`
  - [ ] `/api/resolve-domain`
  - [ ] `/api/predict-patterns`
  - [ ] `/api/verify-email`
  - [ ] `/api/analytics/user`
  - [ ] `/api/analytics/admin` (admin account)
- [ ] Confirm production logs contain no auth/session regressions

### Extension Release
- [ ] Update `extension/manifest.json`:
  - [ ] Bump `version`
  - [ ] Verify production domain in `host_permissions`
  - [ ] Verify production auth URLs and API base URLs
- [ ] Build/package extension assets
- [ ] Zip `extension/` for upload
- [ ] Test extension against production backend before submission

## Chrome Web Store Submission

### Listing Assets
- [ ] Name: `Ellyn Email Finder`
- [ ] Short description (<=132 chars)
- [ ] Full description with feature + privacy detail
- [ ] Screenshots:
  - [ ] Auth view
  - [ ] Loading/progress view
  - [ ] Results card view
  - [ ] Quota/upgrade state
- [ ] Demo video (optional but recommended)

### Privacy and Permissions
- [ ] Privacy policy URL live and accurate
- [ ] Terms URL live and accurate
- [ ] Permission justification documented:
  - [ ] `activeTab`
  - [ ] `storage`
  - [ ] LinkedIn host permissions
- [ ] Data usage disclosures completed
- [ ] Single-purpose statement included

### Review Readiness
- [ ] Internal reviewer checklist complete
- [ ] Submission notes prepared (auth bridge, sidepanel behavior)
- [ ] Team ready to answer reviewer feedback within 24h

## Post-Deployment

### Monitoring and Alerts
- [ ] Enable Vercel Analytics
- [ ] Enable Sentry (web + API + cron)
- [ ] Deploy scheduled cost alert job (`monitoring/cost-alerts.ts`) via Vercel Cron or Lambda
- [ ] Alert thresholds configured:
  - [ ] Daily > `$50`
  - [ ] Weekly > `$300`
  - [ ] Monthly > `$1000`
- [ ] Error-rate alert configured (`>5%` API failures over 15 min)
- [ ] Uptime checks configured (UptimeRobot / Better Stack)

### Admin Operations
- [ ] Admin analytics dashboard reviewed in production
- [ ] Quota admin endpoint tested with `x-admin-key`
- [ ] Alert destinations verified (Slack/email)
- [ ] Support runbook distributed to team

### User Support
- [ ] Help center updated
- [ ] FAQ includes quota, auth bridge, LinkedIn extraction troubleshooting
- [ ] Support email operational
- [ ] Incident template prepared

## Rollback Plan (Must Be Tested)
1. Disable extension listing or publish previous stable package.
2. Roll back backend deployment:
```bash
vercel rollback
```
3. If required, restore database from latest backup/snapshot.
4. Rotate leaked/compromised keys immediately.
5. Notify users and support channels.
6. Patch in staging, retest critical flows, redeploy.

## Release Gate (Go/No-Go)
- [ ] All E2E critical tests passed (`testing/e2e-tests.md`)
- [ ] Monitoring active before public launch
- [ ] Rollback plan rehearsal completed
- [ ] Cost alerting validated with test alerts
- [ ] Documentation complete and approved

## 30-Day Success Metrics
- [ ] 1,000+ installs
- [ ] 300+ DAU
- [ ] 95%+ lookup accuracy target
- [ ] <0.5% critical error rate
- [ ] 20%+ Free -> Pro conversion target
- [ ] 4.5+ Chrome Web Store rating
