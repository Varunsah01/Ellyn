-- Track email opens and clicks (from tracking pixels and link wrapping)
CREATE TABLE IF NOT EXISTS public.email_tracking_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_id      UUID REFERENCES public.ai_drafts(id) ON DELETE SET NULL,
  contact_id    UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  sequence_id   UUID,
  event_type    TEXT NOT NULL CHECK (event_type IN ('sent', 'opened', 'clicked', 'replied', 'bounced')),
  metadata      JSONB DEFAULT '{}',
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_user_id ON public.email_tracking_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_draft_id ON public.email_tracking_events(draft_id);
CREATE INDEX IF NOT EXISTS idx_tracking_type ON public.email_tracking_events(event_type);

-- RLS
ALTER TABLE public.email_tracking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tracking events"
  ON public.email_tracking_events FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role manages tracking"
  ON public.email_tracking_events FOR ALL USING (auth.role() = 'service_role');
