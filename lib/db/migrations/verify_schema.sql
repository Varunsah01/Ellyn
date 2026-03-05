-- Schema Verification Script
-- Run this to check that all expected tables, columns, indexes, and functions exist.
-- It reports problems as NOTICE/WARNING messages. It does NOT modify anything.

DO $$
DECLARE
  v_missing_tables TEXT[] := '{}';
  v_missing_columns TEXT[] := '{}';
  v_missing_functions TEXT[] := '{}';
  v_missing_migrations TEXT[] := '{}';
  v_table TEXT;
  v_expected_tables TEXT[] := ARRAY[
    'user_profiles',
    'user_quotas',
    'contacts',
    'email_templates',
    'sequences',
    'sequence_steps',
    'sequence_enrollments',
    'sequence_enrollment_steps',
    'domain_cache',
    'pattern_learning',
    'domain_resolution_logs',
    'dodo_webhook_events',
    'activity_log',
    'ai_drafts',
    'email_lookups',
    'api_costs',
    'email_pattern_cache',
    'email_tracking_events',
    'application_stages',
    'deals',
    'suppression_list',
    'application_tracker',
    'leads',
    'gmail_credentials',
    'email_history',
    'drafts',
    'outreach',
    'sequence_events',
    'schema_migrations'
  ];
BEGIN
  -- 1. Check all expected tables exist
  FOREACH v_table IN ARRAY v_expected_tables LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      v_missing_tables := array_append(v_missing_tables, v_table);
    END IF;
  END LOOP;

  IF array_length(v_missing_tables, 1) > 0 THEN
    RAISE WARNING 'MISSING TABLES: %', array_to_string(v_missing_tables, ', ');
  ELSE
    RAISE NOTICE '✓ All % expected tables exist', array_length(v_expected_tables, 1);
  END IF;

  -- 2. Check critical columns on contacts
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'company'
  ) THEN
    v_missing_columns := array_append(v_missing_columns, 'contacts.company');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'inferred_email'
  ) THEN
    v_missing_columns := array_append(v_missing_columns, 'contacts.inferred_email');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'source'
  ) THEN
    v_missing_columns := array_append(v_missing_columns, 'contacts.source');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'email'
  ) THEN
    v_missing_columns := array_append(v_missing_columns, 'contacts.email');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'company_name'
  ) THEN
    v_missing_columns := array_append(v_missing_columns, 'contacts.company_name');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'discovery_source'
  ) THEN
    v_missing_columns := array_append(v_missing_columns, 'contacts.discovery_source');
  END IF;

  -- Check critical columns on user_profiles
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
      AND column_name = 'onboarding_steps_completed'
  ) THEN
    v_missing_columns := array_append(v_missing_columns, 'user_profiles.onboarding_steps_completed');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
      AND column_name = 'extension_last_seen'
  ) THEN
    v_missing_columns := array_append(v_missing_columns, 'user_profiles.extension_last_seen');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
      AND column_name = 'dodo_product_id'
  ) THEN
    v_missing_columns := array_append(v_missing_columns, 'user_profiles.dodo_product_id');
  END IF;

  -- Check lead_score columns on contacts
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts'
      AND column_name = 'lead_score_cache'
  ) THEN
    v_missing_columns := array_append(v_missing_columns, 'contacts.lead_score_cache');
  END IF;

  -- Check gmail_credentials columns added in migration 027
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gmail_credentials'
      AND column_name = 'gmail_email'
  ) THEN
    v_missing_columns := array_append(v_missing_columns, 'gmail_credentials.gmail_email');
  END IF;

  IF array_length(v_missing_columns, 1) > 0 THEN
    RAISE WARNING 'MISSING COLUMNS: %', array_to_string(v_missing_columns, ', ');
  ELSE
    RAISE NOTICE '✓ All critical columns verified';
  END IF;

  -- 3. Check critical functions exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'ensure_user_quota'
  ) THEN
    v_missing_functions := array_append(v_missing_functions, 'ensure_user_quota');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
  ) THEN
    v_missing_functions := array_append(v_missing_functions, 'handle_new_user');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'reset_expired_quotas'
  ) THEN
    v_missing_functions := array_append(v_missing_functions, 'reset_expired_quotas');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'check_first_contact'
  ) THEN
    v_missing_functions := array_append(v_missing_functions, 'check_first_contact');
  END IF;

  IF array_length(v_missing_functions, 1) > 0 THEN
    RAISE WARNING 'MISSING FUNCTIONS: %', array_to_string(v_missing_functions, ', ');
  ELSE
    RAISE NOTICE '✓ All critical functions exist';
  END IF;

  -- 4. Check RLS is enabled on key tables
  DECLARE
    v_rls_disabled TEXT[] := '{}';
    v_rls_table TEXT;
    v_rls_tables TEXT[] := ARRAY[
      'user_profiles', 'contacts', 'email_templates', 'user_quotas',
      'sequences', 'sequence_enrollments', 'leads', 'ai_drafts',
      'email_lookups', 'api_costs'
    ];
  BEGIN
    FOREACH v_rls_table IN ARRAY v_rls_tables LOOP
      IF to_regclass(format('public.%I', v_rls_table)) IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relname = v_rls_table
            AND c.relrowsecurity = true
        ) THEN
          v_rls_disabled := array_append(v_rls_disabled, v_rls_table);
        END IF;
      END IF;
    END LOOP;

    IF array_length(v_rls_disabled, 1) > 0 THEN
      RAISE WARNING 'RLS DISABLED on: %', array_to_string(v_rls_disabled, ', ');
    ELSE
      RAISE NOTICE '✓ RLS enabled on all critical tables';
    END IF;
  END;

  -- 5. Check migration tracking
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    SELECT ARRAY(
      SELECT version FROM unnest(ARRAY[
        '000','001','004','016','017','019','025','026','027','028','029','030','035','036','037','038'
      ]) AS t(version)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.schema_migrations sm WHERE sm.version = t.version
      )
    ) INTO v_missing_migrations;

    IF array_length(v_missing_migrations, 1) > 0 THEN
      RAISE WARNING 'UNAPPLIED MIGRATIONS: %', array_to_string(v_missing_migrations, ', ');
    ELSE
      RAISE NOTICE '✓ All critical migrations recorded';
    END IF;
  ELSE
    RAISE WARNING 'schema_migrations table does not exist — run migration 028 first';
  END IF;

  RAISE NOTICE '— Schema verification complete —';
END $$;
