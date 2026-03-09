# Secret Rotation and Revocation Runbook

Last updated: 2026-03-09

## Severity Statement
- Any confirmed exposed secret must be treated as compromised.
- Rotate/revoke first to reduce active exploitation, then perform cleanup and history response.
- Never post raw secrets in tickets, chat, CI logs, or commit messages.

## Mandatory Order of Operations
1. Rotate/revoke exposed credentials first (provider dashboards/CLIs).
2. Invalidate active sessions/tokens where provider/platform supports it.
3. Remove secrets from tracked files and prevent future commits.
4. Prepare history rewrite commands when historical exposure exists.
5. Review and approve rewrite plan before any force-push.
6. Coordinate collaborator reset/reclone after rewrite.
7. Verify monitoring and abuse signals after cutover.

## Provider-by-Provider Checklist

### Supabase
- Rotate `SUPABASE_SERVICE_ROLE_KEY`.
- Rotate publishable/anon key if risk posture requires it.
- Revoke old keys after deploy confirms new keys in use.
- Invalidate active auth sessions if compromise scope includes auth token theft.
- Verify RLS-sensitive routes and service-role operations after rotation.

### DodoPayments
- Rotate `DODO_PAYMENTS_API_KEY`.
- Rotate `DODO_PAYMENTS_WEBHOOK_KEY`.
- Verify webhook signature validation with new key.
- Validate checkout, portal, and invoice endpoints after cutover.

### Google AI / Gemini
- Rotate `GOOGLE_AI_API_KEY` and `GEMINI_API_KEY` aliases.
- Revoke legacy key aliases (`GOOGLE_GENERATIVE_AI_API_KEY`) if active.
- Validate AI generation endpoints fail closed with actionable errors on key issues.

### Mistral
- Rotate `MISTRAL_API_KEY`.
- Verify fallback chain behavior (`gemini -> mistral -> deepseek`) post-rotation.

### DeepSeek
- Rotate `DEEPSEEK_API_KEY`.
- Verify fallback behavior and error handling post-rotation.

### Abstract API
- Rotate `ABSTRACT_EMAIL_VALIDATION_API_KEY`.
- Revoke legacy `ABSTRACT_API_KEY` if still valid.
- Verify verification endpoints and SMTP probe flow.

### Google OAuth (Gmail)
- Rotate `GOOGLE_CLIENT_SECRET`.
- Review/rotate client credentials if app registration is suspected exposed.
- Revoke compromised refresh tokens/user grants where possible.
- Verify OAuth callback and send flow.

### Microsoft OAuth (Outlook)
- Rotate `MICROSOFT_CLIENT_SECRET`.
- Revoke compromised refresh tokens/user grants where possible.
- Verify OAuth callback and send flow.

### Redis / Upstash / Vercel KV
- Rotate `UPSTASH_REDIS_REST_TOKEN`, `KV_REST_API_TOKEN`, and read-only token if exposed.
- Validate rate limiting and cache behavior.
- Review keys for suspicious access patterns.

### Sentry
- Rotate `SENTRY_AUTH_TOKEN` if exposed.
- Verify source map upload pipeline.
- Confirm event scrubbing rules still redact secrets.

### SMTP Probe Service
- Rotate `SMTP_PROBE_SECRET`.
- Verify `/probe` auth and `/health` status.

### Admin / Internal Auth
- Rotate `ADMIN_API_SECRET`.
- Rotate `ADMIN_SESSION_SECRET` and force admin re-login.
- Rotate `SECRET_ADMIN_TOKEN` if debug endpoint guard is in use.
- Rotate `CRON_SECRET` and update GitHub Actions secret.
- Validate admin endpoints fail closed when secrets are missing/mismatched.

### Legacy/Unknown-Usage Secrets
- Revoke legacy keys found in envs but not current code paths (for example `ANTHROPIC_API_KEY`, `DODO_API_KEY`, `DODO_WEBHOOK_SECRET`, `KV_REDIS_URL`, `VERCEL_TOKEN`) unless proven inactive.

## Verification Checklist After Rotation
- App boots successfully with required envs.
- Server routes requiring provider auth still authenticate correctly.
- Extension works without embedded private secrets.
- Billing and provider integrations fail closed with actionable error messages.
- Admin endpoints reject missing/invalid secret headers.
- No secret scanner high-confidence findings in staged or CI scans.
- Observability alerts show no unusual 401/403/429/5xx spikes beyond expected rotation window.

## Manual Actions Required Outside the Repo
- Provider console key rotation/revocation actions.
- OAuth app secret rotation and token grant revocation.
- Supabase session invalidation/revocation actions.
- GitHub/Vercel secret updates and environment redeploy.
- Sentry token rotation and org/project permission review.
- Team communication for key cutover windows and rollback plans.

## Session/Token Invalidation Guidance
- Supabase: revoke sessions if compromise scope includes bearer tokens/session artifacts.
- Google/Microsoft OAuth: revoke refresh tokens or app grants per provider console.
- Internal admin: rotate `ADMIN_SESSION_SECRET` to invalidate signed sessions immediately.
- Cron/admin headers: rotate shared secrets and update all callers atomically.
