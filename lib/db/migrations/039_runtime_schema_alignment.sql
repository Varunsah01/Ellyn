-- Migration 039: Runtime schema alignment for launch blockers
-- Dependencies: 028_migration_tracking
-- Idempotent: yes

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- domain_resolution_logs: align legacy aliases with canonical runtime columns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.domain_resolution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  domain TEXT,
  domain_source TEXT NOT NULL DEFAULT 'unknown',
  mx_valid BOOLEAN,
  confidence_score NUMERIC(5, 2) DEFAULT 0,
  attempted_layers JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.domain_resolution_logs
  ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE public.domain_resolution_logs
  ADD COLUMN IF NOT EXISTS company_name TEXT;

ALTER TABLE public.domain_resolution_logs
  ADD COLUMN IF NOT EXISTS domain TEXT;

ALTER TABLE public.domain_resolution_logs
  ADD COLUMN IF NOT EXISTS domain_source TEXT;

ALTER TABLE public.domain_resolution_logs
  ADD COLUMN IF NOT EXISTS mx_valid BOOLEAN;

ALTER TABLE public.domain_resolution_logs
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5, 2);

ALTER TABLE public.domain_resolution_logs
  ADD COLUMN IF NOT EXISTS attempted_layers JSONB;

ALTER TABLE public.domain_resolution_logs
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE public.domain_resolution_logs
  ALTER COLUMN domain_source SET DEFAULT 'unknown';

ALTER TABLE public.domain_resolution_logs
  ALTER COLUMN attempted_layers SET DEFAULT '[]'::jsonb;

ALTER TABLE public.domain_resolution_logs
  ALTER COLUMN confidence_score SET DEFAULT 0;

ALTER TABLE public.domain_resolution_logs
  ALTER COLUMN created_at SET DEFAULT NOW();

DO $$
DECLARE
  has_resolution_source BOOLEAN;
  has_layers_attempted BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'domain_resolution_logs'
      AND column_name = 'resolution_source'
  )
  INTO has_resolution_source;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'domain_resolution_logs'
      AND column_name = 'layers_attempted'
  )
  INTO has_layers_attempted;

  IF has_resolution_source AND has_layers_attempted THEN
    EXECUTE $sql$
      UPDATE public.domain_resolution_logs
      SET
        domain_source = COALESCE(NULLIF(domain_source, ''), NULLIF(resolution_source, ''), 'unknown'),
        attempted_layers = COALESCE(attempted_layers, layers_attempted, '[]'::jsonb),
        created_at = COALESCE(created_at, NOW())
      WHERE
        domain_source IS NULL
        OR domain_source = ''
        OR attempted_layers IS NULL
        OR created_at IS NULL
    $sql$;
  ELSIF has_resolution_source THEN
    EXECUTE $sql$
      UPDATE public.domain_resolution_logs
      SET
        domain_source = COALESCE(NULLIF(domain_source, ''), NULLIF(resolution_source, ''), 'unknown'),
        attempted_layers = COALESCE(attempted_layers, '[]'::jsonb),
        created_at = COALESCE(created_at, NOW())
      WHERE
        domain_source IS NULL
        OR domain_source = ''
        OR attempted_layers IS NULL
        OR created_at IS NULL
    $sql$;
  ELSIF has_layers_attempted THEN
    EXECUTE $sql$
      UPDATE public.domain_resolution_logs
      SET
        domain_source = COALESCE(NULLIF(domain_source, ''), 'unknown'),
        attempted_layers = COALESCE(attempted_layers, layers_attempted, '[]'::jsonb),
        created_at = COALESCE(created_at, NOW())
      WHERE
        domain_source IS NULL
        OR domain_source = ''
        OR attempted_layers IS NULL
        OR created_at IS NULL
    $sql$;
  ELSE
    UPDATE public.domain_resolution_logs
    SET
      domain_source = COALESCE(NULLIF(domain_source, ''), 'unknown'),
      attempted_layers = COALESCE(attempted_layers, '[]'::jsonb),
      created_at = COALESCE(created_at, NOW())
    WHERE
      domain_source IS NULL
      OR domain_source = ''
      OR attempted_layers IS NULL
      OR created_at IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_drl_domain_source
  ON public.domain_resolution_logs (domain_source);

CREATE INDEX IF NOT EXISTS idx_drl_created_at
  ON public.domain_resolution_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_drl_mx_valid
  ON public.domain_resolution_logs (mx_valid)
  WHERE mx_valid = false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'domain_resolution_logs_user_id_fkey'
      AND conrelid = 'public.domain_resolution_logs'::regclass
  ) THEN
    ALTER TABLE public.domain_resolution_logs
      ADD CONSTRAINT domain_resolution_logs_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- learned_patterns + pattern_feedback_log: keep runtime table canonical
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learned_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_domain VARCHAR(255) NOT NULL,
  pattern VARCHAR(50) NOT NULL,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  confidence_boost INTEGER NOT NULL DEFAULT 0,
  injected BOOLEAN NOT NULL DEFAULT FALSE,
  last_verified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_domain, pattern)
);

ALTER TABLE public.learned_patterns
  ADD COLUMN IF NOT EXISTS company_domain VARCHAR(255);

ALTER TABLE public.learned_patterns
  ADD COLUMN IF NOT EXISTS pattern VARCHAR(50);

ALTER TABLE public.learned_patterns
  ADD COLUMN IF NOT EXISTS success_count INTEGER;

ALTER TABLE public.learned_patterns
  ADD COLUMN IF NOT EXISTS failure_count INTEGER;

ALTER TABLE public.learned_patterns
  ADD COLUMN IF NOT EXISTS confidence_boost INTEGER;

ALTER TABLE public.learned_patterns
  ADD COLUMN IF NOT EXISTS injected BOOLEAN;

ALTER TABLE public.learned_patterns
  ADD COLUMN IF NOT EXISTS last_verified TIMESTAMPTZ;

ALTER TABLE public.learned_patterns
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE public.learned_patterns
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE public.learned_patterns
  ALTER COLUMN success_count SET DEFAULT 0;

ALTER TABLE public.learned_patterns
  ALTER COLUMN failure_count SET DEFAULT 0;

ALTER TABLE public.learned_patterns
  ALTER COLUMN confidence_boost SET DEFAULT 0;

ALTER TABLE public.learned_patterns
  ALTER COLUMN injected SET DEFAULT FALSE;

ALTER TABLE public.learned_patterns
  ALTER COLUMN last_verified SET DEFAULT NOW();

ALTER TABLE public.learned_patterns
  ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE public.learned_patterns
  ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE public.learned_patterns
SET
  success_count = COALESCE(success_count, 0),
  failure_count = COALESCE(failure_count, 0),
  confidence_boost = COALESCE(confidence_boost, 0),
  injected = COALESCE(injected, FALSE),
  last_verified = COALESCE(last_verified, NOW()),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  success_count IS NULL
  OR failure_count IS NULL
  OR confidence_boost IS NULL
  OR injected IS NULL
  OR last_verified IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_learned_patterns_domain
  ON public.learned_patterns (company_domain);

CREATE INDEX IF NOT EXISTS idx_learned_patterns_confidence
  ON public.learned_patterns (confidence_boost DESC);

DO $$
BEGIN
  IF to_regclass('public.pattern_learning') IS NOT NULL THEN
    INSERT INTO public.learned_patterns (
      company_domain,
      pattern,
      success_count,
      failure_count,
      confidence_boost,
      injected,
      last_verified,
      created_at,
      updated_at
    )
    SELECT
      LOWER(BTRIM(pl.domain)),
      LOWER(BTRIM(pl.pattern)),
      COALESCE(pl.success_count, 0),
      GREATEST(COALESCE(pl.total_attempts, 0) - COALESCE(pl.success_count, 0), 0),
      CASE
        WHEN COALESCE(pl.total_attempts, 0) >= 2 THEN
          ROUND((((COALESCE(pl.success_count, 0)::NUMERIC / NULLIF(pl.total_attempts, 0)) - 0.5) * 60))
        ELSE 0
      END::INTEGER,
      FALSE,
      COALESCE(pl.last_verified_at, NOW()),
      COALESCE(pl.created_at, NOW()),
      COALESCE(pl.updated_at, NOW())
    FROM public.pattern_learning pl
    WHERE
      NULLIF(BTRIM(COALESCE(pl.domain, '')), '') IS NOT NULL
      AND NULLIF(BTRIM(COALESCE(pl.pattern, '')), '') IS NOT NULL
    ON CONFLICT (company_domain, pattern) DO NOTHING;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.pattern_feedback_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  pattern TEXT NOT NULL,
  company_domain TEXT NOT NULL,
  worked BOOLEAN NOT NULL,
  contact_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pattern_feedback_log
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE public.pattern_feedback_log
  ADD COLUMN IF NOT EXISTS pattern TEXT;

ALTER TABLE public.pattern_feedback_log
  ADD COLUMN IF NOT EXISTS company_domain TEXT;

ALTER TABLE public.pattern_feedback_log
  ADD COLUMN IF NOT EXISTS worked BOOLEAN;

ALTER TABLE public.pattern_feedback_log
  ADD COLUMN IF NOT EXISTS contact_id UUID;

ALTER TABLE public.pattern_feedback_log
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE public.pattern_feedback_log
  ALTER COLUMN created_at SET DEFAULT NOW();

UPDATE public.pattern_feedback_log
SET created_at = COALESCE(created_at, NOW())
WHERE created_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pattern_feedback_log_domain
  ON public.pattern_feedback_log (company_domain);

-- ---------------------------------------------------------------------------
-- Quota RPCs: preserve auth checks and atomic increments
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_quotas
  ADD COLUMN IF NOT EXISTS ai_draft_generations_used INTEGER DEFAULT 0;

ALTER TABLE public.user_quotas
  ADD COLUMN IF NOT EXISTS ai_draft_generations_limit INTEGER DEFAULT 0;

ALTER TABLE public.user_quotas
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.user_quotas
  ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.user_quotas
  ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 month');

CREATE OR REPLACE FUNCTION public.check_and_increment_ai_draft(p_user_id UUID)
RETURNS TABLE (allowed BOOLEAN, remaining INTEGER, reset_date TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quota public.user_quotas%ROWTYPE;
  v_limit INTEGER;
  v_used INTEGER;
  v_plan_type TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'permission denied for ai draft quota';
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

  SELECT COALESCE(up.plan_type, v_quota.plan_type, 'free')
  INTO v_plan_type
  FROM public.user_profiles up
  WHERE up.id = p_user_id;

  IF v_plan_type IS NULL THEN
    v_plan_type := COALESCE(v_quota.plan_type, 'free');
  END IF;

  v_limit := CASE
    WHEN v_plan_type = 'pro' THEN 500
    WHEN v_plan_type = 'starter' THEN 150
    ELSE 0
  END;

  IF v_quota.period_end < NOW() THEN
    UPDATE public.user_quotas
    SET
      plan_type = v_plan_type,
      email_lookups_used = 0,
      ai_draft_generations_used = 0,
      email_lookups_limit = CASE
        WHEN v_plan_type = 'pro' THEN 1500
        WHEN v_plan_type = 'starter' THEN 500
        ELSE 50
      END,
      ai_draft_generations_limit = v_limit,
      period_start = NOW(),
      period_end = NOW() + INTERVAL '1 month',
      updated_at = NOW()
    WHERE user_id = p_user_id;

    SELECT *
    INTO v_quota
    FROM public.user_quotas
    WHERE user_id = p_user_id
    FOR UPDATE;
  ELSIF v_quota.plan_type IS DISTINCT FROM v_plan_type
     OR COALESCE(v_quota.ai_draft_generations_limit, -1) IS DISTINCT FROM v_limit THEN
    UPDATE public.user_quotas
    SET
      plan_type = v_plan_type,
      ai_draft_generations_limit = v_limit,
      updated_at = NOW()
    WHERE user_id = p_user_id;

    SELECT *
    INTO v_quota
    FROM public.user_quotas
    WHERE user_id = p_user_id
    FOR UPDATE;
  END IF;

  v_used := COALESCE(v_quota.ai_draft_generations_used, 0);

  IF v_used >= v_limit THEN
    RETURN QUERY SELECT FALSE, 0, v_quota.period_end;
    RETURN;
  END IF;

  UPDATE public.user_quotas
  SET
    plan_type = v_plan_type,
    ai_draft_generations_limit = v_limit,
    ai_draft_generations_used = COALESCE(ai_draft_generations_used, 0) + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT TRUE, GREATEST(0, v_limit - v_used - 1), v_quota.period_end;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_draft(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_draft(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.rollback_email_quota(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'permission denied for rollback_email_quota';
  END IF;

  UPDATE public.user_quotas
  SET
    email_lookups_used = GREATEST(0, COALESCE(email_lookups_used, 0) - 1),
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rollback_email_quota(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_email_quota(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- record migration
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    INSERT INTO public.schema_migrations (version, name)
    VALUES ('039', 'runtime_schema_alignment')
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;
