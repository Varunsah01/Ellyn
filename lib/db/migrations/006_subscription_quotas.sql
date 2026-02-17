-- Migration: Add AI draft quota column and helper function
-- Run manually in Supabase SQL editor

ALTER TABLE public.user_quotas
  ADD COLUMN IF NOT EXISTS ai_draft_generations_used INT NOT NULL DEFAULT 0
    CHECK (ai_draft_generations_used >= 0);

-- Function: check_and_increment_ai_draft
-- Checks if user can generate an AI draft, increments counter if allowed.
-- Free limit: 15 | Pro limit: 999999 (treated as unlimited in UI)
CREATE OR REPLACE FUNCTION public.check_and_increment_ai_draft(p_user_id UUID)
RETURNS TABLE (allowed BOOLEAN, remaining INTEGER, reset_date TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used       INT;
  v_limit      INT;
  v_reset_date TIMESTAMPTZ;
  v_plan_type  TEXT;
BEGIN
  -- Ensure quota row exists
  PERFORM public.ensure_user_quota(p_user_id);

  SELECT
    uq.ai_draft_generations_used,
    up.plan_type,
    uq.reset_date
  INTO v_used, v_plan_type, v_reset_date
  FROM public.user_quotas uq
  LEFT JOIN public.user_profiles up ON up.id = uq.user_id
  WHERE uq.user_id = p_user_id;

  -- Set limit based on plan
  v_limit := CASE WHEN v_plan_type = 'pro' THEN 999999 ELSE 15 END;

  IF v_used >= v_limit THEN
    RETURN QUERY SELECT FALSE, 0, v_reset_date;
    RETURN;
  END IF;

  -- Increment counter
  UPDATE public.user_quotas
  SET ai_draft_generations_used = ai_draft_generations_used + 1
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT TRUE, (v_limit - v_used - 1), v_reset_date;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_draft(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_draft(UUID) TO service_role;
