-- Migration 037: Intelligence System + Security Hardening
-- Creates learned_patterns, pattern_feedback_log tables
-- Fixes email_history FK constraints
-- Adds known_company_domains index
--
-- Run in Supabase SQL Editor (idempotent)

-- ============================================================
-- Section A: learned_patterns table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.learned_patterns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_domain   VARCHAR(255) NOT NULL,
  pattern          VARCHAR(50)  NOT NULL,
  success_count    INTEGER      NOT NULL DEFAULT 0,
  failure_count    INTEGER      NOT NULL DEFAULT 0,
  confidence_boost INTEGER      NOT NULL DEFAULT 0,
  injected         BOOLEAN      NOT NULL DEFAULT FALSE,
  last_verified    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(company_domain, pattern)
);

-- RLS: service_role only (no user-facing access)
ALTER TABLE public.learned_patterns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'learned_patterns'
      AND policyname = 'service_role_only_learned_patterns'
  ) THEN
    CREATE POLICY service_role_only_learned_patterns
      ON public.learned_patterns
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_learned_patterns_domain
  ON public.learned_patterns(company_domain);

CREATE INDEX IF NOT EXISTS idx_learned_patterns_confidence
  ON public.learned_patterns(confidence_boost DESC);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.update_learned_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_learned_patterns_updated_at ON public.learned_patterns;
CREATE TRIGGER trg_learned_patterns_updated_at
  BEFORE UPDATE ON public.learned_patterns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_learned_patterns_updated_at();


-- ============================================================
-- Section B: pattern_feedback_log table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pattern_feedback_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT,
  pattern         TEXT         NOT NULL,
  company_domain  TEXT         NOT NULL,
  worked          BOOLEAN      NOT NULL,
  contact_id      UUID,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- RLS: service_role only
ALTER TABLE public.pattern_feedback_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'pattern_feedback_log'
      AND policyname = 'service_role_only_pattern_feedback_log'
  ) THEN
    CREATE POLICY service_role_only_pattern_feedback_log
      ON public.pattern_feedback_log
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pattern_feedback_log_domain
  ON public.pattern_feedback_log(company_domain);


-- ============================================================
-- Section C: Fix email_history foreign keys
-- ============================================================

-- Drop existing user_id FK (NO ACTION) and re-add with CASCADE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'email_history_user_id_fkey'
      AND table_name = 'email_history'
  ) THEN
    ALTER TABLE public.email_history
      DROP CONSTRAINT email_history_user_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'email_history_user_id_fkey'
      AND table_name = 'email_history'
  ) THEN
    ALTER TABLE public.email_history
      ADD CONSTRAINT email_history_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add contact_id FK (missing entirely)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'email_history_contact_id_fk'
      AND table_name = 'email_history'
  ) THEN
    ALTER TABLE public.email_history
      ADD CONSTRAINT email_history_contact_id_fk
      FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;
  END IF;
END $$;


-- ============================================================
-- Section D: known_company_domains index
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_known_company_domains_domain
  ON public.known_company_domains(domain);
