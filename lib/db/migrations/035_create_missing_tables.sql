-- =============================================================================
-- 035: Create missing tables: drafts, activity_log, outreach, sequence_events
-- Safe to run multiple times — all CREATE TABLE IF NOT EXISTS / DO $$ guarded.
-- Run in Supabase SQL editor.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: drafts
-- User-composed outreach drafts (distinct from ai_drafts, which stores AI
-- generation requests). Used by app/api/drafts/ and app/api/v1/drafts/.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.drafts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id  UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  subject     TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft', 'sent')),
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drafts_user_id
  ON public.drafts(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_drafts_contact_id
  ON public.drafts(contact_id)
  WHERE contact_id IS NOT NULL;

ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'drafts' AND policyname = 'drafts_owner_select'
  ) THEN
    CREATE POLICY drafts_owner_select ON public.drafts
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'drafts' AND policyname = 'drafts_owner_insert'
  ) THEN
    CREATE POLICY drafts_owner_insert ON public.drafts
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'drafts' AND policyname = 'drafts_owner_update'
  ) THEN
    CREATE POLICY drafts_owner_update ON public.drafts
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'drafts' AND policyname = 'drafts_owner_delete'
  ) THEN
    CREATE POLICY drafts_owner_delete ON public.drafts
      FOR DELETE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'drafts' AND policyname = 'drafts_service'
  ) THEN
    CREATE POLICY drafts_service ON public.drafts
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_drafts_updated_at ON public.drafts;
CREATE TRIGGER update_drafts_updated_at
  BEFORE UPDATE ON public.drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Table: activity_log
-- Append-only audit/activity feed. Written via lib/utils/recordActivity.ts.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id  UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  type        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_id
  ON public.activity_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_contact_id
  ON public.activity_log(contact_id)
  WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_log_type
  ON public.activity_log(user_id, type);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'activity_log' AND policyname = 'activity_log_owner_select'
  ) THEN
    CREATE POLICY activity_log_owner_select ON public.activity_log
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'activity_log' AND policyname = 'activity_log_owner_insert'
  ) THEN
    CREATE POLICY activity_log_owner_insert ON public.activity_log
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'activity_log' AND policyname = 'activity_log_owner_update'
  ) THEN
    CREATE POLICY activity_log_owner_update ON public.activity_log
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'activity_log' AND policyname = 'activity_log_owner_delete'
  ) THEN
    CREATE POLICY activity_log_owner_delete ON public.activity_log
      FOR DELETE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'activity_log' AND policyname = 'activity_log_service'
  ) THEN
    CREATE POLICY activity_log_service ON public.activity_log
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_activity_log_updated_at ON public.activity_log;
CREATE TRIGGER update_activity_log_updated_at
  BEFORE UPDATE ON public.activity_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Table: outreach
-- Tracks individual outreach emails per contact/sequence. Queried heavily by
-- app/api/analytics/ for reply rates, heatmaps, and sequence performance.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.outreach (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id  UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  sequence_id UUID REFERENCES public.sequences(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft', 'sent', 'opened', 'replied', 'bounced')),
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_user_id
  ON public.outreach(user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_outreach_contact_id
  ON public.outreach(contact_id)
  WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_sequence_id
  ON public.outreach(sequence_id, user_id)
  WHERE sequence_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_sent_at
  ON public.outreach(user_id, sent_at)
  WHERE sent_at IS NOT NULL;

ALTER TABLE public.outreach ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'outreach' AND policyname = 'outreach_owner_select'
  ) THEN
    CREATE POLICY outreach_owner_select ON public.outreach
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'outreach' AND policyname = 'outreach_owner_insert'
  ) THEN
    CREATE POLICY outreach_owner_insert ON public.outreach
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'outreach' AND policyname = 'outreach_owner_update'
  ) THEN
    CREATE POLICY outreach_owner_update ON public.outreach
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'outreach' AND policyname = 'outreach_owner_delete'
  ) THEN
    CREATE POLICY outreach_owner_delete ON public.outreach
      FOR DELETE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'outreach' AND policyname = 'outreach_service'
  ) THEN
    CREATE POLICY outreach_service ON public.outreach
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_outreach_updated_at ON public.outreach;
CREATE TRIGGER update_outreach_updated_at
  BEFORE UPDATE ON public.outreach
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Table: sequence_events
-- Event timeline for sequence enrollments (originally defined in 004_sequences
-- but dropped by 001_complete_foundation reset and never recreated).
-- user_id is denormalised here for direct, performant RLS without subqueries.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sequence_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.sequence_enrollments(id) ON DELETE CASCADE,
  step_id       UUID REFERENCES public.sequence_steps(id) ON DELETE SET NULL,
  event_type    TEXT NOT NULL
                CHECK (event_type IN ('sent', 'opened', 'replied', 'bounced', 'skipped', 'paused', 'resumed')),
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sequence_events_enrollment_id
  ON public.sequence_events(enrollment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sequence_events_user_id
  ON public.sequence_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sequence_events_type
  ON public.sequence_events(user_id, event_type);

ALTER TABLE public.sequence_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sequence_events' AND policyname = 'sequence_events_owner_select'
  ) THEN
    CREATE POLICY sequence_events_owner_select ON public.sequence_events
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sequence_events' AND policyname = 'sequence_events_owner_insert'
  ) THEN
    CREATE POLICY sequence_events_owner_insert ON public.sequence_events
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sequence_events' AND policyname = 'sequence_events_owner_update'
  ) THEN
    CREATE POLICY sequence_events_owner_update ON public.sequence_events
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sequence_events' AND policyname = 'sequence_events_owner_delete'
  ) THEN
    CREATE POLICY sequence_events_owner_delete ON public.sequence_events
      FOR DELETE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sequence_events' AND policyname = 'sequence_events_service'
  ) THEN
    CREATE POLICY sequence_events_service ON public.sequence_events
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_sequence_events_updated_at ON public.sequence_events;
CREATE TRIGGER update_sequence_events_updated_at
  BEFORE UPDATE ON public.sequence_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
