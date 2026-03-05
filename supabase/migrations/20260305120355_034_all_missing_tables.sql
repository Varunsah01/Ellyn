-- =============================================================================
-- COMBINED: All missing tables + 033 tracking enhancements
-- Covers: 004, 023, 025, 027, 031, 033
-- Safe to run multiple times — all IF NOT EXISTS / DO $$ guarded.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- =============================================================================
-- 004: sequence_steps, sequence_enrollment_steps, sequence_events
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sequence_steps (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sequence_id  UUID NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
  step_order   INTEGER NOT NULL,
  delay_days   INTEGER DEFAULT 0,
  template_id  UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  subject      TEXT NOT NULL DEFAULT '',
  body         TEXT NOT NULL DEFAULT '',
  stop_on_reply  BOOLEAN DEFAULT true,
  stop_on_bounce BOOLEAN DEFAULT true,
  status       TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sequence_steps_sequence_id ON public.sequence_steps(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_steps_order ON public.sequence_steps(sequence_id, step_order);

ALTER TABLE public.sequence_steps ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sequence_steps' AND policyname='seq_steps_owner_select') THEN
    CREATE POLICY seq_steps_owner_select ON public.sequence_steps FOR SELECT
      USING (auth.uid() = (SELECT user_id FROM public.sequences WHERE id = sequence_steps.sequence_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sequence_steps' AND policyname='seq_steps_owner_insert') THEN
    CREATE POLICY seq_steps_owner_insert ON public.sequence_steps FOR INSERT
      WITH CHECK (auth.uid() = (SELECT user_id FROM public.sequences WHERE id = sequence_steps.sequence_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sequence_steps' AND policyname='seq_steps_owner_update') THEN
    CREATE POLICY seq_steps_owner_update ON public.sequence_steps FOR UPDATE
      USING (auth.uid() = (SELECT user_id FROM public.sequences WHERE id = sequence_steps.sequence_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sequence_steps' AND policyname='seq_steps_service') THEN
    CREATE POLICY seq_steps_service ON public.sequence_steps FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.sequence_enrollment_steps (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID NOT NULL REFERENCES public.sequence_enrollments(id) ON DELETE CASCADE,
  step_id       UUID NOT NULL REFERENCES public.sequence_steps(id) ON DELETE CASCADE,
  step_order    INTEGER NOT NULL DEFAULT 0,
  scheduled_for TIMESTAMPTZ,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'bounced', 'replied')),
  subject_override TEXT,
  body_override    TEXT,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enroll_steps_enrollment ON public.sequence_enrollment_steps(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enroll_steps_status ON public.sequence_enrollment_steps(status);

ALTER TABLE public.sequence_enrollment_steps ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sequence_enrollment_steps' AND policyname='enroll_steps_service') THEN
    CREATE POLICY enroll_steps_service ON public.sequence_enrollment_steps FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_sequence_steps_updated_at ON public.sequence_steps;
CREATE TRIGGER update_sequence_steps_updated_at
  BEFORE UPDATE ON public.sequence_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_sequence_enrollment_steps_updated_at ON public.sequence_enrollment_steps;
CREATE TRIGGER update_sequence_enrollment_steps_updated_at
  BEFORE UPDATE ON public.sequence_enrollment_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 023: Tracker columns on sequence_enrollment_steps + attachments on sequence_steps
-- =============================================================================

ALTER TABLE public.sequence_enrollment_steps
  ADD COLUMN IF NOT EXISTS opened_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS skipped_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.sequence_steps
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- =============================================================================
-- 025: leads, gmail_credentials, email_history
-- =============================================================================

-- contacts extra columns (safe to re-apply)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS inferred_email TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS confirmed_email TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS inference_pattern TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2);
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email_confidence DECIMAL(5,2);
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS linkedin_headline TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS linkedin_photo_url TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS company_domain TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS location TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='contacts' AND column_name='full_name'
  ) THEN
    ALTER TABLE public.contacts
      ADD COLUMN full_name TEXT GENERATED ALWAYS AS (
        TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,''))
      ) STORED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_name       TEXT NOT NULL DEFAULT '',
  company_name      TEXT,
  discovered_emails JSONB DEFAULT '[]'::jsonb,
  selected_email    TEXT,
  status            TEXT DEFAULT 'discovered'
                    CHECK (status IN ('discovered','contacted','sent','replied','bounced')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leads' AND policyname='leads_owner_all') THEN
    CREATE POLICY leads_owner_all ON public.leads FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.gmail_credentials (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id      TEXT,
  client_secret  TEXT,
  access_token   TEXT,
  refresh_token  TEXT,
  gmail_email    TEXT,
  token_expires_at TIMESTAMPTZ,
  encrypted_version INT DEFAULT 1,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE public.gmail_credentials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gmail_credentials' AND policyname='gmail_creds_owner') THEN
    CREATE POLICY gmail_creds_owner ON public.gmail_credentials FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gmail_credentials' AND policyname='gmail_creds_service') THEN
    CREATE POLICY gmail_creds_service ON public.gmail_credentials FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.email_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  to_email         TEXT,
  subject          TEXT,
  body             TEXT,
  gmail_message_id TEXT,
  status           TEXT DEFAULT 'sent',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.email_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_history' AND policyname='email_history_service_manage') THEN
    CREATE POLICY email_history_service_manage ON public.email_history FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_history_lead_id ON public.email_history(lead_id);

-- =============================================================================
-- 027: Add user_id, contact_id, from_email to email_history
-- =============================================================================

ALTER TABLE public.email_history
  ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS contact_id UUID,
  ADD COLUMN IF NOT EXISTS from_email TEXT;

CREATE INDEX IF NOT EXISTS idx_email_history_user_id ON public.email_history(user_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_history' AND policyname='email_history_owner_read') THEN
    CREATE POLICY email_history_owner_read ON public.email_history FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.email_history DROP CONSTRAINT IF EXISTS email_history_status_check;
  ALTER TABLE public.email_history ADD CONSTRAINT email_history_status_check
    CHECK (status IN ('sent','failed','delivered','opened','bounced'));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not update email_history status constraint: %', SQLERRM;
END $$;

-- =============================================================================
-- 031: outlook_credentials
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.outlook_credentials (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token      TEXT NOT NULL DEFAULT '',
  refresh_token     TEXT,
  outlook_email     TEXT,
  token_expires_at  TIMESTAMPTZ,
  encrypted_version INT DEFAULT 1,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE public.outlook_credentials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='outlook_credentials' AND policyname='outlook_credentials_owner_all') THEN
    CREATE POLICY outlook_credentials_owner_all ON public.outlook_credentials FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='outlook_credentials' AND policyname='outlook_credentials_service_manage') THEN
    CREATE POLICY outlook_credentials_service_manage ON public.outlook_credentials FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_outlook_credentials_user_id ON public.outlook_credentials(user_id);

-- =============================================================================
-- 033: Email tracking enhancements
-- =============================================================================

ALTER TABLE public.email_tracking_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_idempotency
  ON public.email_tracking_events(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.email_history
  ADD COLUMN IF NOT EXISTS sequence_enrollment_id UUID
    REFERENCES public.sequence_enrollments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_history_enrollment
  ON public.email_history(sequence_enrollment_id)
  WHERE sequence_enrollment_id IS NOT NULL;

ALTER TABLE public.email_history
  ADD COLUMN IF NOT EXISTS provider_thread_id TEXT;
