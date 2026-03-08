-- Reconcile runtime tables still referenced by the application but absent in the
-- live project audit. Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.application_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'saved'
    CHECK (status IN ('saved', 'applied', 'interviewing', 'offered', 'rejected')),
  applied_date DATE,
  notes TEXT,
  job_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.application_tracker
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS applied_date DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS job_url TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE public.application_tracker
  ALTER COLUMN status SET DEFAULT 'saved',
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_application_tracker_user_created_at
  ON public.application_tracker (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_application_tracker_user_status
  ON public.application_tracker (user_id, status);

DROP TRIGGER IF EXISTS trg_application_tracker_updated_at ON public.application_tracker;
CREATE TRIGGER trg_application_tracker_updated_at
  BEFORE UPDATE ON public.application_tracker
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.email_lookups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_url TEXT,
  domain TEXT NOT NULL,
  email TEXT NOT NULL,
  pattern TEXT NOT NULL,
  confidence NUMERIC(4,2),
  source TEXT NOT NULL,
  cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
  cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.email_lookups
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS profile_url TEXT,
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS pattern TEXT,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS cache_hit BOOLEAN,
  ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(12,6),
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS success BOOLEAN,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE public.email_lookups
  ALTER COLUMN cache_hit SET DEFAULT FALSE,
  ALTER COLUMN cost_usd SET DEFAULT 0,
  ALTER COLUMN success SET DEFAULT TRUE,
  ALTER COLUMN created_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_email_lookups_user_created_at
  ON public.email_lookups (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_lookups_domain
  ON public.email_lookups (domain);
CREATE INDEX IF NOT EXISTS idx_email_lookups_success
  ON public.email_lookups (success, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_lookups_cache_hit
  ON public.email_lookups (cache_hit);

CREATE TABLE IF NOT EXISTS public.api_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_domain TEXT NOT NULL,
  top_pattern TEXT NOT NULL,
  ai_latency_ms INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(12,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.api_predictions
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS company_domain TEXT,
  ADD COLUMN IF NOT EXISTS top_pattern TEXT,
  ADD COLUMN IF NOT EXISTS ai_latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS tokens_used INTEGER,
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(12,6),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE public.api_predictions
  ALTER COLUMN ai_latency_ms SET DEFAULT 0,
  ALTER COLUMN tokens_used SET DEFAULT 0,
  ALTER COLUMN estimated_cost SET DEFAULT 0,
  ALTER COLUMN created_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_api_predictions_user_created_at
  ON public.api_predictions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_predictions_company_domain
  ON public.api_predictions (company_domain);

CREATE TABLE IF NOT EXISTS public.learned_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_domain TEXT NOT NULL,
  pattern TEXT NOT NULL,
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
  ADD COLUMN IF NOT EXISTS company_domain TEXT,
  ADD COLUMN IF NOT EXISTS pattern TEXT,
  ADD COLUMN IF NOT EXISTS success_count INTEGER,
  ADD COLUMN IF NOT EXISTS failure_count INTEGER,
  ADD COLUMN IF NOT EXISTS confidence_boost INTEGER,
  ADD COLUMN IF NOT EXISTS injected BOOLEAN,
  ADD COLUMN IF NOT EXISTS last_verified TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE public.learned_patterns
  ALTER COLUMN success_count SET DEFAULT 0,
  ALTER COLUMN failure_count SET DEFAULT 0,
  ALTER COLUMN confidence_boost SET DEFAULT 0,
  ALTER COLUMN injected SET DEFAULT FALSE,
  ALTER COLUMN last_verified SET DEFAULT NOW(),
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_learned_patterns_domain
  ON public.learned_patterns (company_domain);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_confidence
  ON public.learned_patterns (confidence_boost DESC);

DROP TRIGGER IF EXISTS trg_learned_patterns_updated_at ON public.learned_patterns;
CREATE TRIGGER trg_learned_patterns_updated_at
  BEFORE UPDATE ON public.learned_patterns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pattern_feedback_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  pattern TEXT NOT NULL,
  company_domain TEXT NOT NULL,
  worked BOOLEAN NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pattern_feedback_log
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS pattern TEXT,
  ADD COLUMN IF NOT EXISTS company_domain TEXT,
  ADD COLUMN IF NOT EXISTS worked BOOLEAN,
  ADD COLUMN IF NOT EXISTS contact_id UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE public.pattern_feedback_log
  ALTER COLUMN created_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_pattern_feedback_log_domain
  ON public.pattern_feedback_log (company_domain);
CREATE INDEX IF NOT EXISTS idx_pattern_feedback_log_created_at
  ON public.pattern_feedback_log (created_at DESC);

CREATE TABLE IF NOT EXISTS public.domain_cache (
  company_name TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  mx_records JSONB NOT NULL DEFAULT '[]'::jsonb,
  email_provider TEXT,
  last_verified TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.domain_cache
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS verified BOOLEAN,
  ADD COLUMN IF NOT EXISTS mx_records JSONB,
  ADD COLUMN IF NOT EXISTS email_provider TEXT,
  ADD COLUMN IF NOT EXISTS last_verified TIMESTAMPTZ;

ALTER TABLE public.domain_cache
  ALTER COLUMN verified SET DEFAULT FALSE,
  ALTER COLUMN mx_records SET DEFAULT '[]'::jsonb,
  ALTER COLUMN last_verified SET DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.domain_resolution_cache (
  company_name TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  source VARCHAR(20) NOT NULL
    CHECK (source IN ('known_db', 'clearbit', 'brandfetch', 'heuristic')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.domain_resolution_cache
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS source VARCHAR(20),
  ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ;

ALTER TABLE public.domain_resolution_cache
  ALTER COLUMN timestamp SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_domain_resolution_cache_timestamp
  ON public.domain_resolution_cache (timestamp DESC);

ALTER TABLE public.application_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_lookups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learned_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pattern_feedback_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_resolution_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'application_tracker' AND policyname = 'application_tracker_owner_all'
  ) THEN
    CREATE POLICY application_tracker_owner_all
      ON public.application_tracker
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'application_tracker' AND policyname = 'application_tracker_service_manage'
  ) THEN
    CREATE POLICY application_tracker_service_manage
      ON public.application_tracker
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_lookups' AND policyname = 'email_lookups_owner_select'
  ) THEN
    CREATE POLICY email_lookups_owner_select
      ON public.email_lookups
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_lookups' AND policyname = 'email_lookups_service_manage'
  ) THEN
    CREATE POLICY email_lookups_service_manage
      ON public.email_lookups
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'api_predictions' AND policyname = 'api_predictions_service_manage'
  ) THEN
    CREATE POLICY api_predictions_service_manage
      ON public.api_predictions
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'learned_patterns' AND policyname = 'learned_patterns_service_manage'
  ) THEN
    CREATE POLICY learned_patterns_service_manage
      ON public.learned_patterns
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pattern_feedback_log' AND policyname = 'pattern_feedback_log_service_manage'
  ) THEN
    CREATE POLICY pattern_feedback_log_service_manage
      ON public.pattern_feedback_log
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'domain_cache' AND policyname = 'domain_cache_service_manage'
  ) THEN
    CREATE POLICY domain_cache_service_manage
      ON public.domain_cache
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'domain_resolution_cache' AND policyname = 'domain_resolution_cache_service_manage'
  ) THEN
    CREATE POLICY domain_resolution_cache_service_manage
      ON public.domain_resolution_cache
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
