-- Migration 030: Sequence Performance Stats Function
-- Description: Creates/replaces get_sequence_performance_stats() to query
--              email_tracking_events for accurate per-sequence analytics.
-- Dependencies: 012_email_tracking, 019_sequences_complete, 028_migration_tracking
-- Idempotent: Yes (CREATE OR REPLACE)

-- ============================================================================
-- PRE-FLIGHT CHECK: Verify this migration hasn't already been applied
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.schema_migrations WHERE version = '030'
  ) THEN
    RAISE NOTICE 'Migration 030 already applied, skipping.';
    RETURN;
  END IF;
END $$;

-- ============================================================================
-- MIGRATION BODY
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_sequence_performance_stats(
  p_user_id UUID
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  status TEXT,
  total_enrolled BIGINT,
  sent_count BIGINT,
  opened_count BIGINT,
  replied_count BIGINT,
  bounced_count BIGINT,
  reply_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.status,
    (SELECT COUNT(*) FROM sequence_enrollments se
     WHERE se.sequence_id = s.id AND se.user_id = p_user_id) AS total_enrolled,
    (SELECT COUNT(*) FROM email_tracking_events ete
     WHERE ete.sequence_id = s.id AND ete.user_id = p_user_id
       AND ete.event_type = 'sent') AS sent_count,
    (SELECT COUNT(*) FROM email_tracking_events ete
     WHERE ete.sequence_id = s.id AND ete.user_id = p_user_id
       AND ete.event_type = 'opened') AS opened_count,
    (SELECT COUNT(*) FROM email_tracking_events ete
     WHERE ete.sequence_id = s.id AND ete.user_id = p_user_id
       AND ete.event_type = 'replied') AS replied_count,
    (SELECT COUNT(*) FROM email_tracking_events ete
     WHERE ete.sequence_id = s.id AND ete.user_id = p_user_id
       AND ete.event_type = 'bounced') AS bounced_count,
    CASE
      WHEN (SELECT COUNT(*) FROM email_tracking_events ete
            WHERE ete.sequence_id = s.id AND ete.user_id = p_user_id
              AND ete.event_type = 'sent') = 0 THEN 0
      ELSE ROUND(
        100.0 * (SELECT COUNT(*) FROM email_tracking_events ete
                 WHERE ete.sequence_id = s.id AND ete.user_id = p_user_id
                   AND ete.event_type = 'replied')
        / (SELECT COUNT(*) FROM email_tracking_events ete
           WHERE ete.sequence_id = s.id AND ete.user_id = p_user_id
             AND ete.event_type = 'sent'),
        1
      )
    END AS reply_rate
  FROM sequences s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_sequence_performance_stats(UUID) IS
  'Returns per-sequence analytics aggregated from email_tracking_events. '
  'Counts sent/opened/replied/bounced events and computes reply rate per sequence.';

-- ============================================================================
-- RECORD MIGRATION
-- ============================================================================
INSERT INTO public.schema_migrations (version, name)
VALUES ('030', 'sequence_performance_stats')
ON CONFLICT (version) DO NOTHING;
