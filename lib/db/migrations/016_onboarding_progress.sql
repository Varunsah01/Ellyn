-- Add onboarding progress tracking to user_profiles.

ALTER TABLE IF EXISTS public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_steps_completed TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding_completed
  ON public.user_profiles(onboarding_completed);

CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding_steps
  ON public.user_profiles USING GIN (onboarding_steps_completed);
