-- Migration 027: Gmail production-ready columns
-- Adds columns to gmail_credentials and email_history for production OAuth flow

-- 1. gmail_credentials: add email, expiry, version; make client_id/client_secret nullable
ALTER TABLE gmail_credentials
  ADD COLUMN IF NOT EXISTS gmail_email TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS encrypted_version INT DEFAULT 1;

ALTER TABLE gmail_credentials
  ALTER COLUMN client_id DROP NOT NULL,
  ALTER COLUMN client_secret DROP NOT NULL;

-- 2. email_history: add user_id, contact_id, from_email
ALTER TABLE email_history
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS contact_id UUID,
  ADD COLUMN IF NOT EXISTS from_email TEXT;

CREATE INDEX IF NOT EXISTS idx_email_history_user_id
  ON email_history (user_id, created_at DESC);

-- 3. RLS policy for email_history owner read
ALTER TABLE email_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'email_history' AND policyname = 'email_history_owner_read'
  ) THEN
    CREATE POLICY email_history_owner_read ON email_history
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Update status CHECK to include 'delivered', 'opened' if constraint exists
DO $$
BEGIN
  -- Drop existing constraint if it exists, then recreate with new values
  ALTER TABLE email_history DROP CONSTRAINT IF EXISTS email_history_status_check;
  ALTER TABLE email_history ADD CONSTRAINT email_history_status_check
    CHECK (status IN ('sent', 'failed', 'delivered', 'opened', 'bounced'));
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not update email_history status constraint: %', SQLERRM;
END $$;
