-- Migration 010: Add persona to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS persona TEXT NOT NULL DEFAULT 'job_seeker'
  CHECK (persona IN ('job_seeker', 'smb_sales'));

CREATE INDEX IF NOT EXISTS idx_user_profiles_persona ON public.user_profiles(persona);
