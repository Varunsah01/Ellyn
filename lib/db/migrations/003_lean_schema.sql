-- Migration 003: Lean Schema - Remove AI tracking, focus on core contact management
-- This migration creates a simplified schema with 5 essential tables

-- ============================================================================
-- CLEANUP: Drop old tables
-- ============================================================================

DROP TABLE IF EXISTS ai_usage CASCADE;
DROP TABLE IF EXISTS user_ai_settings CASCADE;
DROP TABLE IF EXISTS leads CASCADE;

-- ============================================================================
-- TABLE 1: contacts (core contact management)
-- ============================================================================

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Contact Info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  company TEXT NOT NULL,
  role TEXT,

  -- Email
  inferred_email TEXT,
  email_confidence INTEGER CHECK (email_confidence BETWEEN 0 AND 100),
  confirmed_email TEXT,

  -- Enrichment Data (from Bright Data)
  company_domain TEXT,
  company_industry TEXT,
  company_size TEXT,
  linkedin_url TEXT,

  -- Metadata
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'extension', 'csv_import')),
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'replied', 'no_response')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_contacted_at TIMESTAMPTZ,

  -- Constraint
  CONSTRAINT unique_user_contact UNIQUE(user_id, first_name, last_name, company)
);

-- Indexes for contacts
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);

-- RLS for contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contacts"
  ON contacts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contacts"
  ON contacts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contacts"
  ON contacts FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contacts"
  ON contacts FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TABLE 2: drafts (email drafts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,

  -- Draft Content
  subject TEXT NOT NULL,
  body TEXT NOT NULL,

  -- Template Reference
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'scheduled')),

  -- Scheduling
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,

  -- Metadata
  personalization_variables JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for drafts
CREATE INDEX IF NOT EXISTS idx_drafts_user_id ON drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_drafts_contact_id ON drafts(contact_id);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
CREATE INDEX IF NOT EXISTS idx_drafts_scheduled_for ON drafts(scheduled_for);

-- RLS for drafts
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own drafts"
  ON drafts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drafts"
  ON drafts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drafts"
  ON drafts FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own drafts"
  ON drafts FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TABLE 3: email_templates (reusable templates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Template Content
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,

  -- Metadata
  category TEXT DEFAULT 'referral' CHECK (category IN ('referral', 'follow_up', 'coffee_chat', 'info_interview', 'custom')),
  is_default BOOLEAN DEFAULT false,
  use_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for email_templates
CREATE INDEX IF NOT EXISTS idx_email_templates_user_id ON email_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_default ON email_templates(is_default);

-- RLS for email_templates
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own templates and defaults"
  ON email_templates FOR SELECT
  USING (auth.uid() = user_id OR is_default = true);

CREATE POLICY "Users can insert own templates"
  ON email_templates FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
  ON email_templates FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
  ON email_templates FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TABLE 4: api_usage (track Bright Data costs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- API Details
  api_name TEXT NOT NULL CHECK (api_name IN ('bright_data_company_enrichment', 'bright_data_person_enrichment')),
  endpoint TEXT NOT NULL,

  -- Request/Response
  request_params JSONB,
  response_status INTEGER,
  response_time_ms INTEGER,

  -- Cost Tracking
  cost_usd DECIMAL(10, 4) DEFAULT 0,
  credits_used INTEGER DEFAULT 0,

  -- Success/Error
  success BOOLEAN DEFAULT true,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for api_usage
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_api_name ON api_usage(api_name);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_success ON api_usage(success);

-- RLS for api_usage
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api usage"
  ON api_usage FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api usage"
  ON api_usage FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- TABLE 5: user_settings (user preferences)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Email Settings
  default_email_signature TEXT,
  email_send_from TEXT,

  -- Notification Preferences
  notify_on_reply BOOLEAN DEFAULT true,
  notify_on_bounce BOOLEAN DEFAULT true,
  daily_summary_email BOOLEAN DEFAULT false,

  -- API Budget Limits
  monthly_api_budget_usd DECIMAL(10, 2) DEFAULT 50.00,
  current_month_spend_usd DECIMAL(10, 2) DEFAULT 0,

  -- UI Preferences
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
  timezone TEXT DEFAULT 'UTC',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user_settings
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- RLS for user_settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- SEED DATA: Default Email Templates
-- ============================================================================

INSERT INTO email_templates (id, user_id, name, subject, body, category, is_default, use_count)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    NULL,
    'Referral Request - Direct',
    'Quick question about [Company Name]',
    'Hi [First Name],

I hope this email finds you well! I''m [Your Name], and I came across your profile while researching [Company Name]. I''m really excited about [specific role/team] and think my background in [your relevant experience] would be a great fit.

Would you be open to a quick 15-minute call to discuss your experience at [Company Name]? I''d love to learn more about [specific team/project] and how you got started there.

I completely understand if you''re too busy—no worries at all!

Thanks for considering,
[Your Name]',
    'referral',
    true,
    0
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    NULL,
    'Coffee Chat Request',
    'Would love to connect over coffee',
    'Hi [First Name],

I''m [Your Name], currently exploring opportunities in [industry/field]. I came across your profile and was impressed by your work on [specific project/achievement].

I''d love to buy you coffee (virtual or in-person) and learn more about your career path and experience at [Company Name]. I''m particularly interested in [specific topic/team].

Would you have 20 minutes in the next couple of weeks?

Best,
[Your Name]',
    'coffee_chat',
    true,
    0
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    NULL,
    'Follow-up After No Response',
    'Following up - [Original Subject]',
    'Hi [First Name],

I wanted to follow up on my previous email about [brief mention of what you asked for]. I know you''re probably busy, so I completely understand if now isn''t a good time.

If you have 10-15 minutes in the coming weeks, I''d still love to connect and learn from your experience at [Company Name].

Thanks again for considering!
[Your Name]',
    'follow_up',
    true,
    0
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    NULL,
    'Informational Interview',
    'Seeking career advice from a [Role] at [Company]',
    'Hi [First Name],

My name is [Your Name], and I''m currently exploring career paths in [field/industry]. I''ve been following [Company Name]''s work on [specific product/initiative] and am really impressed.

I''d be grateful for 20 minutes of your time to learn about:
• Your career journey and how you got to [Company Name]
• Day-to-day responsibilities as a [their role]
• Any advice for someone looking to break into [field/industry]

Would you be open to a quick call in the next few weeks?

Thank you for considering,
[Your Name]',
    'info_interview',
    true,
    0
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    NULL,
    'Alumni Connection',
    'Fellow [University] alum interested in [Company]',
    'Hi [First Name],

I''m [Your Name], a fellow [University] alum (Class of [Year]). I saw that you''re now at [Company Name] and wanted to reach out!

I''m currently exploring opportunities in [field] and would love to learn about your experience at [Company Name], particularly around [specific team/product]. As a fellow [mascot/school nickname], I''d be incredibly grateful for any insights you could share.

Would you have 15 minutes for a quick call in the next couple of weeks?

Go [Team]!
[Your Name]',
    'referral',
    true,
    0
  );

-- ============================================================================
-- FUNCTIONS: Auto-update timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drafts_updated_at
  BEFORE UPDATE ON drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 6: pattern_learning (machine learning from user feedback)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pattern_learning (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain TEXT NOT NULL,
  pattern TEXT NOT NULL,
  success_count INTEGER DEFAULT 0,
  total_attempts INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0,
  last_success_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_domain_pattern UNIQUE(domain, pattern)
);

-- Indexes for pattern_learning
CREATE INDEX IF NOT EXISTS idx_pattern_learning_domain ON pattern_learning(domain);
CREATE INDEX IF NOT EXISTS idx_pattern_learning_success_rate ON pattern_learning(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_learning_updated ON pattern_learning(updated_at DESC);

-- Function to update success rate automatically
CREATE OR REPLACE FUNCTION update_pattern_success_rate()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_attempts > 0 THEN
    NEW.success_rate = (NEW.success_count::DECIMAL / NEW.total_attempts::DECIMAL) * 100;
  ELSE
    NEW.success_rate = 0;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pattern_success_rate
  BEFORE UPDATE ON pattern_learning
  FOR EACH ROW
  EXECUTE FUNCTION update_pattern_success_rate();
