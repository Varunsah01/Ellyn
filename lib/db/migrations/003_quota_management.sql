-- ============================================================================
-- Migration 003: Quota Management (Additive / Idempotent)
-- ============================================================================
-- Notes:
-- - This migration is additive and safe to run on databases that may already
--   include quota objects from baseline migrations.
-- - It intentionally avoids destructive drops.
-- ============================================================================

-- ============================================================================
-- USER QUOTAS TABLE + SHAPE GUARANTEES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_quotas (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type VARCHAR(10) NOT NULL CHECK (plan_type IN ('free', 'pro')),
  email_lookups_used INTEGER NOT NULL DEFAULT 0 CHECK (email_lookups_used >= 0),
  email_lookups_limit INTEGER NOT NULL CHECK (email_lookups_limit > 0),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_quotas
  ADD COLUMN IF NOT EXISTS plan_type VARCHAR(10),
  ADD COLUMN IF NOT EXISTS email_lookups_used INTEGER,
  ADD COLUMN IF NOT EXISTS email_lookups_limit INTEGER,
  ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE public.user_quotas
SET
  plan_type = COALESCE(NULLIF(plan_type, ''), 'free'),
  email_lookups_used = COALESCE(email_lookups_used, 0),
  email_lookups_limit = COALESCE(email_lookups_limit, CASE WHEN plan_type = 'pro' THEN 1500 ELSE 25 END),
  period_start = COALESCE(period_start, NOW()),
  period_end = COALESCE(period_end, NOW() + INTERVAL '1 month'),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW());

ALTER TABLE public.user_quotas
  ALTER COLUMN plan_type SET DEFAULT 'free',
  ALTER COLUMN plan_type SET NOT NULL,
  ALTER COLUMN email_lookups_used SET DEFAULT 0,
  ALTER COLUMN email_lookups_used SET NOT NULL,
  ALTER COLUMN email_lookups_limit SET NOT NULL,
  ALTER COLUMN period_start SET NOT NULL,
  ALTER COLUMN period_end SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_user_quotas_plan_type'
      AND conrelid = 'public.user_quotas'::regclass
  ) THEN
    ALTER TABLE public.user_quotas
      ADD CONSTRAINT chk_user_quotas_plan_type
      CHECK (plan_type IN ('free', 'pro'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_user_quotas_email_lookups_used_non_negative'
      AND conrelid = 'public.user_quotas'::regclass
  ) THEN
    ALTER TABLE public.user_quotas
      ADD CONSTRAINT chk_user_quotas_email_lookups_used_non_negative
      CHECK (email_lookups_used >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_user_quotas_email_lookups_limit_positive'
      AND conrelid = 'public.user_quotas'::regclass
  ) THEN
    ALTER TABLE public.user_quotas
      ADD CONSTRAINT chk_user_quotas_email_lookups_limit_positive
      CHECK (email_lookups_limit > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_user_quotas_period'
      AND conrelid = 'public.user_quotas'::regclass
  ) THEN
    ALTER TABLE public.user_quotas
      ADD CONSTRAINT chk_user_quotas_period
      CHECK (period_end > period_start);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_quotas_user_id ON public.user_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quotas_period ON public.user_quotas(period_end);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own quota" ON public.user_quotas;
DROP POLICY IF EXISTS "Users can update own quota" ON public.user_quotas;
DROP POLICY IF EXISTS "Service role manages quotas" ON public.user_quotas;

CREATE POLICY "Users can view own quota"
  ON public.user_quotas
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own quota"
  ON public.user_quotas
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages quotas"
  ON public.user_quotas
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- SHARED UPDATE-AT FUNCTION/TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_user_quotas_updated_at'
      AND tgrelid = 'public.user_quotas'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER update_user_quotas_updated_at
      BEFORE UPDATE ON public.user_quotas
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- QUOTA FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reset_expired_quotas()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_quotas
  SET
    email_lookups_used = 0,
    email_lookups_limit = CASE WHEN plan_type = 'pro' THEN 1500 ELSE 25 END,
    period_start = period_end,
    period_end = period_end + INTERVAL '1 month',
    updated_at = NOW()
  WHERE period_end < NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_user_quota(p_user_id UUID)
RETURNS public.user_quotas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_type VARCHAR(10);
  v_quota public.user_quotas%ROWTYPE;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'permission denied for ensure_user_quota';
  END IF;

  SELECT COALESCE(up.plan_type, 'free')
  INTO v_plan_type
  FROM public.user_profiles up
  WHERE up.id = p_user_id;

  IF v_plan_type IS NULL THEN
    v_plan_type := 'free';
  END IF;

  INSERT INTO public.user_quotas (
    user_id,
    plan_type,
    email_lookups_used,
    email_lookups_limit,
    period_start,
    period_end
  ) VALUES (
    p_user_id,
    CASE WHEN v_plan_type = 'pro' THEN 'pro' ELSE 'free' END,
    0,
    CASE WHEN v_plan_type = 'pro' THEN 1500 ELSE 25 END,
    NOW(),
    NOW() + INTERVAL '1 month'
  )
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
  INTO v_quota
  FROM public.user_quotas
  WHERE user_id = p_user_id;

  RETURN v_quota;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_and_increment_quota(
  p_user_id UUID,
  p_quota_type TEXT DEFAULT 'email_lookups'
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  reset_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quota public.user_quotas%ROWTYPE;
  v_limit INTEGER;
  v_used INTEGER;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'permission denied for quota operation';
  END IF;

  IF p_quota_type <> 'email_lookups' THEN
    RAISE EXCEPTION 'Invalid quota type: %', p_quota_type;
  END IF;

  PERFORM public.ensure_user_quota(p_user_id);

  SELECT *
  INTO v_quota
  FROM public.user_quotas
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quota not found for user %', p_user_id;
  END IF;

  IF v_quota.period_end < NOW() THEN
    UPDATE public.user_quotas
    SET
      email_lookups_used = 0,
      email_lookups_limit = CASE WHEN plan_type = 'pro' THEN 1500 ELSE 25 END,
      period_start = NOW(),
      period_end = NOW() + INTERVAL '1 month',
      updated_at = NOW()
    WHERE user_id = p_user_id;

    SELECT *
    INTO v_quota
    FROM public.user_quotas
    WHERE user_id = p_user_id
    FOR UPDATE;
  END IF;

  v_limit := v_quota.email_lookups_limit;
  v_used := v_quota.email_lookups_used;

  IF v_used >= v_limit THEN
    RETURN QUERY SELECT FALSE, 0, v_quota.period_end;
    RETURN;
  END IF;

  UPDATE public.user_quotas
  SET
    email_lookups_used = email_lookups_used + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT TRUE, (v_limit - v_used - 1), v_quota.period_end;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_quota_status(p_user_id UUID)
RETURNS TABLE (
  used INTEGER,
  quota_limit INTEGER,
  remaining INTEGER,
  reset_date TIMESTAMPTZ,
  plan_type VARCHAR(10)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quota public.user_quotas%ROWTYPE;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'permission denied for quota status';
  END IF;

  PERFORM public.ensure_user_quota(p_user_id);

  SELECT *
  INTO v_quota
  FROM public.user_quotas
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_quota.period_end < NOW() THEN
    UPDATE public.user_quotas
    SET
      email_lookups_used = 0,
      email_lookups_limit = CASE WHEN plan_type = 'pro' THEN 1500 ELSE 25 END,
      period_start = NOW(),
      period_end = NOW() + INTERVAL '1 month',
      updated_at = NOW()
    WHERE user_id = p_user_id;

    SELECT *
    INTO v_quota
    FROM public.user_quotas
    WHERE user_id = p_user_id
    FOR UPDATE;
  END IF;

  RETURN QUERY
  SELECT
    v_quota.email_lookups_used AS used,
    v_quota.email_lookups_limit AS quota_limit,
    GREATEST(0, v_quota.email_lookups_limit - v_quota.email_lookups_used) AS remaining,
    v_quota.period_end AS reset_date,
    v_quota.plan_type;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_quota(
  p_action TEXT,
  p_target_user_id UUID DEFAULT NULL,
  p_plan_type VARCHAR(10) DEFAULT NULL,
  p_used INTEGER DEFAULT NULL,
  p_limit INTEGER DEFAULT NULL
)
RETURNS TABLE (
  action TEXT,
  affected_count INTEGER,
  details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_effective_plan VARCHAR(10);
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'permission denied for admin_adjust_quota';
  END IF;

  IF p_action = 'reset_all' THEN
    UPDATE public.user_quotas
    SET
      email_lookups_used = 0,
      email_lookups_limit = CASE WHEN plan_type = 'pro' THEN 1500 ELSE 25 END,
      period_start = NOW(),
      period_end = NOW() + INTERVAL '1 month',
      updated_at = NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN QUERY
    SELECT
      'reset_all'::TEXT,
      v_count,
      jsonb_build_object('reset_at', NOW());
    RETURN;
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'target user is required for action %', p_action;
  END IF;

  PERFORM public.ensure_user_quota(p_target_user_id);

  IF p_action = 'reset_user' THEN
    UPDATE public.user_quotas
    SET
      email_lookups_used = 0,
      email_lookups_limit = CASE WHEN plan_type = 'pro' THEN 1500 ELSE 25 END,
      period_start = NOW(),
      period_end = NOW() + INTERVAL '1 month',
      updated_at = NOW()
    WHERE user_id = p_target_user_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN QUERY
    SELECT
      'reset_user'::TEXT,
      v_count,
      jsonb_build_object(
        'user_id', p_target_user_id,
        'reset_at', NOW()
      );
    RETURN;
  END IF;

  IF p_action = 'adjust_user' THEN
    v_effective_plan := CASE
      WHEN p_plan_type IN ('free', 'pro') THEN p_plan_type
      ELSE NULL
    END;

    UPDATE public.user_quotas
    SET
      plan_type = COALESCE(v_effective_plan, plan_type),
      email_lookups_limit = COALESCE(
        p_limit,
        CASE
          WHEN v_effective_plan = 'pro' THEN 1500
          WHEN v_effective_plan = 'free' THEN 25
          ELSE email_lookups_limit
        END
      ),
      email_lookups_used = COALESCE(p_used, email_lookups_used),
      updated_at = NOW()
    WHERE user_id = p_target_user_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE public.user_quotas
    SET email_lookups_used = LEAST(email_lookups_used, email_lookups_limit)
    WHERE user_id = p_target_user_id;

    RETURN QUERY
    SELECT
      'adjust_user'::TEXT,
      v_count,
      (
        SELECT jsonb_build_object(
          'user_id', uq.user_id,
          'plan_type', uq.plan_type,
          'used', uq.email_lookups_used,
          'limit', uq.email_lookups_limit,
          'period_start', uq.period_start,
          'period_end', uq.period_end
        )
        FROM public.user_quotas uq
        WHERE uq.user_id = p_target_user_id
      );
    RETURN;
  END IF;

  RAISE EXCEPTION 'Unsupported admin action: %', p_action;
END;
$$;

-- ============================================================================
-- BACKFILL MISSING QUOTA ROWS FOR EXISTING USERS
-- ============================================================================

INSERT INTO public.user_quotas (
  user_id,
  plan_type,
  email_lookups_used,
  email_lookups_limit,
  period_start,
  period_end
)
SELECT
  u.id,
  CASE WHEN COALESCE(up.plan_type, 'free') = 'pro' THEN 'pro' ELSE 'free' END,
  0,
  CASE WHEN COALESCE(up.plan_type, 'free') = 'pro' THEN 1500 ELSE 25 END,
  NOW(),
  NOW() + INTERVAL '1 month'
FROM auth.users u
LEFT JOIN public.user_profiles up ON up.id = u.id
LEFT JOIN public.user_quotas uq ON uq.user_id = u.id
WHERE uq.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- CRON: MONTHLY RESET
-- ============================================================================

DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron extension unavailable in this environment: %', SQLERRM;
  END;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'quota_monthly_reset') THEN
        PERFORM cron.unschedule(
          (SELECT jobid FROM cron.job WHERE jobname = 'quota_monthly_reset' ORDER BY jobid DESC LIMIT 1)
        );
      END IF;

      PERFORM cron.schedule(
        'quota_monthly_reset',
        '10 0 1 * *',
        'SELECT public.reset_expired_quotas();'
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Unable to schedule quota_monthly_reset job: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'pg_cron not installed; monthly quota reset job was not scheduled.';
  END IF;
END $$;
