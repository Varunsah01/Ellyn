-- Migration 033: Email tracking enhancements
-- Adds idempotency_key to email_tracking_events,
-- sequence_enrollment_id and provider_thread_id to email_history.
-- All additions are idempotent (IF NOT EXISTS).

-- 1. Idempotency key for open dedup across all send contexts
ALTER TABLE public.email_tracking_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_idempotency
  ON public.email_tracking_events(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 2. Link email_history rows back to sequence enrollment (enables cron reply lookup)
ALTER TABLE public.email_history
  ADD COLUMN IF NOT EXISTS sequence_enrollment_id UUID
    REFERENCES public.sequence_enrollments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_history_enrollment
  ON public.email_history(sequence_enrollment_id)
  WHERE sequence_enrollment_id IS NOT NULL;

-- 3. Provider thread/conversation ID for reply polling
ALTER TABLE public.email_history
  ADD COLUMN IF NOT EXISTS provider_thread_id TEXT;
