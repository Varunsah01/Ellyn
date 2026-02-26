-- Migration 011: Add persona category, system flag, and variable tracking to email_templates
-- NOTE: If a 'category' column already exists with free-form values (e.g. 'outreach', 'follow-up'),
-- the ADD COLUMN IF NOT EXISTS will be a no-op. Run the ALTER COLUMN step below manually
-- to apply the check constraint only after migrating existing rows to valid values.

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS variables TEXT[] DEFAULT '{}';

-- Add category column only if it does not exist.
-- If it already exists, manually run:
--   UPDATE public.email_templates SET category = 'general' WHERE category NOT IN ('job_seeker','smb_sales','general');
--   ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_category_check CHECK (category IN ('job_seeker','smb_sales','general'));
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general'
    CHECK (category IN ('job_seeker', 'smb_sales', 'general'));

CREATE INDEX IF NOT EXISTS idx_email_templates_is_system ON public.email_templates(is_system);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON public.email_templates(category);
