-- ============================================================================
-- Migration 001: Complete Foundation Schema (Clean Baseline)
-- ============================================================================
-- WARNING:
-- This is a destructive baseline migration intended for a fresh/sanitized
-- Supabase project. It is not intended to be combined on the same database
-- with the existing legacy migration chain (003_*/004_*) without reconciliation.
--
-- This script:
-- 1) Deterministically drops conflicting legacy/foundation objects
-- 2) Rebuilds the complete foundation schema
-- 3) Applies strict RLS for service-write paths
-- 4) Creates hardened helper functions and triggers
-- ============================================================================

-- ============================================================================
-- EXTENSION SETUP
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- DETERMINISTIC RESET (DESTRUCTIVE)
-- ============================================================================

-- Drop auth trigger first (if present)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop helper functions from prior iterations/legacy schema
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_data() CASCADE;
DROP FUNCTION IF EXISTS reset_expired_quotas() CASCADE;
DROP FUNCTION IF EXISTS check_and_increment_quota(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_user_analytics(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS update_pattern_success_rate() CASCADE;

-- Drop conflicting legacy and foundation tables
DROP TABLE IF EXISTS sequence_events CASCADE;
DROP TABLE IF EXISTS sequence_enrollment_steps CASCADE;
DROP TABLE IF EXISTS sequence_enrollments CASCADE;
DROP TABLE IF EXISTS sequence_steps CASCADE;
DROP TABLE IF EXISTS sequences CASCADE;
DROP TABLE IF EXISTS user_onboarding CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS pattern_feedback_log CASCADE;
DROP TABLE IF EXISTS pattern_learning CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS api_usage CASCADE;
DROP TABLE IF EXISTS email_templates CASCADE;
DROP TABLE IF EXISTS drafts CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS domain_cache CASCADE;
DROP TABLE IF EXISTS gmail_credentials CASCADE;
DROP TABLE IF EXISTS email_history CASCADE;

DROP TABLE IF EXISTS ai_drafts CASCADE;
DROP TABLE IF EXISTS email_pattern_cache CASCADE;
DROP TABLE IF EXISTS email_lookups CASCADE;
DROP TABLE IF EXISTS api_costs CASCADE;
DROP TABLE IF EXISTS user_quotas CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- ============================================================================
-- USER PROFILES (extends Supabase auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  plan_type VARCHAR(10) NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'pro')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  subscription_status VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer ON user_profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_plan ON user_profiles(plan_type);

-- ============================================================================
-- CONTACTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Basic info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  email TEXT,
  company TEXT,
  role TEXT,
  location TEXT,

  -- LinkedIn data
  linkedin_url TEXT,
  linkedin_headline TEXT,
  linkedin_photo_url TEXT,

  -- Email metadata
  email_pattern TEXT,
  email_confidence DECIMAL(3, 2) CHECK (email_confidence >= 0 AND email_confidence <= 1),
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_source VARCHAR(50),

  -- Outreach tracking
  outreach_status VARCHAR(20) NOT NULL DEFAULT 'not_contacted',
  last_contacted_at TIMESTAMPTZ,
  response_received BOOLEAN NOT NULL DEFAULT FALSE,

  -- Metadata
  tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  notes TEXT,
  custom_fields JSONB NOT NULL DEFAULT '{}'::JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company) WHERE company IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_linkedin_url ON contacts(linkedin_url) WHERE linkedin_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_outreach_status ON contacts(outreach_status);

-- ============================================================================
-- USER QUOTAS
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_quotas (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type VARCHAR(10) NOT NULL CHECK (plan_type IN ('free', 'pro')),

  -- Email lookup limits
  email_lookups_used INTEGER NOT NULL DEFAULT 0 CHECK (email_lookups_used >= 0),
  email_lookups_limit INTEGER NOT NULL CHECK (email_lookups_limit > 0),

  -- AI draft limits
  ai_drafts_used INTEGER NOT NULL DEFAULT 0 CHECK (ai_drafts_used >= 0),
  ai_drafts_limit INTEGER NOT NULL CHECK (ai_drafts_limit > 0),

  -- Period tracking
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  CONSTRAINT chk_user_quotas_period CHECK (period_end > period_start),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_quotas_period ON user_quotas(period_end);

-- ============================================================================
-- API COSTS TRACKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL CHECK (service IN ('anthropic', 'abstract', 'clearbit', 'other')),
  cost_usd DECIMAL(10, 6) NOT NULL CHECK (cost_usd >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_costs_user ON api_costs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_costs_service ON api_costs(service, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_costs_date ON api_costs(created_at DESC);

-- ============================================================================
-- EMAIL LOOKUPS (detailed analytics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_lookups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Profile data
  profile_url TEXT,
  domain TEXT NOT NULL,

  -- Result data
  email TEXT NOT NULL,
  pattern TEXT NOT NULL,
  confidence DECIMAL(3, 2) CHECK (confidence >= 0 AND confidence <= 1),
  source VARCHAR(50) NOT NULL,

  -- Performance metrics
  cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
  cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),

  -- Success tracking
  success BOOLEAN NOT NULL DEFAULT TRUE,
  user_feedback VARCHAR(20),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lookups_user ON email_lookups(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lookups_domain ON email_lookups(domain);
CREATE INDEX IF NOT EXISTS idx_lookups_success ON email_lookups(success, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lookups_cache_hit ON email_lookups(cache_hit);

-- ============================================================================
-- PATTERN CACHE (for email patterns by domain)
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_pattern_cache (
  domain TEXT PRIMARY KEY,
  pattern TEXT NOT NULL,
  confidence DECIMAL(3, 2) CHECK (confidence >= 0 AND confidence <= 1),

  -- Verification status
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by VARCHAR(50),

  -- Usage statistics
  success_count INTEGER NOT NULL DEFAULT 1 CHECK (success_count >= 0),
  fail_count INTEGER NOT NULL DEFAULT 0 CHECK (fail_count >= 0),

  -- Timestamps
  last_validated TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pattern_cache_confidence ON email_pattern_cache(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_cache_verified ON email_pattern_cache(verified);

-- ============================================================================
-- AI DRAFTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  template_name VARCHAR(100),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,

  -- AI metadata
  model_used VARCHAR(50),
  tokens_used INTEGER CHECK (tokens_used IS NULL OR tokens_used >= 0),
  generation_cost DECIMAL(10, 6) CHECK (generation_cost IS NULL OR generation_cost >= 0),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'archived')),
  sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drafts_user ON ai_drafts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drafts_contact ON ai_drafts(contact_id);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON ai_drafts(status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_lookups ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_pattern_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_drafts ENABLE ROW LEVEL SECURITY;

-- user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- contacts
DROP POLICY IF EXISTS "Users can view own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete own contacts" ON contacts;

CREATE POLICY "Users can view own contacts"
  ON contacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contacts"
  ON contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contacts"
  ON contacts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contacts"
  ON contacts FOR DELETE
  USING (auth.uid() = user_id);

-- user_quotas
DROP POLICY IF EXISTS "Users can view own quota" ON user_quotas;
DROP POLICY IF EXISTS "Service role manages quotas" ON user_quotas;

CREATE POLICY "Users can view own quota"
  ON user_quotas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages quotas"
  ON user_quotas FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- api_costs
DROP POLICY IF EXISTS "Users view own costs" ON api_costs;
DROP POLICY IF EXISTS "Service role manages costs" ON api_costs;

CREATE POLICY "Users view own costs"
  ON api_costs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages costs"
  ON api_costs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- email_lookups
DROP POLICY IF EXISTS "Users view own lookups" ON email_lookups;
DROP POLICY IF EXISTS "Service role manages lookups" ON email_lookups;

CREATE POLICY "Users view own lookups"
  ON email_lookups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages lookups"
  ON email_lookups FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- email_pattern_cache (shared read model)
DROP POLICY IF EXISTS "Anyone can read pattern cache" ON email_pattern_cache;
DROP POLICY IF EXISTS "Service role manages pattern cache" ON email_pattern_cache;

CREATE POLICY "Anyone can read pattern cache"
  ON email_pattern_cache FOR SELECT
  USING (TRUE);

CREATE POLICY "Service role manages pattern cache"
  ON email_pattern_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ai_drafts
DROP POLICY IF EXISTS "Users view own drafts" ON ai_drafts;
DROP POLICY IF EXISTS "Users can insert own drafts" ON ai_drafts;
DROP POLICY IF EXISTS "Users can update own drafts" ON ai_drafts;
DROP POLICY IF EXISTS "Users can delete own drafts" ON ai_drafts;

CREATE POLICY "Users view own drafts"
  ON ai_drafts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drafts"
  ON ai_drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drafts"
  ON ai_drafts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own drafts"
  ON ai_drafts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION reset_expired_quotas()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_quotas
  SET
    email_lookups_used = 0,
    ai_drafts_used = 0,
    period_start = period_end,
    period_end = period_end + INTERVAL '1 month',
    updated_at = NOW()
  WHERE period_end < NOW();
END;
$$;

CREATE OR REPLACE FUNCTION check_and_increment_quota(
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
  v_quota user_quotas%ROWTYPE;
  v_used INTEGER;
  v_limit INTEGER;
BEGIN
  -- Guard: caller must be same user or service role
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'permission denied for quota operation';
  END IF;

  -- Lock quota row to avoid race conditions
  SELECT *
  INTO v_quota
  FROM user_quotas
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quota not found for user %', p_user_id;
  END IF;

  -- Reset this specific record if expired
  IF v_quota.period_end < NOW() THEN
    UPDATE user_quotas
    SET
      email_lookups_used = 0,
      ai_drafts_used = 0,
      period_start = period_end,
      period_end = period_end + INTERVAL '1 month',
      updated_at = NOW()
    WHERE user_id = p_user_id;

    SELECT *
    INTO v_quota
    FROM user_quotas
    WHERE user_id = p_user_id
    FOR UPDATE;
  END IF;

  IF p_quota_type = 'email_lookups' THEN
    v_used := v_quota.email_lookups_used;
    v_limit := v_quota.email_lookups_limit;
  ELSIF p_quota_type = 'ai_drafts' THEN
    v_used := v_quota.ai_drafts_used;
    v_limit := v_quota.ai_drafts_limit;
  ELSE
    RAISE EXCEPTION 'Invalid quota type: %', p_quota_type;
  END IF;

  IF v_used >= v_limit THEN
    RETURN QUERY
    SELECT FALSE, 0, v_quota.period_end;
    RETURN;
  END IF;

  IF p_quota_type = 'email_lookups' THEN
    UPDATE user_quotas
    SET
      email_lookups_used = email_lookups_used + 1,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSE
    UPDATE user_quotas
    SET
      ai_drafts_used = ai_drafts_used + 1,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  RETURN QUERY
  SELECT TRUE, (v_limit - v_used - 1), v_quota.period_end;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_analytics(
  p_user_id UUID,
  p_period TEXT DEFAULT 'month'
)
RETURNS TABLE (
  total_lookups BIGINT,
  successful_lookups BIGINT,
  success_rate DECIMAL(5, 2),
  total_cost_usd DECIMAL(12, 6),
  avg_cost_per_lookup DECIMAL(12, 6),
  cache_hit_rate DECIMAL(5, 2),
  avg_confidence DECIMAL(3, 2),
  most_common_pattern TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date TIMESTAMPTZ;
BEGIN
  -- Guard: caller must be same user or service role
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'permission denied for analytics operation';
  END IF;

  CASE p_period
    WHEN 'day' THEN v_start_date := NOW() - INTERVAL '1 day';
    WHEN 'week' THEN v_start_date := NOW() - INTERVAL '7 days';
    WHEN 'month' THEN v_start_date := NOW() - INTERVAL '30 days';
    WHEN 'all' THEN v_start_date := '1970-01-01'::TIMESTAMPTZ;
    ELSE
      RAISE EXCEPTION 'Invalid period: % (allowed: day|week|month|all)', p_period;
  END CASE;

  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_lookups,
    COUNT(*) FILTER (WHERE success = TRUE)::BIGINT AS successful_lookups,
    ROUND((COUNT(*) FILTER (WHERE success = TRUE)::DECIMAL / NULLIF(COUNT(*), 0) * 100), 2)::DECIMAL(5, 2) AS success_rate,
    COALESCE(SUM(cost_usd), 0)::DECIMAL(12, 6) AS total_cost_usd,
    ROUND(COALESCE(SUM(cost_usd) / NULLIF(COUNT(*), 0), 0), 6)::DECIMAL(12, 6) AS avg_cost_per_lookup,
    ROUND((COUNT(*) FILTER (WHERE cache_hit = TRUE)::DECIMAL / NULLIF(COUNT(*), 0) * 100), 2)::DECIMAL(5, 2) AS cache_hit_rate,
    COALESCE(ROUND(AVG(confidence), 2), 0)::DECIMAL(3, 2) AS avg_confidence,
    MODE() WITHIN GROUP (ORDER BY pattern)::TEXT AS most_common_pattern
  FROM email_lookups
  WHERE user_id = p_user_id
    AND created_at >= v_start_date;
END;
$$;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name, plan_type)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    'free'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_quotas (
    user_id,
    plan_type,
    email_lookups_used,
    email_lookups_limit,
    ai_drafts_used,
    ai_drafts_limit,
    period_start,
    period_end
  ) VALUES (
    NEW.id,
    'free',
    0,
    25, -- Free plan: 25 email lookups/month
    0,
    15, -- Free plan: 15 AI drafts/month
    NOW(),
    NOW() + INTERVAL '1 month'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM email_lookups
  WHERE created_at < NOW() - INTERVAL '90 days';

  DELETE FROM api_costs
  WHERE created_at < NOW() - INTERVAL '90 days';

  DELETE FROM email_pattern_cache
  WHERE confidence < 0.3
    AND updated_at < NOW() - INTERVAL '30 days';
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_quotas_updated_at ON user_quotas;
CREATE TRIGGER update_user_quotas_updated_at
  BEFORE UPDATE ON user_quotas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pattern_cache_updated_at ON email_pattern_cache;
CREATE TRIGGER update_pattern_cache_updated_at
  BEFORE UPDATE ON email_pattern_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_drafts_updated_at ON ai_drafts;
CREATE TRIGGER update_ai_drafts_updated_at
  BEFORE UPDATE ON ai_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- RUNBOOK: EXECUTION & VERIFICATION QUERIES
-- ============================================================================

-- 1) Verify tables
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'user_profiles',
--     'contacts',
--     'user_quotas',
--     'api_costs',
--     'email_lookups',
--     'email_pattern_cache',
--     'ai_drafts'
--   )
-- ORDER BY table_name;

-- 2) Verify indexes
-- SELECT tablename, indexname
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'user_profiles',
--     'contacts',
--     'user_quotas',
--     'api_costs',
--     'email_lookups',
--     'email_pattern_cache',
--     'ai_drafts'
--   )
-- ORDER BY tablename, indexname;

-- 3) Verify functions
-- SELECT
--   n.nspname AS schema_name,
--   p.proname AS function_name,
--   pg_get_function_identity_arguments(p.oid) AS args
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN (
--     'reset_expired_quotas',
--     'check_and_increment_quota',
--     'get_user_analytics',
--     'update_updated_at_column',
--     'handle_new_user',
--     'cleanup_old_data'
--   )
-- ORDER BY p.proname;

-- 4) Verify triggers
-- SELECT
--   ns.nspname AS table_schema,
--   c.relname AS table_name,
--   t.tgname AS trigger_name
-- FROM pg_trigger t
-- JOIN pg_class c ON c.oid = t.tgrelid
-- JOIN pg_namespace ns ON ns.oid = c.relnamespace
-- WHERE NOT t.tgisinternal
--   AND (
--     (ns.nspname = 'public' AND c.relname IN (
--       'user_profiles', 'contacts', 'user_quotas', 'email_pattern_cache', 'ai_drafts'
--     ))
--     OR (ns.nspname = 'auth' AND c.relname = 'users')
--   )
-- ORDER BY ns.nspname, c.relname, t.tgname;

-- 5) Verify RLS policies
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'user_profiles',
--     'contacts',
--     'user_quotas',
--     'api_costs',
--     'email_lookups',
--     'email_pattern_cache',
--     'ai_drafts'
--   )
-- ORDER BY tablename, policyname;

-- 6) RLS smoke-test guidance
-- - As authenticated user:
--   * SELECT own rows from contacts/ai_drafts should succeed
--   * INSERT into api_costs/email_lookups/email_pattern_cache should fail
-- - As service role:
--   * INSERT/UPDATE/DELETE on api_costs/email_lookups/email_pattern_cache should succeed

