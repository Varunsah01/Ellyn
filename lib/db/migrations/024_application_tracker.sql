-- ============================================================================
-- Migration 024: Simple Job Application Tracker
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.application_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT DEFAULT 'saved' CHECK (status IN ('saved', 'applied', 'interviewing', 'offered', 'rejected')),
  applied_date DATE,
  notes TEXT,
  job_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.application_tracker ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.application_tracker ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.application_tracker ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.application_tracker ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.application_tracker ADD COLUMN IF NOT EXISTS applied_date DATE;
ALTER TABLE public.application_tracker ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.application_tracker ADD COLUMN IF NOT EXISTS job_url TEXT;
ALTER TABLE public.application_tracker ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE public.application_tracker ALTER COLUMN status SET DEFAULT 'saved';
ALTER TABLE public.application_tracker ALTER COLUMN created_at SET DEFAULT NOW();

UPDATE public.application_tracker
SET status = 'saved'
WHERE status IS NULL
   OR status NOT IN ('saved', 'applied', 'interviewing', 'offered', 'rejected');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.application_tracker'::regclass
      AND conname = 'application_tracker_status_check'
  ) THEN
    ALTER TABLE public.application_tracker
      ADD CONSTRAINT application_tracker_status_check
      CHECK (status IN ('saved', 'applied', 'interviewing', 'offered', 'rejected'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'application_tracker_user_id_fkey'
      AND conrelid = 'public.application_tracker'::regclass
  ) THEN
    ALTER TABLE public.application_tracker
      ADD CONSTRAINT application_tracker_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END;
$$;

ALTER TABLE public.application_tracker ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'application_tracker'
      AND policyname = 'application_tracker_owner_all'
  ) THEN
    CREATE POLICY application_tracker_owner_all
      ON public.application_tracker
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_application_tracker_user_created_at
  ON public.application_tracker (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_application_tracker_user_status
  ON public.application_tracker (user_id, status);
