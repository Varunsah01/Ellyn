-- Migration 040: system_configs for runtime feature/config controls
-- Dependencies: 028_migration_tracking
-- Idempotent: yes

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.validate_system_config_value(
  p_key TEXT,
  p_value JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  arr_item JSONB;
  numeric_value NUMERIC;
BEGIN
  IF p_key = 'ai_fallback.deepseek_r1_enabled' THEN
    RETURN jsonb_typeof(p_value) = 'boolean';
  ELSIF p_key = 'lookup.radical_cost_efficiency_target' THEN
    IF jsonb_typeof(p_value) <> 'number' THEN
      RETURN FALSE;
    END IF;

    numeric_value := (p_value #>> '{}')::NUMERIC;
    RETURN numeric_value >= 0 AND numeric_value <= 1;
  ELSIF p_key = 'security.admin_ip_whitelist' THEN
    IF jsonb_typeof(p_value) = 'string' THEN
      RETURN LENGTH(BTRIM(p_value #>> '{}')) > 0;
    ELSIF jsonb_typeof(p_value) = 'array' THEN
      FOR arr_item IN SELECT value FROM jsonb_array_elements(p_value) LOOP
        IF jsonb_typeof(arr_item) <> 'string' OR LENGTH(BTRIM(arr_item #>> '{}')) = 0 THEN
          RETURN FALSE;
        END IF;
      END LOOP;
      RETURN TRUE;
    END IF;

    RETURN FALSE;
  END IF;

  -- Unknown keys currently rejected to keep config surface area explicit.
  RETURN FALSE;
END;
$$;

CREATE TABLE IF NOT EXISTS public.system_configs (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT system_configs_value_valid_chk CHECK (public.validate_system_config_value(key, value))
);

ALTER TABLE public.system_configs
  ADD COLUMN IF NOT EXISTS key TEXT,
  ADD COLUMN IF NOT EXISTS value JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE public.system_configs
  ALTER COLUMN value SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.system_configs'::regclass
      AND conname = 'system_configs_pkey'
  ) THEN
    ALTER TABLE public.system_configs
      ADD CONSTRAINT system_configs_pkey PRIMARY KEY (key);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.system_configs'::regclass
      AND conname = 'system_configs_created_by_fkey'
  ) THEN
    ALTER TABLE public.system_configs
      ADD CONSTRAINT system_configs_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.system_configs'::regclass
      AND conname = 'system_configs_updated_by_fkey'
  ) THEN
    ALTER TABLE public.system_configs
      ADD CONSTRAINT system_configs_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.system_configs'::regclass
      AND conname = 'system_configs_value_valid_chk'
  ) THEN
    ALTER TABLE public.system_configs
      ADD CONSTRAINT system_configs_value_valid_chk
      CHECK (public.validate_system_config_value(key, value));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_system_configs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_system_configs_set_updated_at ON public.system_configs;
CREATE TRIGGER trg_system_configs_set_updated_at
  BEFORE UPDATE ON public.system_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_system_configs_updated_at();

INSERT INTO public.system_configs (key, value)
VALUES
  ('ai_fallback.deepseek_r1_enabled', 'false'::jsonb),
  ('lookup.radical_cost_efficiency_target', '0.70'::jsonb),
  ('security.admin_ip_whitelist', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_configs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_only_system_configs ON public.system_configs;
CREATE POLICY service_role_only_system_configs
  ON public.system_configs
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

REVOKE ALL ON public.system_configs FROM anon, authenticated;

COMMENT ON TABLE public.system_configs IS
  'Runtime system configuration. RLS locked to service_role; all mutations should occur via trusted server-side API only.';
