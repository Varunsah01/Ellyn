-- Migration 028: Migration Tracking System
-- Creates a table to record which migrations have been applied.
-- Run this ONCE, then retroactively insert all previously-applied migrations.

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum TEXT,
  execution_time_ms INTEGER
);

-- Retroactively record all known migrations as applied.
-- If you're running this on a database that already has all migrations applied,
-- this INSERT records that fact. Adjust this list if you skipped any migrations.

INSERT INTO public.schema_migrations (version, name, applied_at)
VALUES
  ('000',                        'ensure_complete_foundation',    NOW()),
  ('001',                        'complete_foundation',           NOW()),
  ('003',                        'lean_schema',                   NOW()),
  ('003_onboarding',             'onboarding',                    NOW()),
  ('003_quota_management',       'quota_management',              NOW()),
  ('003_activity_log',           'activity_log',                  NOW()),
  ('004',                        'analytics_tracking',            NOW()),
  ('004_sequences',              'sequences',                     NOW()),
  ('005',                        'email_prediction_learning',     NOW()),
  ('006',                        'subscription_quotas',           NOW()),
  ('007',                        'email_report_schedule',         NOW()),
  ('008',                        'starter_plan',                  NOW()),
  ('008_enable_contacts_realtime','enable_contacts_realtime',     NOW()),
  ('009',                        'extension_heartbeat',           NOW()),
  ('010',                        'user_persona',                  NOW()),
  ('010_rich_template_library',  'rich_template_library',         NOW()),
  ('011',                        'template_categories',           NOW()),
  ('012',                        'email_tracking_events',         NOW()),
  ('013',                        'application_stages',            NOW()),
  ('014',                        'deals_pipeline',                NOW()),
  ('015',                        'suppression_list',              NOW()),
  ('016',                        'onboarding_progress',           NOW()),
  ('017',                        'onboarding_triggers',           NOW()),
  ('018',                        'system_template_rls',           NOW()),
  ('019',                        'sequences_complete',            NOW()),
  ('020',                        'analytics_functions',           NOW()),
  ('021',                        'default_stages',                NOW()),
  ('022',                        'lead_score_cache',              NOW()),
  ('023',                        'sequence_tracker_columns',      NOW()),
  ('024',                        'application_tracker',           NOW()),
  ('025',                        'complete_missing_tables',       NOW()),
  ('026',                        'restore_contacts_columns',      NOW()),
  ('027',                        'gmail_production',              NOW()),
  ('028',                        'migration_tracking',            NOW())
ON CONFLICT (version) DO NOTHING;

COMMENT ON TABLE public.schema_migrations IS
  'Tracks which SQL migrations have been applied to this database. '
  'Every new migration should INSERT its own version as the last statement.';
