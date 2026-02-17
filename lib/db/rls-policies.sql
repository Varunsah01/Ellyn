-- ============================================================================
-- Row Level Security (RLS) Hardening Policies
-- ============================================================================
-- Purpose:
--   1) Remove existing permissive policies (including "allow all" patterns).
--   2) Recreate strict user-scoped policies for core multi-tenant tables.
--   3) Ensure users can only access their own rows:
--        - user_id = auth.uid() for tenant tables
--        - id = auth.uid() for user_profiles
--   4) If a table has a `shared` column, SELECT also allows shared = true.
--
-- Target tables:
--   - contacts
--   - leads
--   - email_templates
--   - user_profiles
--   - user_quotas
--   - contact_outreach_history
--   - usage_analytics
-- ============================================================================

SET search_path = public;

-- ----------------------------------------------------------------------------
-- Apply strict user_id-based policies to tenant tables.
-- This block also drops all existing policies on each table so old permissive
-- policies (for example "allow all") are fully removed.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_table TEXT;
  v_policy RECORD;
  v_has_user_id BOOLEAN;
  v_has_shared BOOLEAN;
  v_has_is_default BOOLEAN;
  v_select_condition TEXT;
  v_tables TEXT[] := ARRAY[
    'contacts',
    'leads',
    'email_templates',
    'user_quotas',
    'contact_outreach_history',
    'usage_analytics'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    -- Skip cleanly if an optional table does not exist in this environment.
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE NOTICE 'Skipping public.%: table not found', v_table;
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = v_table
        AND column_name = 'user_id'
    )
    INTO v_has_user_id;

    IF NOT v_has_user_id THEN
      RAISE EXCEPTION 'public.% is missing user_id; cannot enforce strict user-scoped RLS', v_table;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', v_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', v_table);

    -- Remove every existing policy for a clean, deterministic security state.
    FOR v_policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', v_policy.policyname, v_table);
    END LOOP;

    -- Shared rows are read-only and only included for SELECT when supported.
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = v_table
        AND column_name = 'shared'
    )
    INTO v_has_shared;

    -- Backward compatibility: template presets may be represented by is_default.
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = v_table
        AND column_name = 'is_default'
    )
    INTO v_has_is_default;

    -- SELECT policy:
    --   - own rows by user_id
    --   - plus shared rows if table has `shared`
    --   - plus default templates for email_templates if `is_default` exists
    v_select_condition := 'user_id = auth.uid()';

    IF v_has_shared THEN
      v_select_condition := v_select_condition || ' OR COALESCE(shared, false) = true';
    END IF;

    IF v_table = 'email_templates' AND v_has_is_default THEN
      v_select_condition := v_select_condition || ' OR COALESCE(is_default, false) = true';
    END IF;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (%s);',
      v_table || '_select_own_or_shared',
      v_table,
      v_select_condition
    );

    -- INSERT policy: users can only create rows owned by themselves.
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (user_id = auth.uid());',
      v_table || '_insert_own',
      v_table
    );

    -- UPDATE policy: users can only update their own rows and keep ownership.
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());',
      v_table || '_update_own',
      v_table
    );

    -- DELETE policy: users can only delete their own rows.
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (user_id = auth.uid());',
      v_table || '_delete_own',
      v_table
    );

    RAISE NOTICE 'Applied strict user-scoped RLS policies to public.%', v_table;
  END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- user_profiles uses id = auth.uid() instead of user_id.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  IF to_regclass('public.user_profiles') IS NULL THEN
    RAISE NOTICE 'Skipping public.user_profiles: table not found';
  ELSE
    ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;

    -- Remove old policies, including any permissive/all-access variants.
    FOR v_policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'user_profiles'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles;', v_policy.policyname);
    END LOOP;

    -- SELECT: users can read only their own profile row.
    CREATE POLICY user_profiles_select_own
      ON public.user_profiles
      FOR SELECT
      USING (id = auth.uid());

    -- INSERT: users can only create their own profile row.
    CREATE POLICY user_profiles_insert_own
      ON public.user_profiles
      FOR INSERT
      WITH CHECK (id = auth.uid());

    -- UPDATE: users can update only their own profile row and keep ownership.
    CREATE POLICY user_profiles_update_own
      ON public.user_profiles
      FOR UPDATE
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());

    -- DELETE: users can delete only their own profile row.
    CREATE POLICY user_profiles_delete_own
      ON public.user_profiles
      FOR DELETE
      USING (id = auth.uid());

    RAISE NOTICE 'Applied strict user-scoped RLS policies to public.user_profiles';
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- Optional verification query (run manually):
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'contacts',
--     'leads',
--     'email_templates',
--     'user_profiles',
--     'user_quotas',
--     'contact_outreach_history',
--     'usage_analytics'
--   )
-- ORDER BY tablename, policyname;
-- ----------------------------------------------------------------------------
