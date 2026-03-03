-- Migration NNN: [TITLE]
-- Description: [What this migration does]
-- Dependencies: [Which earlier migrations must exist]
-- Idempotent: Yes

-- ============================================================================
-- PRE-FLIGHT CHECK: Verify this migration hasn't already been applied
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.schema_migrations WHERE version = 'NNN'
  ) THEN
    RAISE NOTICE 'Migration NNN already applied, skipping.';
    RETURN;
  END IF;
END $$;

-- ============================================================================
-- MIGRATION BODY
-- ============================================================================

-- [Your SQL here]

-- ============================================================================
-- RECORD MIGRATION
-- ============================================================================
INSERT INTO public.schema_migrations (version, name)
VALUES ('NNN', '[short_name]')
ON CONFLICT (version) DO NOTHING;
