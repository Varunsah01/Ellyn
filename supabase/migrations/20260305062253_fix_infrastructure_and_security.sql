-- fix_infrastructure_and_security
-- Creates or repairs missing infrastructure tables, enforces user_id ownership RLS,
-- and hardens email_pattern_cache access.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- drafts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.drafts
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS contact_id UUID,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE public.drafts
  ALTER COLUMN subject SET DEFAULT '',
  ALTER COLUMN body SET DEFAULT '',
  ALTER COLUMN created_at SET DEFAULT NOW();

UPDATE public.drafts
SET
  subject = COALESCE(subject, ''),
  body = COALESCE(body, ''),
  created_at = COALESCE(created_at, NOW())
WHERE
  subject IS NULL
  OR body IS NULL
  OR created_at IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.drafts WHERE user_id IS NULL) THEN
    RAISE NOTICE 'drafts.user_id has NULL rows; leaving nullable until data is repaired';
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

CREATE INDEX IF NOT EXISTS idx_drafts_user_id
  ON public.drafts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drafts_contact_id
  ON public.drafts(contact_id)
  WHERE contact_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- outreach
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  type TEXT NOT NULL DEFAULT 'email',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.outreach
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS contact_id UUID,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE public.outreach
  ALTER COLUMN status SET DEFAULT 'draft',
  ALTER COLUMN type SET DEFAULT 'email',
  ALTER COLUMN created_at SET DEFAULT NOW();

UPDATE public.outreach
SET
  status = COALESCE(status, 'draft'),
  type = COALESCE(type, 'email'),
  created_at = COALESCE(created_at, NOW())
WHERE
  status IS NULL
  OR type IS NULL
  OR created_at IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.outreach WHERE user_id IS NULL) THEN
    RAISE NOTICE 'outreach.user_id has NULL rows; leaving nullable until data is repaired';
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

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'outreach'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'contact_id'
  ) THEN
    ALTER TABLE public.outreach
      ADD CONSTRAINT outreach_contact_id_fkey
      FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_outreach_user_id
  ON public.outreach(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_contact_id
  ON public.outreach(contact_id)
  WHERE contact_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- activity_log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE public.activity_log
  ALTER COLUMN action SET DEFAULT '',
  ALTER COLUMN type SET DEFAULT '',
  ALTER COLUMN description SET DEFAULT '',
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN created_at SET DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activity_log'
      AND column_name = 'event_type'
  ) THEN
    EXECUTE $update_with_event_type$
      UPDATE public.activity_log
      SET
        type = COALESCE(type, action, event_type, ''),
        action = COALESCE(action, type, event_type, ''),
        description = COALESCE(description, ''),
        metadata = COALESCE(metadata, '{}'::jsonb),
        created_at = COALESCE(created_at, NOW())
      WHERE
        type IS NULL
        OR action IS NULL
        OR description IS NULL
        OR metadata IS NULL
        OR created_at IS NULL;
    $update_with_event_type$;
  ELSE
    UPDATE public.activity_log
    SET
      type = COALESCE(type, action, ''),
      action = COALESCE(action, type, ''),
      description = COALESCE(description, ''),
      metadata = COALESCE(metadata, '{}'::jsonb),
      created_at = COALESCE(created_at, NOW())
    WHERE
      type IS NULL
      OR action IS NULL
      OR description IS NULL
      OR metadata IS NULL
      OR created_at IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.activity_log WHERE user_id IS NULL) THEN
    RAISE NOTICE 'activity_log.user_id has NULL rows; leaving nullable until data is repaired';
  ELSE
    ALTER TABLE public.activity_log ALTER COLUMN user_id SET NOT NULL;
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
END $$;

CREATE INDEX IF NOT EXISTS idx_activity_log_user_id
  ON public.activity_log(user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- sequence_events
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sequence_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  sequence_id UUID REFERENCES public.sequences(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sequence_events
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS contact_id UUID,
  ADD COLUMN IF NOT EXISTS sequence_id UUID,
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;

UPDATE public.sequence_events se
SET
  contact_id = COALESCE(se.contact_id, enr.contact_id),
  sequence_id = COALESCE(se.sequence_id, enr.sequence_id),
  occurred_at = COALESCE(se.occurred_at, se.created_at, NOW())
FROM public.sequence_enrollments enr
WHERE se.enrollment_id = enr.id
  AND (
    se.contact_id IS NULL
    OR se.sequence_id IS NULL
    OR se.occurred_at IS NULL
  );

UPDATE public.sequence_events
SET occurred_at = COALESCE(occurred_at, created_at, NOW())
WHERE occurred_at IS NULL;

ALTER TABLE public.sequence_events
  ALTER COLUMN occurred_at SET DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sequence_events WHERE user_id IS NULL) THEN
    RAISE NOTICE 'sequence_events.user_id has NULL rows; leaving nullable until data is repaired';
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

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'sequence_events'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'sequence_id'
  ) THEN
    ALTER TABLE public.sequence_events
      ADD CONSTRAINT sequence_events_sequence_id_fkey
      FOREIGN KEY (sequence_id) REFERENCES public.sequences(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sequence_events_user_id
  ON public.sequence_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_sequence_events_contact_id
  ON public.sequence_events(contact_id)
  WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sequence_events_sequence_id
  ON public.sequence_events(sequence_id)
  WHERE sequence_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- RLS owner + service_role policies
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  target_table TEXT;
  existing_policy RECORD;
  tables TEXT[] := ARRAY['drafts', 'outreach', 'activity_log', 'sequence_events'];
BEGIN
  FOREACH target_table IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', target_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', target_table);

    FOR existing_policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = target_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', existing_policy.policyname, target_table);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (user_id = auth.uid());',
      target_table || '_owner_select',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (user_id = auth.uid());',
      target_table || '_owner_insert',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());',
      target_table || '_owner_update',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (user_id = auth.uid());',
      target_table || '_owner_delete',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'');',
      target_table || '_service',
      target_table
    );
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- email_pattern_cache hardening
-- service_role OR owner-scoped user_id only
-- -----------------------------------------------------------------------------
ALTER TABLE public.email_pattern_cache
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

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

  CREATE POLICY email_pattern_cache_select_restricted
    ON public.email_pattern_cache
    FOR SELECT
    USING (
      auth.role() = 'service_role'
      OR user_id = auth.uid()
    );

  CREATE POLICY email_pattern_cache_insert_restricted
    ON public.email_pattern_cache
    FOR INSERT
    WITH CHECK (
      auth.role() = 'service_role'
      OR user_id = auth.uid()
    );

  CREATE POLICY email_pattern_cache_update_restricted
    ON public.email_pattern_cache
    FOR UPDATE
    USING (
      auth.role() = 'service_role'
      OR user_id = auth.uid()
    )
    WITH CHECK (
      auth.role() = 'service_role'
      OR user_id = auth.uid()
    );

  CREATE POLICY email_pattern_cache_delete_restricted
    ON public.email_pattern_cache
    FOR DELETE
    USING (
      auth.role() = 'service_role'
      OR user_id = auth.uid()
    );
END $$;
