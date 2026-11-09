-- Approved caretaker edits. Requires the reviewed OCR migration first.
-- No patient/caretaker table UPDATE policy is broadened. Apply only after local review/tests.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ DECLARE required record; BEGIN
 IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolbypassrls)
 OR to_regprocedure('auth.uid()') IS NULL
 OR to_regprocedure('medsage_ocr_private.serialize_writes()') IS NULL
 THEN RAISE EXCEPTION 'Requires postgres/BYPASSRLS, Supabase auth.uid and OCR guards'; END IF;
 FOR required IN SELECT * FROM (VALUES
  ('caretaker_links','id'),('caretaker_links','patient_id'),('caretaker_links','caretaker_id'),('caretaker_links','status'),
  ('medication_schedules','medicine_name'),('medication_schedules','dosage'),('medication_schedules','instructions'),
  ('medication_schedules','stock_quantity'),('medication_schedules','low_stock_threshold')
 ) AS fields(tab,col) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid=to_regclass('public.'||required.tab) AND attname=required.col
      AND attnum>0 AND NOT attisdropped AND attgenerated='')
  THEN RAISE EXCEPTION 'Missing writable caretaker-edit column %.%',required.tab,required.col; END IF;
 END LOOP;
END $$;
ALTER TABLE public.medication_schedules ADD COLUMN caretaker_edit_version bigint NOT NULL DEFAULT 0;
CREATE TABLE public.caretaker_schedule_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 edited_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 actor_id uuid NOT NULL, patient_id uuid NOT NULL, schedule_id uuid NOT NULL,
 prescription_id uuid NOT NULL, verification_id uuid NOT NULL,
 approval_link_id text NOT NULL,
 before_values jsonb NOT NULL, after_values jsonb NOT NULL
);
-- No cascading FK: historical audit must survive later source deletion.
ALTER TABLE public.caretaker_schedule_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caretaker_schedule_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.caretaker_schedule_audit TO authenticated;
CREATE POLICY patient_reads_caretaker_audit ON public.caretaker_schedule_audit
 FOR SELECT TO authenticated USING (patient_id=(SELECT auth.uid()));

CREATE FUNCTION medsage_ocr_private.caretaker_schedule_guard()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET row_security=off AS $$
DECLARE actor uuid:=auth.uid(); approval text;
 allowed text[]:=ARRAY['medicine_name','dosage','instructions','stock_quantity','low_stock_threshold','caretaker_edit_version'];
BEGIN
 NEW.caretaker_edit_version:=OLD.caretaker_edit_version+1;
 -- Preserve ordinary patient edits and trusted administrator maintenance.
 IF actor=OLD.patient_id THEN RETURN NEW; END IF;
 IF actor IS NULL THEN
   IF session_user='postgres' THEN RETURN NEW; END IF;
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Authentication required';
 END IF;
 PERFORM medsage_ocr_private.serialize_writes();
 -- Row lock serializes every write with approval revocation/deletion. After a
 -- committed revocation the next edit fails, even when the client cached approval.
 SELECT l.id::text INTO approval FROM public.caretaker_links l
 WHERE l.patient_id=OLD.patient_id AND l.caretaker_id=actor AND l.status='approved'
 ORDER BY l.id LIMIT 1 FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Approved caretaker connection required'; END IF;
 IF (to_jsonb(NEW)-allowed) IS DISTINCT FROM (to_jsonb(OLD)-allowed)
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Only medicine details and stock fields may be edited'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.patient_prescriptions p
  JOIN public.prescription_bill_verifications v ON v.prescription_id=p.id
  WHERE p.id=OLD.prescription_id AND v.id=OLD.verification_id
   AND p.patient_id=OLD.patient_id AND v.patient_id=OLD.patient_id
   AND p.analysis_status='analyzed' AND v.status='matched'
   AND jsonb_typeof(p.analysis_result)='object'
   AND NOT medsage_ocr_private.is_ocr(to_jsonb(p))
 ) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='An analyzed non-OCR prescription and matching bill verification are required'; END IF;
 IF NEW.stock_quantity<0 OR NEW.low_stock_threshold IS NULL OR NEW.low_stock_threshold<0
  OR NEW.stock_quantity::text IN ('NaN','Infinity','-Infinity')
  OR NEW.low_stock_threshold::text IN ('NaN','Infinity','-Infinity')
  OR nullif(btrim(NEW.medicine_name),'') IS NULL OR length(NEW.medicine_name)>200
  OR nullif(btrim(NEW.dosage),'') IS NULL OR length(NEW.dosage)>200
  OR length(NEW.instructions)>2000
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid medicine or stock values'; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION medsage_ocr_private.audit_caretaker_schedule()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET row_security=off AS $$
DECLARE actor uuid:=auth.uid(); approval text; fields text[]:=ARRAY['medicine_name','dosage','instructions','stock_quantity','low_stock_threshold'];
 old_fields jsonb; new_fields jsonb;
BEGIN
 IF actor IS NULL OR actor=OLD.patient_id THEN RETURN NEW; END IF;
 SELECT l.id::text INTO STRICT approval FROM public.caretaker_links l
 WHERE l.patient_id=OLD.patient_id AND l.caretaker_id=actor AND l.status='approved'
 ORDER BY l.id LIMIT 1;
 SELECT jsonb_object_agg(key,value) INTO old_fields FROM jsonb_each(to_jsonb(OLD)) WHERE key=ANY(fields);
 SELECT jsonb_object_agg(key,value) INTO new_fields FROM jsonb_each(to_jsonb(NEW)) WHERE key=ANY(fields);
 INSERT INTO public.caretaker_schedule_audit(actor_id,patient_id,schedule_id,prescription_id,verification_id,
  approval_link_id,before_values,after_values)
 VALUES(actor,OLD.patient_id,OLD.id,OLD.prescription_id,OLD.verification_id,approval,old_fields,new_fields);
 RETURN NEW;
END $$;
CREATE TRIGGER medsage_caretaker_schedule BEFORE UPDATE ON public.medication_schedules
 FOR EACH ROW EXECUTE FUNCTION medsage_ocr_private.caretaker_schedule_guard();
CREATE TRIGGER medsage_caretaker_audit AFTER UPDATE ON public.medication_schedules
 FOR EACH ROW EXECUTE FUNCTION medsage_ocr_private.audit_caretaker_schedule();

CREATE FUNCTION medsage_ocr_private.guard_caretaker_approval()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (NEW.patient_id,NEW.caretaker_id) IS DISTINCT FROM (OLD.patient_id,OLD.caretaker_id)
  THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Caretaker connection identity is immutable'; END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 END IF;
 IF NEW.status='approved' AND actor IS DISTINCT FROM NEW.patient_id THEN
  IF NOT (actor IS NULL AND session_user='postgres') THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Only the patient may approve caretaker access';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER medsage_caretaker_approval BEFORE INSERT OR UPDATE ON public.caretaker_links
 FOR EACH ROW EXECUTE FUNCTION medsage_ocr_private.guard_caretaker_approval();

-- Schedule editing never grants authority to manufacture its trust evidence,
-- even if an existing policy or privileged RPC permits a broader source write.
CREATE FUNCTION medsage_ocr_private.guard_caretaker_source_write()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); owner_id uuid;
BEGIN
 IF TG_OP='INSERT' THEN owner_id:=NEW.patient_id; ELSE owner_id:=OLD.patient_id; END IF;
 IF actor IS DISTINCT FROM owner_id AND NOT (actor IS NULL AND session_user='postgres')
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Caretakers cannot modify prescription or bill-verification evidence'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER medsage_caretaker_source_write BEFORE INSERT OR UPDATE OR DELETE
 ON public.patient_prescriptions FOR EACH ROW
 EXECUTE FUNCTION medsage_ocr_private.guard_caretaker_source_write();
CREATE TRIGGER medsage_caretaker_source_write BEFORE INSERT OR UPDATE OR DELETE
 ON public.prescription_bill_verifications FOR EACH ROW
 EXECUTE FUNCTION medsage_ocr_private.guard_caretaker_source_write();

CREATE FUNCTION public.edit_caretaker_medication(p_schedule_id uuid,p_expected_version bigint,p_changes jsonb)
RETURNS SETOF public.medication_schedules LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path='' SET row_security=off AS $$
DECLARE s public.medication_schedules%ROWTYPE; candidate public.medication_schedules%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Authentication required'; END IF;
 IF jsonb_typeof(p_changes) IS DISTINCT FROM 'object' OR p_changes='{}'::jsonb
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_changes) k WHERE k NOT IN
   ('medicine_name','dosage','instructions','stock_quantity','low_stock_threshold'))
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Unsupported edit fields'; END IF;
 PERFORM medsage_ocr_private.serialize_writes();
 SELECT * INTO s FROM public.medication_schedules WHERE id=p_schedule_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Schedule unavailable'; END IF;
 -- This is a caretaker-only RPC; patient editing continues through existing RLS.
 IF auth.uid()=s.patient_id THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Use the patient schedule editor'; END IF;
 IF p_expected_version IS DISTINCT FROM s.caretaker_edit_version
 THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Schedule changed. Reload before saving.'; END IF;
 candidate:=jsonb_populate_record(s,p_changes);
 -- The trigger performs fresh approval, ownership, provenance, value and audit checks.
 RETURN QUERY UPDATE public.medication_schedules SET
 medicine_name=candidate.medicine_name,dosage=candidate.dosage,instructions=candidate.instructions,
 stock_quantity=candidate.stock_quantity,low_stock_threshold=candidate.low_stock_threshold
 WHERE id=s.id RETURNING *;
END $$;
REVOKE ALL ON FUNCTION public.edit_caretaker_medication(uuid,bigint,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.edit_caretaker_medication(uuid,bigint,jsonb) TO authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA medsage_ocr_private FROM PUBLIC,anon,authenticated;
COMMIT;
