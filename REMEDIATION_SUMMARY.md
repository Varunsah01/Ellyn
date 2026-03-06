# Overview

This remediation pass hardens the launch-blocking P0/P1 areas called out for auth/abuse prevention, quota correctness, billing plan inference, domain resolution safety, extension production safeguards, schema drift, and CI reliability.

# Changes By Area

## Auth and abuse prevention

- Required authenticated access on `/api/resolve-domain-v2` and the legacy `/api/resolve-domain` route before any domain resolution work runs.
- Added per-user route-level rate limiting to those domain resolution routes.
- Deprecated `/api/learning/record` with `410 Gone` instead of leaving a public learning mutation surface active.
- Moved `/api/pattern-feedback` onto the same authenticated, validated, rate-limited handler used by `/api/email-feedback`.
- Replaced the duplicate legacy Dodo webhook implementation at `/api/webhooks/dodo` with a thin delegate to the hardened `/api/v1/dodo/webhook` route.

## Quota correctness

- Reordered validation before quota consumption in:
  - `/api/enrich`
  - `/api/generate-emails`
  - `/api/v1/ai/draft-email`
  - `/api/v1/ai/adjust-tone`
  - `/api/v1/ai/enhance-template`
- Reworked `lib/quota.ts` to use quota RPCs rather than read-check-update application logic.
- Simplified `/api/v1/quota/rollback` to use authenticated bearer-or-cookie auth plus the `rollback_email_quota` RPC directly.
- Added migration `039_runtime_schema_alignment.sql` to harden the AI draft quota RPC and rollback RPC with auth checks and atomic row locking.

## Billing and plan inference

- Changed Dodo product-to-plan resolution to fail closed. Unknown or missing product IDs now resolve to `null`, not `pro`.
- Hardened `/api/v1/dodo/webhook` so only explicitly known product IDs activate paid plans.
- Added structured logging for unknown products, unresolved users, verification failures, and DB update failures.
- Aligned `/api/v1/subscription/checkout` to use the shared pricing config resolver and added route-level rate limiting.

## Domain resolution and Brandfetch

- Added explicit `BRANDFETCH_CLIENT_ID` validation and required `?c=<clientId>` query parameter construction for Brandfetch search calls.
- Stopped silently treating Brandfetch as healthy when the client ID is missing.
- Removed the enrich-flow Clearbit skip tied to `CLEARBIT_API_KEY` so the public autocomplete path stays available where intended.
- Normalized runtime analytics writes to the canonical `domain_resolution_logs` columns: `domain_source`, `mx_valid`, and `attempted_layers`.

## Email pattern quality

- Added `normalizeEmailLocalPart()` and routed pattern generation through it so multi-word and punctuated names are sanitized before email generation.

## Extension safeguards

- Disabled the production credit-limit bypass in `extension/background.js`.
- Removed the forced `allowed: true` overrides from extension quota helpers.
- Fixed the secondary exception path that referenced `payload?.tabId` out of scope.
- Updated sidepanel quota handling so quota denial disables the find-email action and shows upgrade state instead of treating quota as informational only.

## Schema drift

- Added `lib/db/migrations/039_runtime_schema_alignment.sql` to:
  - reconcile `domain_resolution_logs` canonical/runtime columns with legacy aliases
  - ensure `learned_patterns` and `pattern_feedback_log` exist in the runtime shape
  - backfill `learned_patterns` from legacy `pattern_learning` where available
  - reissue quota RPCs with safer auth and locking semantics
- Added a warning header to `000_ensure_complete_foundation.sql` clarifying that `001_complete_foundation.sql` is a destructive alternate baseline and should not be combined blindly.

## CI and tests

- Removed the broken Lighthouse workflow job that targeted `localhost` without starting an app.
- Removed the redundant second build in the `build` job.
- Updated Jest config to ignore `.claude/worktrees` so nested worktrees do not cause Haste module collisions.
- Added focused regression tests for:
  - auth denial on protected cost/mutation routes
  - deprecated learning route behavior
  - malformed requests not consuming quota
  - webhook fail-closed plan mapping and DB error handling
  - Brandfetch URL construction
  - email local-part sanitization
  - quota RPC usage
  - extension quota-guard regression

# What Remains Intentionally Unchanged

- `/api/email-feedback` remains the supported feedback endpoint and now shares the hardened feedback handler rather than being redesigned.
- The legacy `/api/webhooks/dodo` path still exists for backward compatibility, but it now delegates to the hardened v1 webhook instead of carrying separate billing logic.
- Existing migration files that represent older baselines were not deleted or rewritten wholesale.
- Known-company-domain seed data was not converted into a numbered migration in this pass; the existing seed path remains the deterministic way to load it.

# Manual Follow-Ups

- Apply `lib/db/migrations/039_runtime_schema_alignment.sql` in the target Supabase database before deploying these runtime changes.
- Ensure `BRANDFETCH_CLIENT_ID` is set anywhere Brandfetch search is expected to run.
- Verify the intended Dodo product ID env vars are populated for starter/pro plans in every deployed region/environment.
- If production depends on the known-company-domain dataset, run the existing seed process so runtime lookups benefit from it.

# Migration Notes

- Migration `039_runtime_schema_alignment.sql` is forward-only and additive. It keeps legacy columns/tables in place where needed for compatibility, then backfills canonical runtime columns.
- `pattern_learning` is treated as legacy input data only. Runtime code continues to use `learned_patterns`.
- `domain_resolution_logs` canonical runtime writes now target `domain_source`, `mx_valid`, and `attempted_layers`.

# Risk Notes

- The Dodo webhook now fails closed for unknown product IDs, which is safer but may leave subscriptions un-upgraded until missing product env vars are fixed.
- Direct duplicate-delivery/idempotency handling still relies on the current event storage model; this pass focused on fail-closed privilege changes and explicit DB error handling first.
- The auth requirement on domain resolution assumes current extension/backend callers already carry user auth, which matches the active repository clients inspected during remediation.
