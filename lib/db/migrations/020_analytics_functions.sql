CREATE OR REPLACE FUNCTION public.get_tracking_stats(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_since  TIMESTAMPTZ := NOW() - (GREATEST(1, LEAST(p_days, 365)) || ' days')::INTERVAL;
BEGIN
  SELECT jsonb_build_object(
    'total_sent',    COUNT(*) FILTER (WHERE event_type = 'sent'),
    'total_opened',  COUNT(*) FILTER (WHERE event_type = 'opened'),
    'total_clicked', COUNT(*) FILTER (WHERE event_type = 'clicked'),
    'total_replied', COUNT(*) FILTER (WHERE event_type = 'replied'),
    'total_bounced', COUNT(*) FILTER (WHERE event_type = 'bounced'),
    'open_rate',     CASE WHEN COUNT(*) FILTER (WHERE event_type = 'sent') = 0 THEN 0
                     ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE event_type = 'opened')
                          / COUNT(*) FILTER (WHERE event_type = 'sent'), 1) END,
    'reply_rate',    CASE WHEN COUNT(*) FILTER (WHERE event_type = 'sent') = 0 THEN 0
                     ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE event_type = 'replied')
                          / COUNT(*) FILTER (WHERE event_type = 'sent'), 1) END
  ) INTO v_result
  FROM public.email_tracking_events
  WHERE user_id = p_user_id AND occurred_at >= v_since;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_activity_heatmap(
  p_user_id UUID,
  p_days INTEGER DEFAULT 90
)
RETURNS TABLE(day_of_week INTEGER, hour_of_day INTEGER, event_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(DOW FROM occurred_at)::INTEGER AS day_of_week,
    EXTRACT(HOUR FROM occurred_at)::INTEGER AS hour_of_day,
    COUNT(*) AS event_count
  FROM public.email_tracking_events
  WHERE user_id = p_user_id
    AND occurred_at >= NOW() - (GREATEST(1, LEAST(p_days, 365)) || ' days')::INTERVAL
    AND event_type = 'sent'
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

CREATE OR REPLACE FUNCTION public.get_contact_growth(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE(date DATE, new_contacts BIGINT, cumulative BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH daily AS (
    SELECT DATE(created_at) AS date, COUNT(*) AS cnt
    FROM public.contacts
    WHERE user_id = p_user_id
      AND created_at >= NOW() - (GREATEST(1, LEAST(p_days, 365)) || ' days')::INTERVAL
    GROUP BY 1
  )
  SELECT
    date,
    cnt AS new_contacts,
    SUM(cnt) OVER (ORDER BY date) AS cumulative
  FROM daily
  ORDER BY date;
$$;

CREATE OR REPLACE FUNCTION public.get_sequence_performance_stats(
  p_user_id UUID
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  status TEXT,
  total_enrolled BIGINT,
  replied_count BIGINT,
  reply_rate NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.name,
    s.status,
    COUNT(e.id) AS total_enrolled,
    COUNT(e.id) FILTER (WHERE e.status = 'replied') AS replied_count,
    CASE WHEN COUNT(e.id) = 0 THEN 0
      ELSE ROUND(100.0 * COUNT(e.id) FILTER (WHERE e.status = 'replied') / COUNT(e.id), 1)
    END AS reply_rate
  FROM public.sequences s
  LEFT JOIN public.sequence_enrollments e
    ON e.sequence_id = s.id AND e.user_id = p_user_id
  WHERE s.user_id = p_user_id
  GROUP BY s.id, s.name, s.status
  ORDER BY reply_rate DESC;
$$;
