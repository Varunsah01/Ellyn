-- =============================================================================
-- 036: Harden RLS on email_pattern_cache — remove open SELECT policy
--
-- PROBLEM:
--   The policy "Anyone can read pattern cache" (FOR SELECT USING (true)) lets
--   every authenticated user read the full table, allowing competitors to
--   harvest our entire learned email-pattern corpus.
--
-- ANALYSIS:
--   • email_pattern_cache has no user_id / created_by column — it is a shared
--     domain-level lookup table, not per-user data.
--   • All legitimate server-side reads use createServiceRoleClient(), which
--     bypasses RLS entirely. Removing the open SELECT policy breaks nothing.
--   • No API route or client-side hook queries this table directly.
--
-- FIX:
--   Drop the open SELECT policy. Only the service_role can now read or write,
--   which matches all actual access patterns in the codebase.
--
-- Safe to run multiple times (all operations are idempotent).
-- =============================================================================

-- Ensure RLS is enabled (no-op if already set)
ALTER TABLE public.email_pattern_cache ENABLE ROW LEVEL SECURITY;

-- Drop the vulnerable open-read policy
DROP POLICY IF EXISTS "Anyone can read pattern cache" ON public.email_pattern_cache;

-- Drop the existing service-role policy so we can recreate it cleanly
DROP POLICY IF EXISTS "Service role manages pattern cache" ON public.email_pattern_cache;

-- Recreate service_role full-access policy (only accessor the codebase uses)
CREATE POLICY "Service role manages pattern cache"
  ON public.email_pattern_cache
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Verify: at this point no policy grants authenticated or anon users any access.
-- Only connections presenting the service_role JWT can read or write this table.
