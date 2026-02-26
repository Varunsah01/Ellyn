-- Migration 018: System template RLS policy updates
-- Allow authenticated users to read system templates (is_system=true) while
-- keeping mutations restricted to user-owned non-system rows.

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Remove prior policies (legacy + previous migration variants)
DROP POLICY IF EXISTS "Users can manage own templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can read own and system templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can insert own templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON public.email_templates;
DROP POLICY IF EXISTS "Service role has full access to templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can view own templates and defaults" ON public.email_templates;
DROP POLICY IF EXISTS "Users can view own templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can insert own template" ON public.email_templates;
DROP POLICY IF EXISTS "Users can update own template" ON public.email_templates;
DROP POLICY IF EXISTS "Users can delete own template" ON public.email_templates;
DROP POLICY IF EXISTS "email_templates_select_own_or_shared" ON public.email_templates;
DROP POLICY IF EXISTS "email_templates_insert_own" ON public.email_templates;
DROP POLICY IF EXISTS "email_templates_update_own" ON public.email_templates;
DROP POLICY IF EXISTS "email_templates_delete_own" ON public.email_templates;

CREATE POLICY "Users can read own and system templates"
  ON public.email_templates FOR SELECT
  USING (auth.uid() = user_id OR is_system = true);

CREATE POLICY "Users can insert own templates"
  ON public.email_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can update own templates"
  ON public.email_templates FOR UPDATE
  USING (auth.uid() = user_id AND is_system = false)
  WITH CHECK (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can delete own templates"
  ON public.email_templates FOR DELETE
  USING (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Service role has full access to templates"
  ON public.email_templates FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
