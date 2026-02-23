-- ============================================================================
-- Enable Supabase Realtime for contacts table
-- ============================================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
