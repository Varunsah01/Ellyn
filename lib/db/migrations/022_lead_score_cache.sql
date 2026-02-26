-- Migration 022: Add lead score cache columns to contacts
-- Run manually in Supabase SQL editor

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS lead_score_cache   INTEGER,
  ADD COLUMN IF NOT EXISTS lead_score_grade   TEXT CHECK (lead_score_grade IN ('hot', 'warm', 'cold')),
  ADD COLUMN IF NOT EXISTS lead_score_computed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_lead_score
  ON public.contacts (lead_score_cache)
  WHERE lead_score_cache IS NOT NULL;
