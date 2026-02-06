-- Rollback Migration 003: Lean Schema
-- This script removes all tables created in the lean schema migration

-- ============================================================================
-- Drop triggers
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_update_pattern_success_rate ON pattern_learning;
DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
DROP TRIGGER IF EXISTS update_drafts_updated_at ON drafts;
DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;

-- ============================================================================
-- Drop functions
-- ============================================================================

DROP FUNCTION IF EXISTS update_pattern_success_rate();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- ============================================================================
-- Drop tables (in reverse order of dependencies)
-- ============================================================================

DROP TABLE IF EXISTS pattern_learning CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS api_usage CASCADE;
DROP TABLE IF EXISTS drafts CASCADE;
DROP TABLE IF EXISTS email_templates CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
