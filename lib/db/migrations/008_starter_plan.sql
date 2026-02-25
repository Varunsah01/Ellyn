-- ============================================================================
-- Migration 008: Add Starter Plan Support
-- ============================================================================
-- Run manually in Supabase SQL editor.
-- Adds 'starter' plan type and updates all quota functions accordingly.
--
-- New limits:
--   free:    50 email credits / 0 AI drafts  per month
--   starter: 500 email credits / 150 AI drafts per month
--   pro:     1500 email credits / 500 AI drafts per month
-- ============================================================================

-- ============================================================================
-- 1. UPDATE plan_type CHECK CONSTRAINT (user_quotas)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_user_quotas_plan_type'
      AND conrelid = 'public.user_quotas'::regclass
  ) THEN
    ALTER TABLE public.user_quotas
      DROP CONSTRAINT chk_user_quotas_plan_type;
  END IF;
END $$;

ALTER TABLE public.user_quotas
  ADD CONSTRAINT chk_user_quotas_plan_type
  CHECK (plan_type IN ('free', 'starter', 'pro'));

-- ============================================================================
-- 2. UPDATE email limit for existing free users (25 → 50)
-- ============================================================================

UPDATE public.user_quotas
SET email_lookups_limit = 50,
    updated_at = NOW()
WHERE plan_type = 'free'
  AND email_lookups_limit = 25;

-- ============================================================================
-- 3. UPDATE reset_expired_quotas() — handle starter
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
    ai_draft_generations_used = 0,
    email_lookups_limit = CASE
      WHEN plan_type = 'pro'     THEN 1500
      WHEN plan_type = 'starter' THEN 500
      ELSE 50
    END,
    period_start = period_end,
    period_end = period_end + INTERVAL '1 month',
    updated_at = NOW()
  WHERE period_end < NOW();
END;
$$;

-- ============================================================================
-- 4. UPDATE ensure_user_quota() — handle starter
-- ============================================================================

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
    CASE
      WHEN v_plan_type = 'pro'     THEN 'pro'
      WHEN v_plan_type = 'starter' THEN 'starter'
      ELSE 'free'
    END,
    0,
    CASE
      WHEN v_plan_type = 'pro'     THEN 1500
      WHEN v_plan_type = 'starter' THEN 500
      ELSE 50
    END,
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

-- ============================================================================
-- 5. UPDATE check_and_increment_quota() — handle starter in reset branch
-- ============================================================================

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
      ai_draft_generations_used = 0,
      email_lookups_limit = CASE
        WHEN plan_type = 'pro'     THEN 1500
        WHEN plan_type = 'starter' THEN 500
        ELSE 50
      END,
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

-- ============================================================================
-- 6. UPDATE get_quota_status() — handle starter in reset branch
-- ============================================================================

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
      ai_draft_generations_used = 0,
      email_lookups_limit = CASE
        WHEN plan_type = 'pro'     THEN 1500
        WHEN plan_type = 'starter' THEN 500
        ELSE 50
      END,
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

-- ============================================================================
-- 7. UPDATE admin_adjust_quota() — accept 'starter' as valid plan type
-- ============================================================================

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
      ai_draft_generations_used = 0,
      email_lookups_limit = CASE
        WHEN plan_type = 'pro'     THEN 1500
        WHEN plan_type = 'starter' THEN 500
        ELSE 50
      END,
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
      ai_draft_generations_used = 0,
      email_lookups_limit = CASE
        WHEN plan_type = 'pro'     THEN 1500
        WHEN plan_type = 'starter' THEN 500
        ELSE 50
      END,
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
      WHEN p_plan_type IN ('free', 'starter', 'pro') THEN p_plan_type
      ELSE NULL
    END;

    UPDATE public.user_quotas
    SET
      plan_type = COALESCE(v_effective_plan, plan_type),
      email_lookups_limit = COALESCE(
        p_limit,
        CASE
          WHEN v_effective_plan = 'pro'     THEN 1500
          WHEN v_effective_plan = 'starter' THEN 500
          WHEN v_effective_plan = 'free'    THEN 50
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
-- 8. UPDATE check_and_increment_ai_draft() — new limits per plan
--    free: 0 | starter: 150 | pro: 500
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_and_increment_ai_draft(p_user_id UUID)
RETURNS TABLE (allowed BOOLEAN, remaining INTEGER, reset_date TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used       INT;
  v_limit      INT;
  v_reset_date TIMESTAMPTZ;
  v_plan_type  TEXT;
BEGIN
  -- Ensure quota row exists
  PERFORM public.ensure_user_quota(p_user_id);

  SELECT
    uq.ai_draft_generations_used,
    up.plan_type,
    uq.period_end
  INTO v_used, v_plan_type, v_reset_date
  FROM public.user_quotas uq
  LEFT JOIN public.user_profiles up ON up.id = uq.user_id
  WHERE uq.user_id = p_user_id;

  -- Set limit based on plan
  v_limit := CASE
    WHEN v_plan_type = 'pro'     THEN 500
    WHEN v_plan_type = 'starter' THEN 150
    ELSE 0
  END;

  IF v_used >= v_limit THEN
    RETURN QUERY SELECT FALSE, 0, v_reset_date;
    RETURN;
  END IF;

  -- Increment counter
  UPDATE public.user_quotas
  SET ai_draft_generations_used = ai_draft_generations_used + 1
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT TRUE, (v_limit - v_used - 1), v_reset_date;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_draft(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_draft(UUID) TO service_role;
