-- Migration: AI Usage Tracking
-- Description: Add AI usage tracking tables and user settings for cross-device sync
-- Date: 2025-01-15

-- ========================================
-- AI Usage Tracking Table
-- ========================================

CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  generation_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  estimated_cost DECIMAL(10, 4) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one record per user per day
  UNIQUE(user_id, date)
);

-- ========================================
-- Indexes
-- ========================================

-- Index for quick daily lookups
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage(user_id, date DESC);

-- Index for user statistics queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON ai_usage(user_id, created_at DESC);

-- ========================================
-- User AI Settings
-- ========================================

-- Add AI-related columns to users table (if using custom users table)
-- If using Supabase auth.users, create a separate user_settings table

CREATE TABLE IF NOT EXISTS user_ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_enabled BOOLEAN DEFAULT true,
  daily_ai_limit INTEGER DEFAULT 50,
  anthropic_api_key TEXT, -- Optional: store encrypted API key
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for user settings lookup
CREATE INDEX IF NOT EXISTS idx_user_ai_settings_user ON user_ai_settings(user_id);

-- ========================================
-- Row Level Security (RLS)
-- ========================================

-- Enable RLS on ai_usage table
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- Users can only see their own usage
CREATE POLICY ai_usage_select_own ON ai_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own usage
CREATE POLICY ai_usage_insert_own ON ai_usage
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own usage
CREATE POLICY ai_usage_update_own ON ai_usage
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Enable RLS on user_ai_settings
ALTER TABLE user_ai_settings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own settings
CREATE POLICY user_ai_settings_select_own ON user_ai_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own settings
CREATE POLICY user_ai_settings_insert_own ON user_ai_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own settings
CREATE POLICY user_ai_settings_update_own ON user_ai_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ========================================
-- Functions
-- ========================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ai_usage table
DROP TRIGGER IF EXISTS update_ai_usage_updated_at ON ai_usage;
CREATE TRIGGER update_ai_usage_updated_at
  BEFORE UPDATE ON ai_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_ai_settings table
DROP TRIGGER IF EXISTS update_user_ai_settings_updated_at ON user_ai_settings;
CREATE TRIGGER update_user_ai_settings_updated_at
  BEFORE UPDATE ON user_ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- Helper Functions
-- ========================================

-- Function to get or create user AI settings
CREATE OR REPLACE FUNCTION get_or_create_user_ai_settings(p_user_id UUID)
RETURNS user_ai_settings AS $$
DECLARE
  settings user_ai_settings;
BEGIN
  -- Try to get existing settings
  SELECT * INTO settings FROM user_ai_settings WHERE user_id = p_user_id;

  -- If not found, create default settings
  IF NOT FOUND THEN
    INSERT INTO user_ai_settings (user_id)
    VALUES (p_user_id)
    RETURNING * INTO settings;
  END IF;

  RETURN settings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- Sample Data (for development)
-- ========================================

-- Uncomment to create sample data
-- INSERT INTO user_ai_settings (user_id, ai_enabled, daily_ai_limit)
-- SELECT id, true, 50 FROM auth.users LIMIT 1;

-- ========================================
-- Comments
-- ========================================

COMMENT ON TABLE ai_usage IS 'Tracks AI email generation usage per user per day';
COMMENT ON TABLE user_ai_settings IS 'User-specific AI settings and preferences';
COMMENT ON COLUMN ai_usage.generation_count IS 'Number of AI generations performed';
COMMENT ON COLUMN ai_usage.tokens_used IS 'Total tokens consumed (input + output)';
COMMENT ON COLUMN ai_usage.estimated_cost IS 'Estimated cost in USD based on token usage';
COMMENT ON COLUMN user_ai_settings.daily_ai_limit IS 'Maximum AI generations allowed per day';
