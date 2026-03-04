-- Migration 031: Outlook / Microsoft OAuth credentials
CREATE TABLE IF NOT EXISTS public.outlook_credentials (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token        TEXT NOT NULL,
  refresh_token       TEXT,
  outlook_email       TEXT,
  token_expires_at    TIMESTAMPTZ,
  encrypted_version   INT DEFAULT 1,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE public.outlook_credentials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'outlook_credentials'
      AND policyname = 'outlook_credentials_owner_all'
  ) THEN
    CREATE POLICY outlook_credentials_owner_all
      ON public.outlook_credentials FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'outlook_credentials'
      AND policyname = 'outlook_credentials_service_manage'
  ) THEN
    CREATE POLICY outlook_credentials_service_manage
      ON public.outlook_credentials FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_outlook_credentials_user_id
  ON public.outlook_credentials (user_id);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_outlook_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_outlook_credentials_updated_at ON public.outlook_credentials;
CREATE TRIGGER trg_outlook_credentials_updated_at
  BEFORE UPDATE ON public.outlook_credentials
  FOR EACH ROW EXECUTE FUNCTION update_outlook_credentials_updated_at();
