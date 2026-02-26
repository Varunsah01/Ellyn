-- Migration 015: Suppression list
-- Run manually in Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.suppression_list (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  reason      TEXT CHECK (reason IN ('unsubscribed', 'bounced', 'manual')),
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, email)
);

ALTER TABLE public.suppression_list ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'suppression_list'
      AND policyname = 'Users manage own suppressions'
  ) THEN
    CREATE POLICY "Users manage own suppressions"
      ON public.suppression_list
      FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END$$;
