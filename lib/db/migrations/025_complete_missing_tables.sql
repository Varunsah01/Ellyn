-- ============================================================================
-- Migration 025: Complete Missing Tables & Schema Gaps
-- ============================================================================
-- Run manually in Supabase SQL editor.
-- Idempotent — safe to re-run.
--
-- WHAT THIS FIXES:
--   1. contacts table — adds columns used by extension/batch/analytics routes
--      but absent from the 000 baseline (company, inferred_email, source, etc.)
--   2. Fixes contacts_status_check constraint — old values blocked extension sync
--   3. Adds UNIQUE index for upsert ON CONFLICT in batch/import routes
--   4. Creates 5 tables that code references but no migration ever created:
--        leads, gmail_credentials, email_history, drafts, outreach
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CONTACTS — add missing columns (idempotent)
-- ============================================================================

-- "company" column used by extension sync, batch import, analytics routes
-- (older v1/contacts routes use "company_name" — both now coexist)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS company TEXT;

-- full_name as stored generated column (needed by drafts foreign-key join)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.contacts
      ADD COLUMN full_name TEXT GENERATED ALWAYS AS (
        TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
      ) STORED;
  END IF;
END $$;

-- Email inference columns (used by extension, analytics, contacts route)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS inferred_email TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS confirmed_email TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS inference_pattern TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3, 2);

-- email_confidence on 0–100 scale (used for filtering/sorting in /api/contacts)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email_confidence DECIMAL(5, 2);
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- LinkedIn enrichment columns (extension sync)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS linkedin_headline TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS linkedin_photo_url TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS company_domain TEXT;

-- source column (analytics uses .in('source', [...]))
-- Values expected: 'manual' | 'extension' | 'csv_import'
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- outreach tracking (tracker analytics reads last_contacted_at)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;

-- tags and custom_fields (already in 000 via ADD COLUMN IF NOT EXISTS but guard again)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- location (used in 001 schema)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS location TEXT;

-- ============================================================================
-- 2. FIX contacts_status_check CONSTRAINT
-- ============================================================================
-- The 000 migration constrains status to ('discovered','sent','bounced','replied').
-- Extension sync inserts status='new'; batch routes set 'contacted'/'no_response'.
-- Drop the old constraint and replace with one that allows all values.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.contacts'::regclass
      AND conname = 'contacts_status_check'
  ) THEN
    ALTER TABLE public.contacts DROP CONSTRAINT contacts_status_check;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.contacts'::regclass
      AND conname = 'contacts_status_check_v2'
  ) THEN
    ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_status_check_v2
      CHECK (status IN (
        'new', 'contacted', 'replied', 'no_response',   -- current schema
        'discovered', 'sent', 'bounced'                 -- legacy v1 schema
      ));
  END IF;
END $$;

-- Back-fill status NULLs so constraint passes
UPDATE public.contacts SET status = 'new' WHERE status IS NULL;

-- ============================================================================
-- 3. UNIQUE INDEX on contacts for upsert ON CONFLICT
-- ============================================================================
-- Required by batch import (/api/v1/contacts/batch) and CSV import routes:
--   onConflict: "user_id,first_name,last_name,company"

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_upsert_key
  ON public.contacts (user_id, first_name, last_name, company)
  WHERE company IS NOT NULL;

-- ============================================================================
-- 4. CREATE MISSING TABLES
-- ============================================================================

-- ── 4a. leads ────────────────────────────────────────────────────────────────
-- Used by /api/leads/ routes and /api/gmail/send (updates lead status)

CREATE TABLE IF NOT EXISTS public.leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_name       TEXT NOT NULL,
  company_name      TEXT,
  discovered_emails JSONB DEFAULT '[]'::jsonb,
  selected_email    TEXT,
  status            TEXT DEFAULT 'discovered'
                    CHECK (status IN ('discovered', 'contacted', 'sent', 'replied', 'bounced')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'leads' AND policyname = 'leads_owner_all'
  ) THEN
    CREATE POLICY leads_owner_all
      ON public.leads FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_user_id
  ON public.leads (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_status
  ON public.leads (user_id, status);

-- ── 4b. gmail_credentials ────────────────────────────────────────────────────
-- Used by /api/gmail/oauth and /api/gmail/send for OAuth token storage

CREATE TABLE IF NOT EXISTS public.gmail_credentials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id     TEXT,
  client_secret TEXT,
  access_token  TEXT,
  refresh_token TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE public.gmail_credentials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gmail_credentials' AND policyname = 'gmail_credentials_owner_all'
  ) THEN
    CREATE POLICY gmail_credentials_owner_all
      ON public.gmail_credentials FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  -- Service role can manage credentials (for OAuth callback)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gmail_credentials' AND policyname = 'gmail_credentials_service_manage'
  ) THEN
    CREATE POLICY gmail_credentials_service_manage
      ON public.gmail_credentials FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ── 4c. email_history ────────────────────────────────────────────────────────
-- Used by /api/gmail/send to log sent emails

CREATE TABLE IF NOT EXISTS public.email_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  to_email        TEXT,
  subject         TEXT,
  body            TEXT,
  gmail_message_id TEXT,
  status          TEXT DEFAULT 'sent'
                  CHECK (status IN ('sent', 'failed', 'bounced')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
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

-- ── 4d. drafts ───────────────────────────────────────────────────────────────
-- Used by /api/drafts/ (separate from ai_drafts)
-- Query: .select('*, contacts(full_name, confirmed_email, inferred_email)')

CREATE TABLE IF NOT EXISTS public.drafts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id  UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  subject     TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  status      TEXT DEFAULT 'draft'
              CHECK (status IN ('draft', 'sent', 'archived')),
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'drafts' AND policyname = 'drafts_owner_all'
  ) THEN
    CREATE POLICY drafts_owner_all
      ON public.drafts FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_drafts_user_updated_at
  ON public.drafts (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_drafts_contact_id
  ON public.drafts (contact_id);

CREATE INDEX IF NOT EXISTS idx_drafts_status
  ON public.drafts (user_id, status);

-- ── 4e. outreach ─────────────────────────────────────────────────────────────
-- Used by /api/analytics/, /api/contacts/ (for outreach enrichment)
-- Tracks email sends per contact per sequence

CREATE TABLE IF NOT EXISTS public.outreach (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id  UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  sequence_id UUID REFERENCES public.sequences(id) ON DELETE SET NULL,
  status      TEXT DEFAULT 'sent'
              CHECK (status IN ('sent', 'opened', 'clicked', 'replied', 'bounced')),
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.outreach ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'outreach' AND policyname = 'outreach_owner_all'
  ) THEN
    CREATE POLICY outreach_owner_all
      ON public.outreach FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'outreach' AND policyname = 'outreach_service_manage'
  ) THEN
    CREATE POLICY outreach_service_manage
      ON public.outreach FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_outreach_user_sent_at
  ON public.outreach (user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_outreach_contact_id
  ON public.outreach (contact_id);

CREATE INDEX IF NOT EXISTS idx_outreach_sequence_id
  ON public.outreach (sequence_id);

CREATE INDEX IF NOT EXISTS idx_outreach_user_contact
  ON public.outreach (user_id, contact_id, updated_at DESC);

-- ============================================================================
-- 5. ADDITIONAL CONTACTS INDEXES (for new columns)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_contacts_inferred_email
  ON public.contacts (user_id, inferred_email)
  WHERE inferred_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_email_confidence
  ON public.contacts (user_id, email_confidence DESC)
  WHERE email_confidence IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_source
  ON public.contacts (user_id, source);

-- ============================================================================
-- 6. ENSURE uuid-ossp extension for migrations that use uuid_generate_v4()
-- ============================================================================

-- Already created at top of this migration. This comment is a reminder that
-- migrations 014, 012, 013, 015 use uuid_generate_v4() — ensure the extension
-- is enabled before running those migrations.

-- ============================================================================
-- VERIFICATION QUERIES (uncomment to check after running)
-- ============================================================================

-- Check new tables exist:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN ('leads','gmail_credentials','email_history','drafts','outreach')
-- ORDER BY table_name;

-- Check contacts new columns:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'contacts'
--   AND column_name IN (
--     'company','full_name','inferred_email','confirmed_email',
--     'source','email_confidence','email_verified','company_domain',
--     'lead_score_cache','last_contacted_at'
--   )
-- ORDER BY column_name;

-- Check status constraint was updated:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.contacts'::regclass AND contype = 'c';
