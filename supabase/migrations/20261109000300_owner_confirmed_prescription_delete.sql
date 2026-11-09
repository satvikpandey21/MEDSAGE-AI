-- Owner-confirmed, narrowly scoped prescription deletion. Manual install only.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('medsage_ocr_private.guard_prescription()') IS NULL
 THEN RAISE EXCEPTION 'Requires reviewed postgres owner and existing OCR/caretaker/dose migrations'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('medsage_ocr_private.guard_prescription()')
  AND md5(replace(prosrc,E'\r',''))='4d58b2e307d3c910d4e039533ad196af')
 THEN RAISE EXCEPTION 'Existing prescription guard differs from reviewed original; stop before replacing it'; END IF;
 IF to_regprocedure('medsage_ocr_private.caretaker_schedule_guard()') IS NULL
  OR to_regclass('public.medication_dose_logs_schedule_kolkata_minute_uidx') IS NULL
 THEN RAISE EXCEPTION 'Install the existing caretaker and dose migrations first'; END IF;
END $$;
CREATE TABLE medsage_ocr_private.prescription_delete_authorizations (
 transaction_id xid8 NOT NULL, prescription_id uuid NOT NULL, patient_id uuid NOT NULL,
 PRIMARY KEY(transaction_id,prescription_id)
);
ALTER TABLE medsage_ocr_private.prescription_delete_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON medsage_ocr_private.prescription_delete_authorizations FROM PUBLIC,anon,authenticated,service_role;
-- Existing guards stay enabled. Only the exact owner-checked RPC below can issue
-- this transaction-scoped capability. Client-set session variables grant no bypass.
CREATE OR REPLACE FUNCTION medsage_ocr_private.guard_prescription()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = '' SET row_security = off AS $$
DECLARE flagged boolean;
BEGIN
  PERFORM medsage_ocr_private.serialize_writes();
  IF TG_OP='DELETE' THEN
    IF medsage_ocr_private.is_ocr(to_jsonb(OLD)) AND NOT EXISTS (
      SELECT 1 FROM medsage_ocr_private.prescription_delete_authorizations a
      WHERE a.transaction_id=pg_catalog.pg_current_xact_id()
        AND a.prescription_id=OLD.id AND a.patient_id=OLD.patient_id
        AND a.patient_id=auth.uid()
    ) THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='OCR provenance cannot be deleted';
    END IF;
    -- Preserve linked provenance rather than letting SET NULL silently detach it.
    IF EXISTS (SELECT 1 FROM public.medication_schedules s WHERE s.prescription_id=OLD.id)
      OR EXISTS (SELECT 1 FROM public.prescription_bill_verifications v WHERE v.prescription_id=OLD.id)
    THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Linked prescription source cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' THEN
    IF (NEW.id,NEW.patient_id) IS DISTINCT FROM (OLD.id,OLD.patient_id) THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Prescription identity is immutable';
    END IF;
    IF medsage_ocr_private.is_ocr(to_jsonb(OLD)) THEN
      IF NEW.analysis_result IS DISTINCT FROM OLD.analysis_result
        OR NEW.analysis_status IS DISTINCT FROM OLD.analysis_status
        OR NEW.ocr_review_required IS DISTINCT FROM OLD.ocr_review_required
        OR (to_jsonb(NEW)->'file_path') IS DISTINCT FROM (to_jsonb(OLD)->'file_path')
        OR (to_jsonb(NEW)->'file_type') IS DISTINCT FROM (to_jsonb(OLD)->'file_type')
      THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='OCR transcription and review provenance are immutable'; END IF;
      RETURN NEW;
    END IF;
  END IF;
  flagged := medsage_ocr_private.is_ocr(to_jsonb(NEW));
  IF flagged THEN
    IF jsonb_typeof(NEW.analysis_result) IS DISTINCT FROM 'object'
      OR jsonb_typeof(NEW.analysis_result->'raw_ocr_text') IS DISTINCT FROM 'string'
      OR btrim(NEW.analysis_result->>'raw_ocr_text')=''
    THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='OCR requires an object with nonempty raw transcription'; END IF;
    IF EXISTS (SELECT 1 FROM public.medication_schedules s WHERE s.prescription_id=NEW.id)
      OR EXISTS (SELECT 1 FROM public.prescription_bill_verifications v WHERE v.prescription_id=NEW.id)
    THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Existing linked records prevent OCR-only reanalysis'; END IF;
    NEW.ocr_review_required := true;
    NEW.analysis_status := 'pending_review';
    NEW.analysis_result := NEW.analysis_result ||
      '{"extraction_source":"paddleocr","analysis_status":"pending_review","requires_human_verification":true,"medicines":[]}'::jsonb;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.delete_owned_prescription(p_prescription_id uuid,p_confirm boolean)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path='' SET row_security=off AS $$
DECLARE actor uuid:=auth.uid(); doc public.patient_prescriptions%ROWTYPE;
 schedule_ids uuid[]; verification_ids uuid[]; count_logs bigint; count_schedules bigint; count_verifications bigint;
BEGIN
 IF actor IS NULL OR p_confirm IS DISTINCT FROM true THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Authenticated owner confirmation required';
 END IF;
 PERFORM medsage_ocr_private.serialize_writes();
 SELECT * INTO doc FROM public.patient_prescriptions WHERE id=p_prescription_id AND patient_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Prescription unavailable'; END IF;
 PERFORM 1 FROM public.prescription_bill_verifications WHERE prescription_id=doc.id FOR UPDATE;
 SELECT coalesce(array_agg(id),ARRAY[]::uuid[]) INTO verification_ids
 FROM public.prescription_bill_verifications WHERE prescription_id=doc.id;
 -- Lock schedules before deleting logs so an in-flight dose must finish first.
 PERFORM 1 FROM public.medication_schedules WHERE prescription_id=doc.id OR verification_id=ANY(verification_ids) ORDER BY id FOR UPDATE;
 SELECT coalesce(array_agg(id),ARRAY[]::uuid[]) INTO schedule_ids FROM public.medication_schedules
 WHERE prescription_id=doc.id OR verification_id=ANY(verification_ids);
 IF EXISTS(SELECT 1 FROM public.prescription_bill_verifications WHERE id=ANY(verification_ids) AND patient_id IS DISTINCT FROM actor)
 OR EXISTS(SELECT 1 FROM public.medication_schedules WHERE id=ANY(schedule_ids) AND patient_id IS DISTINCT FROM actor)
 OR EXISTS(SELECT 1 FROM public.medication_dose_logs WHERE schedule_id=ANY(schedule_ids) AND patient_id IS DISTINCT FROM actor)
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Dependent ownership mismatch; no deletion performed'; END IF;
 INSERT INTO medsage_ocr_private.prescription_delete_authorizations VALUES(pg_catalog.pg_current_xact_id(),doc.id,actor);
 DELETE FROM public.medication_dose_logs WHERE schedule_id=ANY(schedule_ids);
 GET DIAGNOSTICS count_logs=ROW_COUNT;
 DELETE FROM public.medication_schedules WHERE id=ANY(schedule_ids);
 GET DIAGNOSTICS count_schedules=ROW_COUNT;
 DELETE FROM public.prescription_bill_verifications WHERE id=ANY(verification_ids);
 GET DIAGNOSTICS count_verifications=ROW_COUNT;
 DELETE FROM public.patient_prescriptions WHERE id=doc.id AND patient_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Prescription deletion incomplete'; END IF;
 DELETE FROM medsage_ocr_private.prescription_delete_authorizations
 WHERE transaction_id=pg_catalog.pg_current_xact_id() AND prescription_id=doc.id;
 -- Bills and immutable caretaker audit history are retained deliberately.
 RETURN jsonb_build_object('id',doc.id,'file_path',doc.file_path,
  'deleted_schedules',count_schedules,'deleted_verifications',count_verifications,'deleted_dose_logs',count_logs);
END $$;
REVOKE ALL ON FUNCTION public.delete_owned_prescription(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_owned_prescription(uuid,boolean) TO authenticated;
COMMIT;
