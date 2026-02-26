-- Migration: 023_sequence_tracker_columns
-- Adds timing columns to sequence_enrollment_steps for the SequenceTracker,
-- and an attachments column to sequence_steps for the StepConfigPanel.
-- Idempotent — safe to run multiple times.

-- ── sequence_enrollment_steps ────────────────────────────────────────────────
ALTER TABLE sequence_enrollment_steps
  ADD COLUMN IF NOT EXISTS opened_at   TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS replied_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS skipped_at  TIMESTAMPTZ DEFAULT NULL;

-- ── sequence_steps ───────────────────────────────────────────────────────────
ALTER TABLE sequence_steps
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
