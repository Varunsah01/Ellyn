-- =============================================================================
-- Run this entire script in Supabase SQL Editor.
-- Safe to run multiple times (all IF NOT EXISTS / DO $$ guards).
-- Combines: 025 (email_history table), 027 (production columns), 033 (tracking enhancements)
-- =============================================================================

-- ── 025: Create email_history table ──────────────────────────────────────────
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
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'email_history' AND policyname = 'email_history_service_manage'
  ) THEN
    CREATE POLICY email_history_service_manage
      ON public.email_history FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_history_lead_id
  ON public.email_history (lead_id);

-- ── 027: Add user_id, contact_id, from_email, gmail token columns ─────────────
ALTER TABLE public.email_history
  ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS contact_id UUID,
  ADD COLUMN IF NOT EXISTS from_email TEXT;

CREATE INDEX IF NOT EXISTS idx_email_history_user_id
  ON public.email_history (user_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'email_history' AND policyname = 'email_history_owner_read'
  ) THEN
    CREATE POLICY email_history_owner_read ON public.email_history
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.email_history DROP CONSTRAINT IF EXISTS email_history_status_check;
  ALTER TABLE public.email_history ADD CONSTRAINT email_history_status_check
    CHECK (status IN ('sent', 'failed', 'delivered', 'opened', 'bounced'));
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not update email_history status constraint: %', SQLERRM;
END $$;

-- ── 033: Email tracking enhancements ─────────────────────────────────────────

-- 1. Idempotency key on email_tracking_events
ALTER TABLE public.email_tracking_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_idempotency
  ON public.email_tracking_events(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 2. Link email_history → sequence_enrollments
ALTER TABLE public.email_history
  ADD COLUMN IF NOT EXISTS sequence_enrollment_id UUID
    REFERENCES public.sequence_enrollments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_history_enrollment
  ON public.email_history(sequence_enrollment_id)
  WHERE sequence_enrollment_id IS NOT NULL;

-- 3. Provider thread / conversation ID for reply polling
ALTER TABLE public.email_history
  ADD COLUMN IF NOT EXISTS provider_thread_id TEXT;
