-- 013_application_tracker.sql
-- Job seeker application pipeline Kanban

-- Job seeker application pipeline stages
CREATE TABLE IF NOT EXISTS public.application_stages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#6366F1',
  position    INTEGER NOT NULL DEFAULT 0,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast per-user ordered lookups
CREATE INDEX IF NOT EXISTS idx_application_stages_user_position
  ON public.application_stages(user_id, position);

-- Link contacts to pipeline stages
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS stage_id        UUID REFERENCES public.application_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applied_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS interview_date  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS job_url         TEXT,
  ADD COLUMN IF NOT EXISTS salary_range    TEXT,
  ADD COLUMN IF NOT EXISTS excitement_level INTEGER CHECK (excitement_level BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS idx_contacts_stage_id ON public.contacts(stage_id);

-- RLS for application_stages
ALTER TABLE public.application_stages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'application_stages' AND policyname = 'Users manage own stages'
  ) THEN
    CREATE POLICY "Users manage own stages"
      ON public.application_stages FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

-- Default stages reference data (seeded per-user via API on first access)
-- Stages: Researching (0), Contacted (1), Replied (2), Interviewing (3), Offer Received (4), Closed (5)
