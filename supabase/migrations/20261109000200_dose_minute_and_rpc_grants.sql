-- Install once after OCR and caretaker migrations. No historical rows are changed.
-- Review DOSE_MINUTE_PREFLIGHT.sql first. Actual deployed RPC bodies remain required
-- for end-to-end stock/ownership verification; no RPC body is rewritten here.
BEGIN;
SET LOCAL lock_timeout='5s';
LOCK TABLE public.medication_dose_logs IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.medication_dose_logs
   WHERE schedule_id IS NULL OR scheduled_for IS NULL OR NOT isfinite(scheduled_for))
 THEN RAISE EXCEPTION 'Review null/nonfinite historical dose keys before installation'; END IF;
 IF EXISTS (SELECT 1 FROM public.medication_dose_logs
   GROUP BY schedule_id,date_trunc('minute',scheduled_for AT TIME ZONE 'Asia/Kolkata')
   HAVING count(*)>1)
 THEN RAISE EXCEPTION 'Historical minute-level duplicates require manual review; no rows changed'; END IF;
END $$;
-- Fixed-zone timestamp expression is independent of the session TimeZone.
-- Retains full-timestamp UNIQUE constraints and protects historical nonzero seconds.
CREATE UNIQUE INDEX medication_dose_logs_schedule_kolkata_minute_uidx
 ON public.medication_dose_logs
 (schedule_id,(date_trunc('minute',scheduled_for AT TIME ZONE 'Asia/Kolkata')));
CREATE FUNCTION medsage_ocr_private.require_canonical_dose_minute()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.schedule_id IS NULL OR NEW.scheduled_for IS NULL
   OR NOT pg_catalog.isfinite(NEW.scheduled_for)
   OR NEW.scheduled_for IS DISTINCT FROM
     (pg_catalog.date_trunc('minute',NEW.scheduled_for AT TIME ZONE 'Asia/Kolkata')
       AT TIME ZONE 'Asia/Kolkata')
 THEN RAISE EXCEPTION USING ERRCODE='23514',
   MESSAGE='Dose occurrence must be a finite canonical Asia/Kolkata scheduled minute'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION medsage_ocr_private.require_canonical_dose_minute() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER require_canonical_dose_minute
 BEFORE INSERT OR UPDATE OF schedule_id,scheduled_for ON public.medication_dose_logs
 FOR EACH ROW EXECUTE FUNCTION medsage_ocr_private.require_canonical_dose_minute();
-- Preserve authenticated and service execution explicitly before removing PUBLIC.
GRANT EXECUTE ON FUNCTION public.create_caretaker_invite(),
 public.redeem_caretaker_invite(text),
 public.respond_to_caretaker_request(uuid,boolean),
 public.record_medication_dose(uuid,timestamptz,text) TO authenticated,service_role;
REVOKE EXECUTE ON FUNCTION public.create_caretaker_invite(),
 public.redeem_caretaker_invite(text),
 public.respond_to_caretaker_request(uuid,boolean),
 public.record_medication_dose(uuid,timestamptz,text) FROM PUBLIC,anon;
DO $$ DECLARE signature text; BEGIN
 FOREACH signature IN ARRAY ARRAY['public.create_caretaker_invite()',
  'public.redeem_caretaker_invite(text)',
  'public.respond_to_caretaker_request(uuid,boolean)',
  'public.record_medication_dose(uuid,timestamptz,text)'] LOOP
  IF has_function_privilege('anon',signature,'EXECUTE') THEN
   RAISE EXCEPTION 'Inherited anonymous execution remains on %; review role membership',signature;
  END IF;
 END LOOP;
END $$;
-- Search paths deliberately unchanged until deployed unqualified references are reviewed.
COMMIT;
