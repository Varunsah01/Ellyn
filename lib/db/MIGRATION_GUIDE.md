# Database Migration Guide

## Running Migrations

1. Open the Supabase SQL editor for your project
2. Check which migrations have been applied:
   ```sql
   SELECT version, name, applied_at FROM public.schema_migrations ORDER BY version;
   ```
3. Run any missing migrations IN ORDER from `lib/db/migrations/`
4. After running all migrations, execute `lib/db/migrations/verify_schema.sql`
   to confirm the schema is correct

## Creating New Migrations

1. Copy `lib/db/migrations/TEMPLATE.sql`
2. Assign the next sequential number (e.g., 030)
3. Include the pre-flight check and the INSERT INTO schema_migrations at the end
4. Make it idempotent (use IF NOT EXISTS, DO $$ blocks)
5. Test on a fresh Supabase project before applying to production

## Migration Order (Critical)

The minimum set for a fresh database, in order:

1. `000_ensure_complete_foundation.sql` — core tables + signup trigger
2. `001_complete_foundation.sql` — analytics tables
3. `004_analytics_tracking.sql` — email lookups + api costs
4. `006_subscription_quotas.sql` — quota system
5. `016_onboarding_progress.sql` — onboarding columns on user_profiles
6. `017_onboarding_triggers.sql` — auto-mark onboarding steps
7. `018_system_template_rls.sql` — template RLS policies
8. `019_sequences_complete.sql` — full sequences schema
9. `025_complete_missing_tables.sql` — catch-up tables + contact fixes
10. `026_restore_contacts_columns.sql` — restore email/company_name/discovery_source/phone columns
11. `027_gmail_production.sql` — Gmail OAuth columns + email_history RLS
12. `028_migration_tracking.sql` — tracking table (records all prior migrations retroactively)
13. `029_rls_hardening.sql` — comprehensive RLS policies for all multi-tenant tables

Then run `verify_schema.sql` to confirm everything is correct.

## Notes on Deprecated Files

- `lib/db/rls-policies.sql` — **deprecated**. Its content has been incorporated into
  `029_rls_hardening.sql`. Do not run it directly. It is kept for reference only.
