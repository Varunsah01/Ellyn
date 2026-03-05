-- Migration 038: P0 blockers + infrastructure hardening
-- Dependencies: 028_migration_tracking
-- Idempotent: yes

DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.schema_migrations WHERE version = '038'
    ) THEN
      RAISE NOTICE 'Migration 038 already applied, skipping.';
      RETURN;
    END IF;
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- drafts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'archived')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.drafts
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS contact_id UUID,
  ADD COLUMN IF NOT EXISTS template_id UUID,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE public.drafts
  ALTER COLUMN subject SET DEFAULT '',
  ALTER COLUMN body SET DEFAULT '',
  ALTER COLUMN status SET DEFAULT 'draft',
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE public.drafts
SET
  subject = COALESCE(subject, ''),
  body = COALESCE(body, ''),
  status = COALESCE(status, 'draft'),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  subject IS NULL
  OR body IS NULL
  OR status IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.drafts'::regclass
      AND conname = 'drafts_status_check'
  ) THEN
    ALTER TABLE public.drafts
      ADD CONSTRAINT drafts_status_check
      CHECK (status IN ('draft', 'sent', 'archived'));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.drafts WHERE user_id IS NULL) THEN
    RAISE NOTICE 'public.drafts has NULL user_id rows. Keeping column nullable until data is repaired.';
  ELSE
    ALTER TABLE public.drafts ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'drafts'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
  ) THEN
    ALTER TABLE public.drafts
      ADD CONSTRAINT drafts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'drafts'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'contact_id'
  ) THEN
    ALTER TABLE public.drafts
      ADD CONSTRAINT drafts_contact_id_fkey
      FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_drafts_user_updated_at
  ON public.drafts(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_drafts_contact_id
  ON public.drafts(contact_id)
  WHERE contact_id IS NOT NULL;

ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drafts FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  existing_policy RECORD;
BEGIN
  FOR existing_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'drafts'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.drafts;', existing_policy.policyname);
  END LOOP;

  CREATE POLICY drafts_select_own
    ON public.drafts FOR SELECT
    USING (user_id = auth.uid());

  CREATE POLICY drafts_insert_own
    ON public.drafts FOR INSERT
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY drafts_update_own
    ON public.drafts FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY drafts_delete_own
    ON public.drafts FOR DELETE
    USING (user_id = auth.uid());

  CREATE POLICY drafts_service_manage
    ON public.drafts FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
END $$;

DROP TRIGGER IF EXISTS update_drafts_updated_at ON public.drafts;
CREATE TRIGGER update_drafts_updated_at
  BEFORE UPDATE ON public.drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- outreach
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  sequence_id UUID REFERENCES public.sequences(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'contacted', 'sent', 'opened', 'clicked', 'replied', 'bounced')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.outreach
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS contact_id UUID,
  ADD COLUMN IF NOT EXISTS sequence_id UUID,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE public.outreach
  ALTER COLUMN status SET DEFAULT 'draft',
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE public.outreach
SET
  status = COALESCE(status, 'draft'),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  status IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.outreach'::regclass
      AND conname = 'outreach_status_check'
  ) THEN
    ALTER TABLE public.outreach
      ADD CONSTRAINT outreach_status_check
      CHECK (status IN ('draft', 'contacted', 'sent', 'opened', 'clicked', 'replied', 'bounced'));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.outreach WHERE user_id IS NULL) THEN
    RAISE NOTICE 'public.outreach has NULL user_id rows. Keeping column nullable until data is repaired.';
  ELSE
    ALTER TABLE public.outreach ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'outreach'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
  ) THEN
    ALTER TABLE public.outreach
      ADD CONSTRAINT outreach_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_outreach_user_sent_at
  ON public.outreach(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_contact_id
  ON public.outreach(contact_id)
  WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outreach_sequence_id
  ON public.outreach(sequence_id)
  WHERE sequence_id IS NOT NULL;

ALTER TABLE public.outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  existing_policy RECORD;
BEGIN
  FOR existing_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outreach'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.outreach;', existing_policy.policyname);
  END LOOP;

  CREATE POLICY outreach_select_own
    ON public.outreach FOR SELECT
    USING (user_id = auth.uid());

  CREATE POLICY outreach_insert_own
    ON public.outreach FOR INSERT
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY outreach_update_own
    ON public.outreach FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY outreach_delete_own
    ON public.outreach FOR DELETE
    USING (user_id = auth.uid());

  CREATE POLICY outreach_service_manage
    ON public.outreach FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
END $$;

DROP TRIGGER IF EXISTS update_outreach_updated_at ON public.outreach;
CREATE TRIGGER update_outreach_updated_at
  BEFORE UPDATE ON public.outreach
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- activity_log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS contact_id UUID,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE public.activity_log
  ALTER COLUMN description SET DEFAULT '',
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE public.activity_log
SET
  type = COALESCE(type, event_type),
  description = COALESCE(description, event_type, ''),
  metadata = COALESCE(metadata, '{}'::jsonb),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  type IS NULL
  OR description IS NULL
  OR metadata IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.activity_log WHERE user_id IS NULL) THEN
    RAISE NOTICE 'public.activity_log has NULL user_id rows. Keeping column nullable until data is repaired.';
  ELSE
    ALTER TABLE public.activity_log ALTER COLUMN user_id SET NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.activity_log WHERE type IS NULL) THEN
    RAISE NOTICE 'public.activity_log has NULL type rows. Keeping column nullable until data is repaired.';
  ELSE
    ALTER TABLE public.activity_log ALTER COLUMN type SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'activity_log'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
  ) THEN
    ALTER TABLE public.activity_log
      ADD CONSTRAINT activity_log_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'activity_log'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'contact_id'
  ) THEN
    ALTER TABLE public.activity_log
      ADD CONSTRAINT activity_log_contact_id_fkey
      FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_activity_log_user_created
  ON public.activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_type
  ON public.activity_log(user_id, type);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  existing_policy RECORD;
BEGIN
  FOR existing_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'activity_log'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.activity_log;', existing_policy.policyname);
  END LOOP;

  CREATE POLICY activity_log_select_own
    ON public.activity_log FOR SELECT
    USING (user_id = auth.uid());

  CREATE POLICY activity_log_insert_own
    ON public.activity_log FOR INSERT
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY activity_log_update_own
    ON public.activity_log FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY activity_log_delete_own
    ON public.activity_log FOR DELETE
    USING (user_id = auth.uid());

  CREATE POLICY activity_log_service_manage
    ON public.activity_log FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
END $$;

DROP TRIGGER IF EXISTS update_activity_log_updated_at ON public.activity_log;
CREATE TRIGGER update_activity_log_updated_at
  BEFORE UPDATE ON public.activity_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- sequence_events
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sequence_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  enrollment_id UUID NOT NULL REFERENCES public.sequence_enrollments(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.sequence_steps(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('sent', 'opened', 'replied', 'bounced', 'skipped', 'paused', 'resumed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sequence_events
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS contact_id UUID,
  ADD COLUMN IF NOT EXISTS enrollment_id UUID,
  ADD COLUMN IF NOT EXISTS step_id UUID,
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE public.sequence_events
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE public.sequence_events se
SET
  user_id = COALESCE(se.user_id, s.user_id),
  contact_id = COALESCE(se.contact_id, enr.contact_id),
  metadata = COALESCE(se.metadata, '{}'::jsonb),
  created_at = COALESCE(se.created_at, NOW()),
  updated_at = COALESCE(se.updated_at, NOW())
FROM public.sequence_enrollments enr
JOIN public.sequences s
  ON s.id = enr.sequence_id
WHERE
  se.enrollment_id = enr.id
  AND (
    se.user_id IS NULL
    OR se.contact_id IS NULL
    OR se.metadata IS NULL
    OR se.created_at IS NULL
    OR se.updated_at IS NULL
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sequence_events WHERE user_id IS NULL) THEN
    RAISE NOTICE 'public.sequence_events has NULL user_id rows. Keeping column nullable until data is repaired.';
  ELSE
    ALTER TABLE public.sequence_events ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'sequence_events'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
  ) THEN
    ALTER TABLE public.sequence_events
      ADD CONSTRAINT sequence_events_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'sequence_events'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'contact_id'
  ) THEN
    ALTER TABLE public.sequence_events
      ADD CONSTRAINT sequence_events_contact_id_fkey
      FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sequence_events_user_created
  ON public.sequence_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sequence_events_enrollment_created
  ON public.sequence_events(enrollment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sequence_events_contact_created
  ON public.sequence_events(contact_id, created_at DESC)
  WHERE contact_id IS NOT NULL;

ALTER TABLE public.sequence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_events FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  existing_policy RECORD;
BEGIN
  FOR existing_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequence_events'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.sequence_events;', existing_policy.policyname);
  END LOOP;

  CREATE POLICY sequence_events_select_own
    ON public.sequence_events FOR SELECT
    USING (user_id = auth.uid());

  CREATE POLICY sequence_events_insert_own
    ON public.sequence_events FOR INSERT
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY sequence_events_update_own
    ON public.sequence_events FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY sequence_events_delete_own
    ON public.sequence_events FOR DELETE
    USING (user_id = auth.uid());

  CREATE POLICY sequence_events_service_manage
    ON public.sequence_events FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
END $$;

DROP TRIGGER IF EXISTS update_sequence_events_updated_at ON public.sequence_events;
CREATE TRIGGER update_sequence_events_updated_at
  BEFORE UPDATE ON public.sequence_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- email_pattern_cache RLS hardening
-- -----------------------------------------------------------------------------
ALTER TABLE public.email_pattern_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_pattern_cache FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  existing_policy RECORD;
BEGIN
  FOR existing_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'email_pattern_cache'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.email_pattern_cache;', existing_policy.policyname);
  END LOOP;

  CREATE POLICY email_pattern_cache_service_manage
    ON public.email_pattern_cache FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
END $$;

-- -----------------------------------------------------------------------------
-- record migration
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    INSERT INTO public.schema_migrations (version, name)
    VALUES ('038', 'p0_infra_hardening')
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;
