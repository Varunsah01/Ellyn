-- Migration 021: Default stage seeding function
-- Run manually in Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.ensure_default_stages(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only seed if user has no stages yet
  IF (SELECT COUNT(*) FROM public.application_stages WHERE user_id = p_user_id) = 0 THEN
    INSERT INTO public.application_stages (user_id, name, color, position, is_default) VALUES
      (p_user_id, 'Researching',    '#6B7280', 0, true),
      (p_user_id, 'Contacted',      '#3B82F6', 1, true),
      (p_user_id, 'Replied',        '#8B5CF6', 2, true),
      (p_user_id, 'Interviewing',   '#F59E0B', 3, true),
      (p_user_id, 'Offer Received', '#10B981', 4, true),
      (p_user_id, 'Closed',         '#6B7280', 5, true);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_default_stages(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_default_stages(UUID) TO service_role;
