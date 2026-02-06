-- Migration 004: Sequences & Enrollments

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Table: sequences
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  goal TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sequences_user_id ON sequences(user_id);
CREATE INDEX IF NOT EXISTS idx_sequences_status ON sequences(status);
CREATE INDEX IF NOT EXISTS idx_sequences_created_at ON sequences(created_at DESC);

ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sequences"
  ON sequences FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sequences"
  ON sequences FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sequences"
  ON sequences FOR UPDATE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Table: sequence_steps
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sequence_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  delay_days INTEGER DEFAULT 0,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  stop_on_reply BOOLEAN DEFAULT true,
  stop_on_bounce BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sequence_steps_sequence_id ON sequence_steps(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_steps_order ON sequence_steps(sequence_id, step_order);

ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sequence steps"
  ON sequence_steps FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM sequences WHERE sequences.id = sequence_steps.sequence_id)
  );

CREATE POLICY "Users can insert own sequence steps"
  ON sequence_steps FOR INSERT WITH CHECK (
    auth.uid() = (SELECT user_id FROM sequences WHERE sequences.id = sequence_steps.sequence_id)
  );

CREATE POLICY "Users can update own sequence steps"
  ON sequence_steps FOR UPDATE USING (
    auth.uid() = (SELECT user_id FROM sequences WHERE sequences.id = sequence_steps.sequence_id)
  );

-- ---------------------------------------------------------------------------
-- Table: sequence_enrollments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'replied', 'bounced', 'paused')),
  start_date TIMESTAMPTZ DEFAULT NOW(),
  current_step INTEGER DEFAULT 0,
  next_step_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_sequence_id ON sequence_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_contact_id ON sequence_enrollments(contact_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status ON sequence_enrollments(status);

ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own enrollments"
  ON sequence_enrollments FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM sequences WHERE sequences.id = sequence_enrollments.sequence_id)
  );

CREATE POLICY "Users can insert own enrollments"
  ON sequence_enrollments FOR INSERT WITH CHECK (
    auth.uid() = (SELECT user_id FROM sequences WHERE sequences.id = sequence_enrollments.sequence_id)
  );

CREATE POLICY "Users can update own enrollments"
  ON sequence_enrollments FOR UPDATE USING (
    auth.uid() = (SELECT user_id FROM sequences WHERE sequences.id = sequence_enrollments.sequence_id)
  );

-- ---------------------------------------------------------------------------
-- Table: sequence_enrollment_steps
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sequence_enrollment_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID NOT NULL REFERENCES sequence_enrollments(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES sequence_steps(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'bounced', 'replied')),
  subject_override TEXT,
  body_override TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sequence_enrollment_steps_enrollment_id ON sequence_enrollment_steps(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollment_steps_status ON sequence_enrollment_steps(status);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollment_steps_scheduled_for ON sequence_enrollment_steps(scheduled_for);

ALTER TABLE sequence_enrollment_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own enrollment steps"
  ON sequence_enrollment_steps FOR SELECT USING (
    auth.uid() = (
      SELECT user_id FROM sequences
      JOIN sequence_enrollments ON sequence_enrollments.sequence_id = sequences.id
      WHERE sequence_enrollments.id = sequence_enrollment_steps.enrollment_id
    )
  );

CREATE POLICY "Users can update own enrollment steps"
  ON sequence_enrollment_steps FOR UPDATE USING (
    auth.uid() = (
      SELECT user_id FROM sequences
      JOIN sequence_enrollments ON sequence_enrollments.sequence_id = sequences.id
      WHERE sequence_enrollments.id = sequence_enrollment_steps.enrollment_id
    )
  );

-- ---------------------------------------------------------------------------
-- Table: sequence_events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sequence_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID NOT NULL REFERENCES sequence_enrollments(id) ON DELETE CASCADE,
  step_id UUID REFERENCES sequence_steps(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'opened', 'replied', 'bounced', 'skipped', 'paused', 'resumed')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sequence_events_enrollment_id ON sequence_events(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_sequence_events_type ON sequence_events(event_type);

ALTER TABLE sequence_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sequence events"
  ON sequence_events FOR SELECT USING (
    auth.uid() = (
      SELECT user_id FROM sequences
      JOIN sequence_enrollments ON sequence_enrollments.sequence_id = sequences.id
      WHERE sequence_enrollments.id = sequence_events.enrollment_id
    )
  );

-- ---------------------------------------------------------------------------
-- Trigger: updated_at
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sequences_updated_at ON sequences;
CREATE TRIGGER update_sequences_updated_at
  BEFORE UPDATE ON sequences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sequence_steps_updated_at ON sequence_steps;
CREATE TRIGGER update_sequence_steps_updated_at
  BEFORE UPDATE ON sequence_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sequence_enrollments_updated_at ON sequence_enrollments;
CREATE TRIGGER update_sequence_enrollments_updated_at
  BEFORE UPDATE ON sequence_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sequence_enrollment_steps_updated_at ON sequence_enrollment_steps;
CREATE TRIGGER update_sequence_enrollment_steps_updated_at
  BEFORE UPDATE ON sequence_enrollment_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
