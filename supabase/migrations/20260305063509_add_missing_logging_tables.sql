-- Ensure logging infrastructure tables exist.
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- integration_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'info'
    CHECK (status IN ('info', 'success', 'warning', 'error')),
  message TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.integration_logs
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE public.integration_logs
  ALTER COLUMN provider SET DEFAULT '',
  ALTER COLUMN event_type SET DEFAULT '',
  ALTER COLUMN status SET DEFAULT 'info',
  ALTER COLUMN message SET DEFAULT '',
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE public.integration_logs
SET
  provider = COALESCE(provider, ''),
  event_type = COALESCE(event_type, ''),
  status = COALESCE(status, 'info'),
  message = COALESCE(message, ''),
  metadata = COALESCE(metadata, '{}'::jsonb),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  provider IS NULL
  OR event_type IS NULL
  OR status IS NULL
  OR message IS NULL
  OR metadata IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.integration_logs WHERE user_id IS NULL) THEN
    RAISE NOTICE 'integration_logs.user_id has NULL rows; leaving nullable until repaired.';
  ELSE
    ALTER TABLE public.integration_logs ALTER COLUMN user_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.integration_logs'::regclass
      AND conname = 'integration_logs_status_check'
  ) THEN
    ALTER TABLE public.integration_logs
      ADD CONSTRAINT integration_logs_status_check
      CHECK (status IN ('info', 'success', 'warning', 'error'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_integration_logs_user_created_at
  ON public.integration_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_status
  ON public.integration_logs(user_id, status);

ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  existing_policy RECORD;
BEGIN
  FOR existing_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'integration_logs'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.integration_logs;',
      existing_policy.policyname
    );
  END LOOP;

  CREATE POLICY integration_logs_owner_select
    ON public.integration_logs FOR SELECT
    USING (user_id = auth.uid());

  CREATE POLICY integration_logs_owner_insert
    ON public.integration_logs FOR INSERT
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY integration_logs_owner_update
    ON public.integration_logs FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY integration_logs_owner_delete
    ON public.integration_logs FOR DELETE
    USING (user_id = auth.uid());

  CREATE POLICY integration_logs_service_manage
    ON public.integration_logs FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
END $$;

DROP TRIGGER IF EXISTS update_integration_logs_updated_at ON public.integration_logs;
CREATE TRIGGER update_integration_logs_updated_at
  BEFORE UPDATE ON public.integration_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- notification_log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'in_app',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'failed', 'read')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS channel TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE public.notification_log
  ALTER COLUMN channel SET DEFAULT 'in_app',
  ALTER COLUMN title SET DEFAULT '',
  ALTER COLUMN body SET DEFAULT '',
  ALTER COLUMN status SET DEFAULT 'queued',
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE public.notification_log
SET
  channel = COALESCE(channel, 'in_app'),
  title = COALESCE(title, ''),
  body = COALESCE(body, ''),
  status = COALESCE(status, 'queued'),
  metadata = COALESCE(metadata, '{}'::jsonb),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  channel IS NULL
  OR title IS NULL
  OR body IS NULL
  OR status IS NULL
  OR metadata IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.notification_log WHERE user_id IS NULL) THEN
    RAISE NOTICE 'notification_log.user_id has NULL rows; leaving nullable until repaired.';
  ELSE
    ALTER TABLE public.notification_log ALTER COLUMN user_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.notification_log'::regclass
      AND conname = 'notification_log_status_check'
  ) THEN
    ALTER TABLE public.notification_log
      ADD CONSTRAINT notification_log_status_check
      CHECK (status IN ('queued', 'sent', 'failed', 'read'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notification_log_user_created_at
  ON public.notification_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_status
  ON public.notification_log(user_id, status);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  existing_policy RECORD;
BEGIN
  FOR existing_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_log'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.notification_log;',
      existing_policy.policyname
    );
  END LOOP;

  CREATE POLICY notification_log_owner_select
    ON public.notification_log FOR SELECT
    USING (user_id = auth.uid());

  CREATE POLICY notification_log_owner_insert
    ON public.notification_log FOR INSERT
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY notification_log_owner_update
    ON public.notification_log FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY notification_log_owner_delete
    ON public.notification_log FOR DELETE
    USING (user_id = auth.uid());

  CREATE POLICY notification_log_service_manage
    ON public.notification_log FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
END $$;

DROP TRIGGER IF EXISTS update_notification_log_updated_at ON public.notification_log;
CREATE TRIGGER update_notification_log_updated_at
  BEFORE UPDATE ON public.notification_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
