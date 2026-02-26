CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure updated_at trigger helper exists.
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
-- sequences
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sequences (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  goal        TEXT,
  status      TEXT NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  steps       JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS goal TEXT;
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS steps JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS status TEXT;

UPDATE public.sequences
SET status = CASE
  WHEN status IN ('draft', 'active', 'paused', 'archived') THEN status
  WHEN status = 'completed' THEN 'archived'
  ELSE 'draft'
END
WHERE status IS DISTINCT FROM CASE
  WHEN status IN ('draft', 'active', 'paused', 'archived') THEN status
  WHEN status = 'completed' THEN 'archived'
  ELSE 'draft'
END;

ALTER TABLE public.sequences ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE public.sequences ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.sequences'::regclass
      AND conname = 'sequences_status_check'
  ) THEN
    ALTER TABLE public.sequences DROP CONSTRAINT sequences_status_check;
  END IF;

  ALTER TABLE public.sequences
    ADD CONSTRAINT sequences_status_check
    CHECK (status IN ('draft', 'active', 'paused', 'archived'));
END;
$$;

CREATE INDEX IF NOT EXISTS idx_sequences_user_id ON public.sequences(user_id);
CREATE INDEX IF NOT EXISTS idx_sequences_status ON public.sequences(status);
CREATE INDEX IF NOT EXISTS idx_sequences_created_at ON public.sequences(created_at DESC);

-- -----------------------------------------------------------------------------
-- sequence_enrollments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sequence_enrollments (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sequence_id        UUID NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
  contact_id         UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','completed','replied','bounced','unsubscribed','removed')),
  current_step_index INTEGER NOT NULL DEFAULT 0,
  next_step_at       TIMESTAMPTZ,
  enrolled_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sequence_id, contact_id)
);

ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS current_step_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS next_step_at TIMESTAMPTZ;
ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS status TEXT;

-- Backfill user_id via sequence ownership when needed.
UPDATE public.sequence_enrollments se
SET user_id = sq.user_id
FROM public.sequences sq
WHERE se.sequence_id = sq.id
  AND se.user_id IS NULL;

-- Backfill current_step_index from legacy current_step when present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sequence_enrollments'
      AND column_name = 'current_step'
  ) THEN
    EXECUTE '
      UPDATE public.sequence_enrollments
      SET current_step_index = COALESCE(current_step, 0)
      WHERE current_step_index IS NULL
    ';
  END IF;
END;
$$;

-- Backfill enrolled_at from legacy fields.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sequence_enrollments'
      AND column_name = 'start_date'
  ) THEN
    EXECUTE '
      UPDATE public.sequence_enrollments
      SET enrolled_at = COALESCE(enrolled_at, start_date, created_at, NOW())
      WHERE enrolled_at IS NULL
    ';
  ELSE
    UPDATE public.sequence_enrollments
    SET enrolled_at = COALESCE(enrolled_at, created_at, NOW())
    WHERE enrolled_at IS NULL;
  END IF;
END;
$$;

UPDATE public.sequence_enrollments
SET status = CASE
  WHEN status IN ('active','completed','replied','bounced','unsubscribed','removed') THEN status
  WHEN status IN ('not_started','in_progress','paused') THEN 'active'
  ELSE 'active'
END
WHERE status IS DISTINCT FROM CASE
  WHEN status IN ('active','completed','replied','bounced','unsubscribed','removed') THEN status
  WHEN status IN ('not_started','in_progress','paused') THEN 'active'
  ELSE 'active'
END;

ALTER TABLE public.sequence_enrollments ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE public.sequence_enrollments ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.sequence_enrollments ALTER COLUMN current_step_index SET DEFAULT 0;
ALTER TABLE public.sequence_enrollments ALTER COLUMN current_step_index SET NOT NULL;
ALTER TABLE public.sequence_enrollments ALTER COLUMN enrolled_at SET DEFAULT NOW();
ALTER TABLE public.sequence_enrollments ALTER COLUMN enrolled_at SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.sequence_enrollments'::regclass
      AND conname = 'sequence_enrollments_status_check'
  ) THEN
    ALTER TABLE public.sequence_enrollments DROP CONSTRAINT sequence_enrollments_status_check;
  END IF;

  ALTER TABLE public.sequence_enrollments
    ADD CONSTRAINT sequence_enrollments_status_check
    CHECK (status IN ('active','completed','replied','bounced','unsubscribed','removed'));
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.sequence_enrollments'::regclass
      AND conname = 'sequence_enrollments_sequence_contact_key'
  ) THEN
    ALTER TABLE public.sequence_enrollments
      ADD CONSTRAINT sequence_enrollments_sequence_contact_key
      UNIQUE (sequence_id, contact_id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_enrollments_sequence ON public.sequence_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_contact ON public.sequence_enrollments(contact_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON public.sequence_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_next_step ON public.sequence_enrollments(next_step_at)
  WHERE status = 'active';

-- -----------------------------------------------------------------------------
-- RLS + policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequences'
      AND policyname = 'Users can view own sequences'
  ) THEN
    DROP POLICY "Users can view own sequences" ON public.sequences;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequences'
      AND policyname = 'Users can insert own sequences'
  ) THEN
    DROP POLICY "Users can insert own sequences" ON public.sequences;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequences'
      AND policyname = 'Users can update own sequences'
  ) THEN
    DROP POLICY "Users can update own sequences" ON public.sequences;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequence_enrollments'
      AND policyname = 'Users can view own enrollments'
  ) THEN
    DROP POLICY "Users can view own enrollments" ON public.sequence_enrollments;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequence_enrollments'
      AND policyname = 'Users can insert own enrollments'
  ) THEN
    DROP POLICY "Users can insert own enrollments" ON public.sequence_enrollments;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequence_enrollments'
      AND policyname = 'Users can update own enrollments'
  ) THEN
    DROP POLICY "Users can update own enrollments" ON public.sequence_enrollments;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequences'
      AND policyname = 'Users manage own sequences'
  ) THEN
    CREATE POLICY "Users manage own sequences"
      ON public.sequences
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequence_enrollments'
      AND policyname = 'Users manage own enrollments'
  ) THEN
    CREATE POLICY "Users manage own enrollments"
      ON public.sequence_enrollments
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequences'
      AND policyname = 'Service role manages sequences'
  ) THEN
    CREATE POLICY "Service role manages sequences"
      ON public.sequences
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sequence_enrollments'
      AND policyname = 'Service role manages enrollments'
  ) THEN
    CREATE POLICY "Service role manages enrollments"
      ON public.sequence_enrollments
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- Trigger
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_sequences_updated_at ON public.sequences;
CREATE TRIGGER trg_sequences_updated_at
  BEFORE UPDATE ON public.sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();