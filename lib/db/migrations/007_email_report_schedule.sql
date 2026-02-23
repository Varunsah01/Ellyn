-- ============================================================================
-- Add weekly analytics report schedule preference to user profiles
-- ============================================================================

ALTER TABLE IF EXISTS public.user_profiles
ADD COLUMN IF NOT EXISTS email_report_schedule JSONB;
