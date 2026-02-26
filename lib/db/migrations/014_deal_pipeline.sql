-- 014_deal_pipeline.sql
-- B2B deal pipeline for SMB sales persona

CREATE TABLE IF NOT EXISTS public.deals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  company         TEXT NOT NULL,
  value           DECIMAL(12, 2),
  currency        TEXT NOT NULL DEFAULT 'USD',
  stage           TEXT NOT NULL DEFAULT 'prospecting'
                    CHECK (stage IN ('prospecting','contacted','interested','meeting','proposal','won','lost')),
  probability     INTEGER DEFAULT 50 CHECK (probability BETWEEN 0 AND 100),
  expected_close  DATE,
  lost_reason     TEXT,
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deals_user_id ON public.deals(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage    ON public.deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_user_stage ON public.deals(user_id, stage);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'deals' AND policyname = 'Users manage own deals'
  ) THEN
    CREATE POLICY "Users manage own deals"
      ON public.deals FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

-- Reuse the generic updated_at trigger if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE TRIGGER trg_deals_updated_at
      BEFORE UPDATE ON public.deals
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;
