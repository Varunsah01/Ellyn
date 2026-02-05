-- Email Discovery Platform - Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Leads Table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  discovered_emails JSONB NOT NULL,
  selected_email TEXT,
  status TEXT DEFAULT 'discovered' CHECK (status IN ('discovered', 'sent', 'bounced', 'replied')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_company_name ON leads(company_name);
CREATE INDEX IF NOT EXISTS idx_leads_person_name ON leads(person_name);

-- Add full-text search index
CREATE INDEX IF NOT EXISTS idx_leads_search ON leads USING gin(
  to_tsvector('english', person_name || ' ' || company_name)
);

-- 2. Domain Cache Table
CREATE TABLE IF NOT EXISTS domain_cache (
  company_name TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  mx_records JSONB,
  last_verified TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for date filtering
CREATE INDEX IF NOT EXISTS idx_domain_cache_last_verified ON domain_cache(last_verified);

-- 3. Gmail Credentials Table
CREATE TABLE IF NOT EXISTS gmail_credentials (
  user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Email History Table
CREATE TABLE IF NOT EXISTS email_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  gmail_message_id TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed'))
);

-- Add indexes for email history
CREATE INDEX IF NOT EXISTS idx_email_history_lead_id ON email_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_history_sent_at ON email_history(sent_at DESC);

-- Function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on leads table
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
-- Note: Adjust these based on your authentication setup

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_history ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (adjust for production)
CREATE POLICY "Restrict all operations on leads" ON leads
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "Restrict all operations on domain_cache" ON domain_cache
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "Restrict all operations on gmail_credentials" ON gmail_credentials
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "Restrict all operations on email_history" ON email_history
  FOR ALL USING (false) WITH CHECK (false);

-- Sample data for testing (optional)
-- Uncomment to insert test data
/*
INSERT INTO leads (person_name, company_name, discovered_emails, selected_email, status)
VALUES
  ('John Doe', 'Microsoft',
   '[{"email":"john.doe@microsoft.com","pattern":"first.last","confidence":60}]'::jsonb,
   'john.doe@microsoft.com', 'discovered'),
  ('Jane Smith', 'Google',
   '[{"email":"jane.smith@google.com","pattern":"first.last","confidence":65}]'::jsonb,
   'jane.smith@google.com', 'sent');
*/

-- Verify tables were created
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('leads', 'domain_cache', 'gmail_credentials', 'email_history')
ORDER BY table_name;
