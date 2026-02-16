-- ============================================================================
-- Migration 005: Email Prediction Learning Tables
-- ============================================================================
-- Adds tables used by:
-- - /api/predict-email (api_predictions analytics logging)
-- - /api/email-feedback and /api/pattern-feedback (pattern learning feedback loop)
--
-- Safe to run multiple times (IF NOT EXISTS + indexes).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS learned_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_domain VARCHAR(255) NOT NULL,
  pattern VARCHAR(50) NOT NULL,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  confidence_boost INTEGER NOT NULL DEFAULT 0,
  last_verified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_domain, pattern)
);

CREATE INDEX IF NOT EXISTS idx_learned_patterns_domain
  ON learned_patterns(company_domain);

CREATE INDEX IF NOT EXISTS idx_learned_patterns_boost
  ON learned_patterns(confidence_boost DESC);

CREATE TABLE IF NOT EXISTS pattern_feedback_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  pattern VARCHAR(50) NOT NULL,
  company_domain VARCHAR(255) NOT NULL,
  worked BOOLEAN NOT NULL,
  contact_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_domain
  ON pattern_feedback_log(company_domain);

CREATE INDEX IF NOT EXISTS idx_feedback_date
  ON pattern_feedback_log(created_at DESC);

CREATE TABLE IF NOT EXISTS api_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_domain VARCHAR(255) NOT NULL,
  top_pattern VARCHAR(50) NOT NULL,
  ai_latency_ms INTEGER NULL,
  tokens_used INTEGER NULL,
  estimated_cost DECIMAL(10, 6) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_user
  ON api_predictions(user_id);

CREATE INDEX IF NOT EXISTS idx_predictions_date
  ON api_predictions(created_at DESC);

