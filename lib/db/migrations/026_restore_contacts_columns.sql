-- ============================================================================
-- Migration 026: Restore contacts columns expected by v1/contacts routes
-- ============================================================================
-- Run manually in Supabase SQL editor.
-- Idempotent — safe to re-run.
--
-- WHAT THIS FIXES:
--   Migration 003_lean_schema.sql dropped and recreated the contacts table
--   with different column names (company, inferred_email, source) compared to
--   the original schema (company_name, email, discovery_source, phone).
--   Migration 025 partially patched this but left these four columns missing.
--   This causes: "column contacts.email does not exist" on the dashboard.
-- ============================================================================

-- email — the primary email column used by v1/contacts GET/POST/PATCH/export
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email TEXT;

-- company_name — used by v1/contacts route and dashboard contacts page
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS company_name TEXT;

-- discovery_source — used by v1/contacts sort + search + contacts page display
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS discovery_source TEXT;
ALTER TABLE public.contacts ALTER COLUMN discovery_source SET DEFAULT 'manual';

-- phone — optional field accepted by v1/contacts POST/PATCH
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS phone TEXT;

-- ============================================================================
-- Back-fill: populate email from confirmed_email / inferred_email where missing
-- (so existing contacts created via the old extension flow remain usable)
-- ============================================================================
UPDATE public.contacts
SET email = COALESCE(confirmed_email, inferred_email)
WHERE email IS NULL
  AND (confirmed_email IS NOT NULL OR inferred_email IS NOT NULL);

-- Back-fill company_name from company where missing
UPDATE public.contacts
SET company_name = company
WHERE company_name IS NULL
  AND company IS NOT NULL;

-- Back-fill discovery_source from source where missing
UPDATE public.contacts
SET discovery_source = COALESCE(source, 'manual')
WHERE discovery_source IS NULL;

-- ============================================================================
-- Index: keep email lookups fast
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_contacts_email_v2
  ON public.contacts (user_id, email)
  WHERE email IS NOT NULL;
