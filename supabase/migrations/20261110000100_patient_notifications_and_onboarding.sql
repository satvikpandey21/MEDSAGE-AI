-- Review and apply manually after the existing migrations. Never applied by the app.
BEGIN;
CREATE TABLE public.patient_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_id uuid NOT NULL REFERENCES public.medication_schedules(id) ON DELETE CASCADE,
  event_key text NOT NULL CHECK (length(event_key) BETWEEN 1 AND 300),
  kind text NOT NULL CHECK (kind IN ('upcoming','due','missed','low_stock','out_of_stock')),
  title text NOT NULL CHECK (length(title) <= 500),
  body text NOT NULL CHECK (length(body) <= 2000),
  target text NOT NULL CHECK (target IN ('schedule','stock')),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (patient_id,event_key)
);
CREATE INDEX patient_notifications_patient_created_idx ON public.patient_notifications(patient_id,created_at DESC);
ALTER TABLE public.patient_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.patient_notifications FROM PUBLIC,anon,authenticated;
GRANT SELECT, INSERT ON public.patient_notifications TO authenticated;
GRANT UPDATE (read_at) ON public.patient_notifications TO authenticated;
CREATE POLICY notifications_read_own ON public.patient_notifications FOR SELECT TO authenticated
 USING (patient_id = (SELECT auth.uid()));
CREATE POLICY notifications_insert_own ON public.patient_notifications FOR INSERT TO authenticated
 WITH CHECK (patient_id = (SELECT auth.uid()) AND EXISTS (
   SELECT 1 FROM public.medication_schedules s WHERE s.id = schedule_id AND s.patient_id = (SELECT auth.uid())
 ));
CREATE POLICY notifications_update_own ON public.patient_notifications FOR UPDATE TO authenticated
 USING (patient_id = (SELECT auth.uid())) WITH CHECK (patient_id = (SELECT auth.uid()));

CREATE TABLE public.patient_onboarding (
  patient_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','deferred','completed'))
);
ALTER TABLE public.patient_onboarding ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.patient_onboarding FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.patient_onboarding TO authenticated;
GRANT UPDATE (status) ON public.patient_onboarding TO authenticated;
CREATE POLICY onboarding_read_own ON public.patient_onboarding FOR SELECT TO authenticated
 USING (patient_id = (SELECT auth.uid()));
CREATE POLICY onboarding_update_own ON public.patient_onboarding FOR UPDATE TO authenticated
 USING (patient_id = (SELECT auth.uid())) WITH CHECK (patient_id = (SELECT auth.uid()));

-- Only registrations after installation are eligible. Deliberately no historical backfill.
CREATE FUNCTION public.medsage_initialize_onboarding() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 INSERT INTO public.patient_onboarding(patient_id) VALUES (NEW.id);
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.medsage_initialize_onboarding() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER medsage_initialize_onboarding AFTER INSERT ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.medsage_initialize_onboarding();

-- Completion uses only fields that exist in the current Patient Profile page.
CREATE FUNCTION public.medsage_complete_onboarding() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF length(trim(coalesce(NEW.full_name,''))) >= 2 AND NEW.age > 0
   AND length(trim(coalesce(NEW.gender,''))) > 0 AND length(trim(coalesce(NEW.phone,''))) > 0 THEN
   UPDATE public.patient_onboarding SET status = 'completed' WHERE patient_id = NEW.id;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.medsage_complete_onboarding() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER medsage_complete_onboarding AFTER INSERT OR UPDATE ON public.patient_profiles
 FOR EACH ROW EXECUTE FUNCTION public.medsage_complete_onboarding();
COMMIT;
