-- ============================================================================
-- Migration 000: Ensure Complete Foundation (Idempotent)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- ============================================================================
-- Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'starter', 'pro')),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'past_due', 'cancelled', 'paused')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  dodo_product_id TEXT,
  extension_last_seen TIMESTAMPTZ,
  persona TEXT DEFAULT 'job_seeker' CHECK (persona IN ('job_seeker', 'smb_sales')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS plan_type TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS dodo_product_id TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS extension_last_seen TIMESTAMPTZ;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS persona TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.user_profiles ALTER COLUMN plan_type SET DEFAULT 'free';
ALTER TABLE public.user_profiles ALTER COLUMN subscription_status SET DEFAULT 'active';
ALTER TABLE public.user_profiles ALTER COLUMN persona SET DEFAULT 'job_seeker';
ALTER TABLE public.user_profiles ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE public.user_profiles ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE public.user_profiles
SET plan_type = 'free'
WHERE plan_type IS NULL
   OR plan_type NOT IN ('free', 'starter', 'pro');

UPDATE public.user_profiles
SET subscription_status = 'active'
WHERE subscription_status IS NULL
   OR subscription_status NOT IN ('active', 'past_due', 'cancelled', 'paused');

UPDATE public.user_profiles
SET persona = 'job_seeker'
WHERE persona IS NULL
   OR persona NOT IN ('job_seeker', 'smb_sales');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.user_profiles'::regclass
      AND conname = 'user_profiles_plan_type_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_plan_type_check
      CHECK (plan_type IN ('free', 'starter', 'pro'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.user_profiles'::regclass
      AND conname = 'user_profiles_subscription_status_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_subscription_status_check
      CHECK (subscription_status IN ('active', 'past_due', 'cancelled', 'paused'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.user_profiles'::regclass
      AND conname = 'user_profiles_persona_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_persona_check
      CHECK (persona IN ('job_seeker', 'smb_sales'));
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.user_quotas (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_lookups_used INT DEFAULT 0,
  email_lookups_limit INT DEFAULT 50,
  ai_draft_generations_used INT DEFAULT 0,
  ai_draft_generations_limit INT DEFAULT 0,
  period_start TIMESTAMPTZ DEFAULT NOW(),
  period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 month'),
  reset_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 month')
);

ALTER TABLE public.user_quotas ADD COLUMN IF NOT EXISTS email_lookups_used INT;
ALTER TABLE public.user_quotas ADD COLUMN IF NOT EXISTS email_lookups_limit INT;
ALTER TABLE public.user_quotas ADD COLUMN IF NOT EXISTS ai_draft_generations_used INT;
ALTER TABLE public.user_quotas ADD COLUMN IF NOT EXISTS ai_draft_generations_limit INT;
ALTER TABLE public.user_quotas ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ;
ALTER TABLE public.user_quotas ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ;
ALTER TABLE public.user_quotas ADD COLUMN IF NOT EXISTS reset_date TIMESTAMPTZ;
ALTER TABLE public.user_quotas ALTER COLUMN email_lookups_used SET DEFAULT 0;
ALTER TABLE public.user_quotas ALTER COLUMN email_lookups_limit SET DEFAULT 50;
ALTER TABLE public.user_quotas ALTER COLUMN ai_draft_generations_used SET DEFAULT 0;
ALTER TABLE public.user_quotas ALTER COLUMN ai_draft_generations_limit SET DEFAULT 0;
ALTER TABLE public.user_quotas ALTER COLUMN period_start SET DEFAULT NOW();
ALTER TABLE public.user_quotas ALTER COLUMN period_end SET DEFAULT (NOW() + INTERVAL '1 month');
ALTER TABLE public.user_quotas ALTER COLUMN reset_date SET DEFAULT (NOW() + INTERVAL '1 month');

UPDATE public.user_quotas
SET email_lookups_used = COALESCE(email_lookups_used, 0),
    email_lookups_limit = COALESCE(email_lookups_limit, 50),
    ai_draft_generations_used = COALESCE(ai_draft_generations_used, 0),
    ai_draft_generations_limit = COALESCE(ai_draft_generations_limit, 0),
    period_start = COALESCE(period_start, NOW()),
    period_end = COALESCE(period_end, NOW() + INTERVAL '1 month'),
    reset_date = COALESCE(reset_date, NOW() + INTERVAL '1 month');

CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  company_name TEXT,
  role TEXT,
  linkedin_url TEXT,
  phone TEXT,
  discovery_source TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'discovered' CHECK (status IN ('discovered', 'sent', 'bounced', 'replied')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS discovery_source TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.contacts ALTER COLUMN discovery_source SET DEFAULT 'manual';
ALTER TABLE public.contacts ALTER COLUMN status SET DEFAULT 'discovered';
ALTER TABLE public.contacts ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE public.contacts ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE public.contacts
SET status = 'discovered'
WHERE status IS NULL
   OR status NOT IN ('discovered', 'sent', 'bounced', 'replied');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.contacts'::regclass
      AND conname = 'contacts_status_check'
  ) THEN
    ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_status_check
      CHECK (status IN ('discovered', 'sent', 'bounced', 'replied'));
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  tone TEXT DEFAULT 'professional' CHECK (tone IN ('professional', 'casual', 'friendly', 'confident', 'humble')),
  is_ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS tone TEXT;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.email_templates ALTER COLUMN subject SET DEFAULT '';
ALTER TABLE public.email_templates ALTER COLUMN body SET DEFAULT '';
ALTER TABLE public.email_templates ALTER COLUMN tone SET DEFAULT 'professional';
ALTER TABLE public.email_templates ALTER COLUMN is_ai_generated SET DEFAULT false;
ALTER TABLE public.email_templates ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE public.email_templates ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE public.email_templates
SET tone = 'professional'
WHERE tone IS NULL
   OR tone NOT IN ('professional', 'casual', 'friendly', 'confident', 'humble');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.email_templates'::regclass
      AND conname = 'email_templates_tone_check'
  ) THEN
    ALTER TABLE public.email_templates
      ADD CONSTRAINT email_templates_tone_check
      CHECK (tone IN ('professional', 'casual', 'friendly', 'confident', 'humble'));
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.sequences ALTER COLUMN description SET DEFAULT '';
ALTER TABLE public.sequences ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE public.sequences ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE public.sequences ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE public.sequences
SET status = 'draft'
WHERE status IS NULL
   OR status NOT IN ('draft', 'active', 'paused', 'archived');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.sequences'::regclass
      AND conname = 'sequences_status_check'
  ) THEN
    ALTER TABLE public.sequences
      ADD CONSTRAINT sequences_status_check
      CHECK (status IN ('draft', 'active', 'paused', 'archived'));
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
  step_order INT NOT NULL DEFAULT 0,
  step_name TEXT DEFAULT '',
  step_type TEXT DEFAULT 'email' CHECK (step_type IN ('email', 'wait', 'condition', 'task')),
  subject TEXT DEFAULT '',
  body TEXT DEFAULT '',
  delay_days INT DEFAULT 1,
  send_on_days JSONB DEFAULT '[1,2,3,4,5]'::jsonb,
  send_from_hour INT DEFAULT 9,
  send_to_hour INT DEFAULT 17,
  condition_type TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS sequence_id UUID;
ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS step_order INT;
ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS step_name TEXT;
ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS step_type TEXT;
ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS delay_days INT;
ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS send_on_days JSONB;
ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS send_from_hour INT;
ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS send_to_hour INT;
ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS condition_type TEXT;
ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS attachments JSONB;
ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE public.sequence_steps ALTER COLUMN step_order SET DEFAULT 0;
ALTER TABLE public.sequence_steps ALTER COLUMN step_name SET DEFAULT '';
ALTER TABLE public.sequence_steps ALTER COLUMN step_type SET DEFAULT 'email';
ALTER TABLE public.sequence_steps ALTER COLUMN subject SET DEFAULT '';
ALTER TABLE public.sequence_steps ALTER COLUMN body SET DEFAULT '';
ALTER TABLE public.sequence_steps ALTER COLUMN delay_days SET DEFAULT 1;
ALTER TABLE public.sequence_steps ALTER COLUMN send_on_days SET DEFAULT '[1,2,3,4,5]'::jsonb;
ALTER TABLE public.sequence_steps ALTER COLUMN send_from_hour SET DEFAULT 9;
ALTER TABLE public.sequence_steps ALTER COLUMN send_to_hour SET DEFAULT 17;
ALTER TABLE public.sequence_steps ALTER COLUMN attachments SET DEFAULT '[]'::jsonb;
ALTER TABLE public.sequence_steps ALTER COLUMN created_at SET DEFAULT NOW();

UPDATE public.sequence_steps
SET step_type = 'email'
WHERE step_type IS NULL
   OR step_type NOT IN ('email', 'wait', 'condition', 'task');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.sequence_steps'::regclass
      AND conname = 'sequence_steps_step_type_check'
  ) THEN
    ALTER TABLE public.sequence_steps
      ADD CONSTRAINT sequence_steps_step_type_check
      CHECK (step_type IN ('email', 'wait', 'condition', 'task'));
  END IF;
END;
$$;
CREATE TABLE IF NOT EXISTS public.sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'bounced')),
  current_step_index INT DEFAULT 0,
  next_step_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (sequence_id, contact_id)
);

ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS sequence_id UUID;
ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS contact_id UUID;
ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS current_step_index INT;
ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS next_step_at TIMESTAMPTZ;
ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.sequence_enrollments ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE public.sequence_enrollments ALTER COLUMN current_step_index SET DEFAULT 0;
ALTER TABLE public.sequence_enrollments ALTER COLUMN next_step_at SET DEFAULT NOW();
ALTER TABLE public.sequence_enrollments ALTER COLUMN started_at SET DEFAULT NOW();

UPDATE public.sequence_enrollments
SET status = 'active'
WHERE status IS NULL
   OR status NOT IN ('active', 'paused', 'completed', 'bounced');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.sequence_enrollments'::regclass
      AND conname = 'sequence_enrollments_status_check'
  ) THEN
    ALTER TABLE public.sequence_enrollments
      ADD CONSTRAINT sequence_enrollments_status_check
      CHECK (status IN ('active', 'paused', 'completed', 'bounced'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.sequence_enrollments'::regclass
      AND conname = 'sequence_enrollments_sequence_id_contact_id_key'
  ) THEN
    ALTER TABLE public.sequence_enrollments
      ADD CONSTRAINT sequence_enrollments_sequence_id_contact_id_key
      UNIQUE (sequence_id, contact_id);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.sequence_enrollment_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.sequence_enrollments(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.sequence_steps(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'bounced')),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  skipped_at TIMESTAMPTZ
);

ALTER TABLE public.sequence_enrollment_steps ADD COLUMN IF NOT EXISTS enrollment_id UUID;
ALTER TABLE public.sequence_enrollment_steps ADD COLUMN IF NOT EXISTS step_id UUID;
ALTER TABLE public.sequence_enrollment_steps ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.sequence_enrollment_steps ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE public.sequence_enrollment_steps ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE public.sequence_enrollment_steps ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;
ALTER TABLE public.sequence_enrollment_steps ADD COLUMN IF NOT EXISTS skipped_at TIMESTAMPTZ;
ALTER TABLE public.sequence_enrollment_steps ALTER COLUMN status SET DEFAULT 'pending';

UPDATE public.sequence_enrollment_steps
SET status = 'pending'
WHERE status IS NULL
   OR status NOT IN ('pending', 'sent', 'skipped', 'bounced');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.sequence_enrollment_steps'::regclass
      AND conname = 'sequence_enrollment_steps_status_check'
  ) THEN
    ALTER TABLE public.sequence_enrollment_steps
      ADD CONSTRAINT sequence_enrollment_steps_status_check
      CHECK (status IN ('pending', 'sent', 'skipped', 'bounced'));
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.domain_cache (
  company_name TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  mx_records JSONB DEFAULT '[]'::jsonb,
  last_verified TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.domain_cache ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE public.domain_cache ADD COLUMN IF NOT EXISTS mx_records JSONB;
ALTER TABLE public.domain_cache ADD COLUMN IF NOT EXISTS last_verified TIMESTAMPTZ;
ALTER TABLE public.domain_cache ALTER COLUMN mx_records SET DEFAULT '[]'::jsonb;
ALTER TABLE public.domain_cache ALTER COLUMN last_verified SET DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.pattern_learning (
  domain TEXT NOT NULL,
  pattern TEXT NOT NULL,
  success_count INT DEFAULT 0,
  total_attempts INT DEFAULT 1,
  success_rate FLOAT DEFAULT 0.0,
  is_primary BOOLEAN DEFAULT false,
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (domain, pattern)
);

ALTER TABLE public.pattern_learning ADD COLUMN IF NOT EXISTS success_count INT;
ALTER TABLE public.pattern_learning ADD COLUMN IF NOT EXISTS total_attempts INT;
ALTER TABLE public.pattern_learning ADD COLUMN IF NOT EXISTS success_rate FLOAT;
ALTER TABLE public.pattern_learning ADD COLUMN IF NOT EXISTS is_primary BOOLEAN;
ALTER TABLE public.pattern_learning ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;
ALTER TABLE public.pattern_learning ALTER COLUMN success_count SET DEFAULT 0;
ALTER TABLE public.pattern_learning ALTER COLUMN total_attempts SET DEFAULT 1;
ALTER TABLE public.pattern_learning ALTER COLUMN success_rate SET DEFAULT 0.0;
ALTER TABLE public.pattern_learning ALTER COLUMN is_primary SET DEFAULT false;
ALTER TABLE public.pattern_learning ALTER COLUMN last_verified_at SET DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.domain_resolution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_name TEXT,
  domain TEXT,
  layers_attempted JSONB DEFAULT '[]'::jsonb,
  resolution_source TEXT,
  confidence_score INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.domain_resolution_logs ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.domain_resolution_logs ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.domain_resolution_logs ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE public.domain_resolution_logs ADD COLUMN IF NOT EXISTS layers_attempted JSONB;
ALTER TABLE public.domain_resolution_logs ADD COLUMN IF NOT EXISTS resolution_source TEXT;
ALTER TABLE public.domain_resolution_logs ADD COLUMN IF NOT EXISTS confidence_score INT;
ALTER TABLE public.domain_resolution_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE public.domain_resolution_logs ALTER COLUMN layers_attempted SET DEFAULT '[]'::jsonb;
ALTER TABLE public.domain_resolution_logs ALTER COLUMN confidence_score SET DEFAULT 0;
ALTER TABLE public.domain_resolution_logs ALTER COLUMN created_at SET DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.dodo_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dodo_webhook_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE public.dodo_webhook_events ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.dodo_webhook_events ADD COLUMN IF NOT EXISTS raw_payload JSONB;
ALTER TABLE public.dodo_webhook_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE public.dodo_webhook_events ALTER COLUMN raw_payload SET DEFAULT '{}'::jsonb;
ALTER TABLE public.dodo_webhook_events ALTER COLUMN processed_at SET DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE public.activity_log ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
ALTER TABLE public.activity_log ALTER COLUMN created_at SET DEFAULT NOW();

-- Ensure key FK constraints exist when the table already existed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contacts_user_id_fkey'
      AND conrelid = 'public.contacts'::regclass
  ) THEN
    ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_templates_user_id_fkey'
      AND conrelid = 'public.email_templates'::regclass
  ) THEN
    ALTER TABLE public.email_templates
      ADD CONSTRAINT email_templates_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sequences_user_id_fkey'
      AND conrelid = 'public.sequences'::regclass
  ) THEN
    ALTER TABLE public.sequences
      ADD CONSTRAINT sequences_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sequence_steps_sequence_id_fkey'
      AND conrelid = 'public.sequence_steps'::regclass
  ) THEN
    ALTER TABLE public.sequence_steps
      ADD CONSTRAINT sequence_steps_sequence_id_fkey
      FOREIGN KEY (sequence_id) REFERENCES public.sequences(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sequence_enrollments_sequence_id_fkey'
      AND conrelid = 'public.sequence_enrollments'::regclass
  ) THEN
    ALTER TABLE public.sequence_enrollments
      ADD CONSTRAINT sequence_enrollments_sequence_id_fkey
      FOREIGN KEY (sequence_id) REFERENCES public.sequences(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sequence_enrollments_contact_id_fkey'
      AND conrelid = 'public.sequence_enrollments'::regclass
  ) THEN
    ALTER TABLE public.sequence_enrollments
      ADD CONSTRAINT sequence_enrollments_contact_id_fkey
      FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sequence_enrollment_steps_enrollment_id_fkey'
      AND conrelid = 'public.sequence_enrollment_steps'::regclass
  ) THEN
    ALTER TABLE public.sequence_enrollment_steps
      ADD CONSTRAINT sequence_enrollment_steps_enrollment_id_fkey
      FOREIGN KEY (enrollment_id) REFERENCES public.sequence_enrollments(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sequence_enrollment_steps_step_id_fkey'
      AND conrelid = 'public.sequence_enrollment_steps'::regclass
  ) THEN
    ALTER TABLE public.sequence_enrollment_steps
      ADD CONSTRAINT sequence_enrollment_steps_step_id_fkey
      FOREIGN KEY (step_id) REFERENCES public.sequence_steps(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'domain_resolution_logs_user_id_fkey'
      AND conrelid = 'public.domain_resolution_logs'::regclass
  ) THEN
    ALTER TABLE public.domain_resolution_logs
      ADD CONSTRAINT domain_resolution_logs_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dodo_webhook_events_user_id_fkey'
      AND conrelid = 'public.dodo_webhook_events'::regclass
  ) THEN
    ALTER TABLE public.dodo_webhook_events
      ADD CONSTRAINT dodo_webhook_events_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'activity_log_user_id_fkey'
      AND conrelid = 'public.activity_log'::regclass
  ) THEN
    ALTER TABLE public.activity_log
      ADD CONSTRAINT activity_log_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END;
$$;
-- ============================================================================
-- RLS + Policies
-- ============================================================================

ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sequence_enrollment_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.domain_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pattern_learning ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.domain_resolution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dodo_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_log ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  target_table TEXT;
  existing_policy RECORD;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'user_profiles',
    'user_quotas',
    'contacts',
    'email_templates',
    'sequences',
    'sequence_steps',
    'sequence_enrollments',
    'sequence_enrollment_steps',
    'domain_cache',
    'pattern_learning',
    'domain_resolution_logs',
    'dodo_webhook_events',
    'activity_log'
  ]
  LOOP
    FOR existing_policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = target_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', existing_policy.policyname, target_table);
    END LOOP;
  END LOOP;
END;
$$;

CREATE POLICY user_profiles_owner_all
  ON public.user_profiles
  FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY user_quotas_owner_all
  ON public.user_quotas
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY contacts_owner_all
  ON public.contacts
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY email_templates_owner_all
  ON public.email_templates
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY sequences_owner_all
  ON public.sequences
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY sequence_steps_via_sequence_owner_all
  ON public.sequence_steps
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.sequences s
      WHERE s.id = sequence_steps.sequence_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sequences s
      WHERE s.id = sequence_steps.sequence_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY sequence_enrollments_via_sequence_owner_all
  ON public.sequence_enrollments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.sequences s
      WHERE s.id = sequence_enrollments.sequence_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sequences s
      WHERE s.id = sequence_enrollments.sequence_id
        AND s.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.contacts c
      WHERE c.id = sequence_enrollments.contact_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY sequence_enrollment_steps_via_enrollment_owner_all
  ON public.sequence_enrollment_steps
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.sequence_enrollments se
      JOIN public.sequences s ON s.id = se.sequence_id
      WHERE se.id = sequence_enrollment_steps.enrollment_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sequence_enrollments se
      JOIN public.sequences s ON s.id = se.sequence_id
      WHERE se.id = sequence_enrollment_steps.enrollment_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY domain_cache_public_read
  ON public.domain_cache
  FOR SELECT
  USING (TRUE);

CREATE POLICY domain_cache_service_manage
  ON public.domain_cache
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY pattern_learning_public_read
  ON public.pattern_learning
  FOR SELECT
  USING (TRUE);

CREATE POLICY pattern_learning_service_manage
  ON public.pattern_learning
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY domain_resolution_logs_owner_all
  ON public.domain_resolution_logs
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY dodo_webhook_events_owner_all
  ON public.dodo_webhook_events
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY activity_log_owner_all
  ON public.activity_log
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
-- ============================================================================
-- Functions + Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ensure_user_quota(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_quotas (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_quotas (user_id, email_lookups_limit, ai_draft_generations_limit)
  VALUES (NEW.id, 50, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.reset_expired_quotas()
RETURNS VOID AS $$
BEGIN
  UPDATE public.user_quotas
  SET
    email_lookups_used = 0,
    ai_draft_generations_used = 0,
    period_start = NOW(),
    period_end = NOW() + INTERVAL '1 month',
    reset_date = NOW() + INTERVAL '1 month'
  WHERE reset_date < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- Realtime (contacts)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'contacts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
  END IF;
END;
$$;

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_contacts_user_created_at
  ON public.contacts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contacts_user_status
  ON public.contacts (user_id, status);

CREATE INDEX IF NOT EXISTS idx_email_templates_user_id
  ON public.email_templates (user_id);

CREATE INDEX IF NOT EXISTS idx_sequences_user_id
  ON public.sequences (user_id);

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_sequence_id
  ON public.sequence_enrollments (sequence_id);

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_contact_id
  ON public.sequence_enrollments (contact_id);

CREATE INDEX IF NOT EXISTS idx_pattern_learning_domain_primary
  ON public.pattern_learning (domain, is_primary);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_created_at
  ON public.activity_log (user_id, created_at DESC);

