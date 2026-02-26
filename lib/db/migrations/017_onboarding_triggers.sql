-- Auto-mark onboarding milestones from core user actions.

-- Auto-mark 'first_contact' when user inserts their first contact.
CREATE OR REPLACE FUNCTION public.check_first_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
  SET onboarding_steps_completed =
    array_append(COALESCE(onboarding_steps_completed, '{}'), 'first_contact')
  WHERE id = NEW.user_id
    AND NOT ('first_contact' = ANY(COALESCE(onboarding_steps_completed, '{}')));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_first_contact ON public.contacts;
CREATE TRIGGER trg_first_contact
  AFTER INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.check_first_contact();

-- Auto-mark 'first_draft' when user creates their first AI draft.
CREATE OR REPLACE FUNCTION public.check_first_draft()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
  SET onboarding_steps_completed =
    array_append(COALESCE(onboarding_steps_completed, '{}'), 'first_draft')
  WHERE id = NEW.user_id
    AND NOT ('first_draft' = ANY(COALESCE(onboarding_steps_completed, '{}')));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_first_draft ON public.ai_drafts;
CREATE TRIGGER trg_first_draft
  AFTER INSERT ON public.ai_drafts
  FOR EACH ROW EXECUTE FUNCTION public.check_first_draft();

-- Auto-mark 'first_sequence' when user creates their first sequence.
CREATE OR REPLACE FUNCTION public.check_first_sequence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
  SET onboarding_steps_completed =
    array_append(COALESCE(onboarding_steps_completed, '{}'), 'first_sequence')
  WHERE id = NEW.user_id
    AND NOT ('first_sequence' = ANY(COALESCE(onboarding_steps_completed, '{}')));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_first_sequence ON public.sequences;
CREATE TRIGGER trg_first_sequence
  AFTER INSERT ON public.sequences
  FOR EACH ROW EXECUTE FUNCTION public.check_first_sequence();
