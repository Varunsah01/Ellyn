-- ============================================================================
-- Track Chrome extension heartbeat in user_profiles
-- ============================================================================

ALTER TABLE IF EXISTS public.user_profiles
ADD COLUMN IF NOT EXISTS extension_last_seen TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.extension_heartbeat(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.user_profiles
  SET extension_last_seen = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'timestamp', NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION public.extension_heartbeat(UUID) TO authenticated;
