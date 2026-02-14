-- ============================================================================
-- Migration 004: Analytics and Cost Tracking (Additive / Idempotent)
-- ============================================================================
-- Notes:
-- - Uses TIMESTAMPTZ columns so timestamps are stored as absolute UTC moments.
-- - Keeps existing data intact and can run safely on partially initialized DBs.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- API COSTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.api_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL CHECK (service IN ('anthropic', 'abstract', 'clearbit', 'other')),
  cost_usd DECIMAL(10, 6) NOT NULL CHECK (cost_usd >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.api_costs
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS service VARCHAR(50),
  ADD COLUMN IF NOT EXISTS cost_usd DECIMAL(10, 6),
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

UPDATE public.api_costs
SET
  metadata = COALESCE(metadata, '{}'::jsonb),
  created_at = COALESCE(created_at, NOW());

ALTER TABLE public.api_costs
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN metadata SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_api_costs_service'
      AND conrelid = 'public.api_costs'::regclass
  ) THEN
    ALTER TABLE public.api_costs
      ADD CONSTRAINT chk_api_costs_service
      CHECK (service IN ('anthropic', 'abstract', 'clearbit', 'other'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_api_costs_cost_non_negative'
      AND conrelid = 'public.api_costs'::regclass
  ) THEN
    ALTER TABLE public.api_costs
      ADD CONSTRAINT chk_api_costs_cost_non_negative
      CHECK (cost_usd >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_api_costs_user ON public.api_costs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_costs_service ON public.api_costs(service, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_costs_date ON public.api_costs(created_at DESC);

-- ============================================================================
-- EMAIL LOOKUPS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_lookups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_url TEXT,
  domain TEXT NOT NULL,
  email TEXT NOT NULL,
  pattern TEXT NOT NULL,
  confidence DECIMAL(3, 2) CHECK (confidence >= 0 AND confidence <= 1),
  source VARCHAR(50) NOT NULL,
  cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
  cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
  duration_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  user_feedback VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.email_lookups
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS profile_url TEXT,
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS pattern TEXT,
  ADD COLUMN IF NOT EXISTS confidence DECIMAL(3, 2),
  ADD COLUMN IF NOT EXISTS source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS cache_hit BOOLEAN,
  ADD COLUMN IF NOT EXISTS cost_usd DECIMAL(10, 6),
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS success BOOLEAN,
  ADD COLUMN IF NOT EXISTS user_feedback VARCHAR(20),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

UPDATE public.email_lookups
SET
  cache_hit = COALESCE(cache_hit, FALSE),
  cost_usd = COALESCE(cost_usd, 0),
  success = COALESCE(success, TRUE),
  created_at = COALESCE(created_at, NOW());

ALTER TABLE public.email_lookups
  ALTER COLUMN cache_hit SET DEFAULT FALSE,
  ALTER COLUMN cache_hit SET NOT NULL,
  ALTER COLUMN cost_usd SET DEFAULT 0,
  ALTER COLUMN cost_usd SET NOT NULL,
  ALTER COLUMN success SET DEFAULT TRUE,
  ALTER COLUMN success SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_email_lookups_confidence_range'
      AND conrelid = 'public.email_lookups'::regclass
  ) THEN
    ALTER TABLE public.email_lookups
      ADD CONSTRAINT chk_email_lookups_confidence_range
      CHECK (confidence >= 0 AND confidence <= 1);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_email_lookups_cost_non_negative'
      AND conrelid = 'public.email_lookups'::regclass
  ) THEN
    ALTER TABLE public.email_lookups
      ADD CONSTRAINT chk_email_lookups_cost_non_negative
      CHECK (cost_usd >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lookups_user ON public.email_lookups(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lookups_domain ON public.email_lookups(domain);
CREATE INDEX IF NOT EXISTS idx_lookups_success ON public.email_lookups(success, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lookups_cache_hit ON public.email_lookups(cache_hit);
CREATE INDEX IF NOT EXISTS idx_lookups_date ON public.email_lookups(created_at DESC);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.api_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_lookups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own costs" ON public.api_costs;
DROP POLICY IF EXISTS "Users view own lookups" ON public.email_lookups;
DROP POLICY IF EXISTS "Service role manages costs" ON public.api_costs;
DROP POLICY IF EXISTS "Service role manages lookups" ON public.email_lookups;

CREATE POLICY "Users view own costs"
  ON public.api_costs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users view own lookups"
  ON public.email_lookups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages costs"
  ON public.api_costs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role manages lookups"
  ON public.email_lookups FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- ANALYTICS FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_analytics(
  p_user_id UUID,
  p_period TEXT DEFAULT 'month'
)
RETURNS TABLE (
  total_lookups BIGINT,
  successful_lookups BIGINT,
  success_rate DECIMAL,
  total_cost_usd DECIMAL,
  avg_cost_per_lookup DECIMAL,
  cache_hit_rate DECIMAL,
  avg_confidence DECIMAL,
  most_common_pattern TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date TIMESTAMPTZ;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'permission denied for user analytics';
  END IF;

  CASE p_period
    WHEN 'day' THEN v_start_date := NOW() - INTERVAL '1 day';
    WHEN 'week' THEN v_start_date := NOW() - INTERVAL '7 days';
    WHEN 'month' THEN v_start_date := NOW() - INTERVAL '30 days';
    ELSE v_start_date := '1970-01-01'::TIMESTAMPTZ;
  END CASE;

  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_lookups,
    COUNT(*) FILTER (WHERE success = TRUE)::BIGINT AS successful_lookups,
    COALESCE(
      ROUND(
        (COUNT(*) FILTER (WHERE success = TRUE)::DECIMAL / NULLIF(COUNT(*), 0)) * 100,
        2
      ),
      0
    ) AS success_rate,
    COALESCE(SUM(cost_usd), 0)::DECIMAL AS total_cost_usd,
    COALESCE(ROUND(COALESCE(SUM(cost_usd) / NULLIF(COUNT(*), 0), 0), 6), 0) AS avg_cost_per_lookup,
    COALESCE(
      ROUND(
        (COUNT(*) FILTER (WHERE cache_hit = TRUE)::DECIMAL / NULLIF(COUNT(*), 0)) * 100,
        2
      ),
      0
    ) AS cache_hit_rate,
    COALESCE(ROUND(AVG(confidence), 2), 0) AS avg_confidence,
    MODE() WITHIN GROUP (ORDER BY pattern) AS most_common_pattern
  FROM public.email_lookups
  WHERE user_id = p_user_id
    AND created_at >= v_start_date;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_analytics(
  p_period TEXT DEFAULT 'day'
)
RETURNS TABLE (
  total_users BIGINT,
  total_lookups BIGINT,
  total_cost_usd DECIMAL,
  avg_cost_per_lookup DECIMAL,
  success_rate DECIMAL,
  cache_hit_rate DECIMAL,
  anthropic_cost DECIMAL,
  abstract_cost DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date TIMESTAMPTZ;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'permission denied for admin analytics';
  END IF;

  CASE p_period
    WHEN 'day' THEN v_start_date := NOW() - INTERVAL '1 day';
    WHEN 'week' THEN v_start_date := NOW() - INTERVAL '7 days';
    WHEN 'month' THEN v_start_date := NOW() - INTERVAL '30 days';
    ELSE v_start_date := '1970-01-01'::TIMESTAMPTZ;
  END CASE;

  RETURN QUERY
  WITH lookup_stats AS (
    SELECT
      COUNT(*)::BIGINT AS total_lookups,
      COUNT(*) FILTER (WHERE success = TRUE)::BIGINT AS successful_lookups,
      COUNT(*) FILTER (WHERE cache_hit = TRUE)::BIGINT AS cache_hits
    FROM public.email_lookups
    WHERE created_at >= v_start_date
  ),
  cost_stats AS (
    SELECT
      COALESCE(SUM(cost_usd), 0)::DECIMAL AS total_cost_usd,
      COALESCE(SUM(cost_usd) FILTER (WHERE service = 'anthropic'), 0)::DECIMAL AS anthropic_cost,
      COALESCE(SUM(cost_usd) FILTER (WHERE service = 'abstract'), 0)::DECIMAL AS abstract_cost
    FROM public.api_costs
    WHERE created_at >= v_start_date
  )
  SELECT
    (SELECT COUNT(*)::BIGINT FROM auth.users) AS total_users,
    l.total_lookups,
    c.total_cost_usd,
    COALESCE(ROUND(COALESCE(c.total_cost_usd / NULLIF(l.total_lookups, 0), 0), 6), 0) AS avg_cost_per_lookup,
    COALESCE(ROUND((l.successful_lookups::DECIMAL / NULLIF(l.total_lookups, 0)) * 100, 2), 0) AS success_rate,
    COALESCE(ROUND((l.cache_hits::DECIMAL / NULLIF(l.total_lookups, 0)) * 100, 2), 0) AS cache_hit_rate,
    c.anthropic_cost,
    c.abstract_cost
  FROM lookup_stats l
  CROSS JOIN cost_stats c;
END;
$$;
