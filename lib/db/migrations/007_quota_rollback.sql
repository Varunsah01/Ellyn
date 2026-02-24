-- Migration 007: Add rollback_email_quota function
-- Used to decrement email_lookups_used when pipeline completes with no result found
-- (no_mx or undeliverable), so user is not charged for failed lookups.

CREATE OR REPLACE FUNCTION public.rollback_email_quota(p_user_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE user_quotas
  SET email_lookups_used = GREATEST(0, email_lookups_used - 1),
      updated_at = NOW()
  WHERE user_id = p_user_id;
$$;

-- Grant execute to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.rollback_email_quota(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_email_quota(UUID) TO service_role;
