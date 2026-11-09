-- Controlled-test candidate. No remote execution is authorized by this file.
-- No data backfill, RLS changes, FK rewrites, status-CHECK rewrites or promotion RPC.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Fail closed if the reviewed starting state has changed.
DO $preflight$
DECLARE r record;
BEGIN
  IF current_user <> 'postgres' OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = current_user AND rolbypassrls
  ) THEN
    RAISE EXCEPTION 'Apply as the reviewed postgres/BYPASSRLS owner only';
  END IF;
  FOR r IN SELECT unnest(ARRAY['patient_prescriptions','medication_schedules',
      'prescription_bill_verifications','medication_dose_logs']) AS name LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=r.name AND c.relkind='r' AND c.relrowsecurity)
    THEN RAISE EXCEPTION 'Expected ordinary RLS-enabled table: %',r.name; END IF;
  END LOOP;
END $preflight$;

-- Blocks competing writes during preflight and installation; does not rewrite rows.
LOCK TABLE public.patient_prescriptions, public.prescription_bill_verifications,
  public.medication_schedules IN SHARE ROW EXCLUSIVE MODE;

DO $schema$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('patient_prescriptions','id','uuid'),('patient_prescriptions','patient_id','uuid'),
    ('patient_prescriptions','analysis_result','jsonb'),('patient_prescriptions','analysis_status','text'),
    ('medication_schedules','id','uuid'),('medication_schedules','patient_id','uuid'),
    ('medication_schedules','prescription_id','uuid'),('medication_schedules','verification_id','uuid'),
    ('prescription_bill_verifications','id','uuid'),('prescription_bill_verifications','patient_id','uuid'),
    ('prescription_bill_verifications','prescription_id','uuid')
  ) AS expected(tab,col,typ) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a
      WHERE a.attrelid=to_regclass('public.'||r.tab) AND a.attname=r.col
      AND a.atttypid=r.typ::regtype AND a.attnum>0 AND NOT a.attisdropped AND a.attgenerated='')
    THEN RAISE EXCEPTION 'Unexpected column definition: %.%',r.tab,r.col; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE NOT tgisinternal
    AND tgrelid IN ('public.patient_prescriptions'::regclass,
      'public.prescription_bill_verifications'::regclass,'public.medication_schedules'::regclass))
  THEN RAISE EXCEPTION 'Unexpected custom triggers; review trigger interactions first'; END IF;
  -- Do not weaken unknown CHECKs. If this fails, extend the exact allow-list in
  -- a separately reviewed prerequisite; this migration never drops constraints.
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
    WHERE c.conrelid='public.patient_prescriptions'::regclass AND c.contype='c'
      AND a.attname='analysis_status')
  THEN RAISE EXCEPTION 'Review existing analysis_status CHECK explicitly before installation'; END IF;
END $schema$;

ALTER TABLE public.patient_prescriptions
  ADD COLUMN IF NOT EXISTS ocr_review_required boolean NOT NULL DEFAULT false;

DO $data$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid='public.patient_prescriptions'::regclass AND attname='ocr_review_required'
      AND atttypid='boolean'::regtype AND attnotnull AND attgenerated='')
  THEN RAISE EXCEPTION 'Incompatible existing OCR flag'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid='public.patient_prescriptions'::regclass
      AND a.attname='ocr_review_required'
      AND pg_catalog.pg_get_expr(d.adbin,d.adrelid)='false')
  THEN RAISE EXCEPTION 'OCR flag must default to false to preserve ordinary uploads'; END IF;
  IF EXISTS (SELECT 1 FROM public.patient_prescriptions p
    WHERE p.ocr_review_required OR p.analysis_status='pending_review'
      OR p.analysis_result->>'extraction_source'='paddleocr'
      OR p.analysis_result->>'analysis_status'='pending_review'
      OR (p.analysis_result IS NOT NULL AND p.analysis_result <> 'null'::jsonb
          AND jsonb_typeof(p.analysis_result)<>'object'))
  THEN RAISE EXCEPTION 'Starting OCR/JSON state differs from reviewed zero-count preflight'; END IF;
  IF EXISTS (SELECT 1 FROM public.prescription_bill_verifications v
    LEFT JOIN public.patient_prescriptions p ON p.id=v.prescription_id
    WHERE p.id IS NULL OR p.patient_id IS DISTINCT FROM v.patient_id)
  OR EXISTS (SELECT 1 FROM public.medication_schedules s
    LEFT JOIN public.patient_prescriptions p ON p.id=s.prescription_id
    LEFT JOIN public.prescription_bill_verifications v ON v.id=s.verification_id
    WHERE (s.prescription_id IS NOT NULL AND (p.id IS NULL OR p.patient_id IS DISTINCT FROM s.patient_id))
      OR (s.verification_id IS NOT NULL AND (v.id IS NULL
        OR v.patient_id IS DISTINCT FROM s.patient_id
        OR v.prescription_id IS DISTINCT FROM s.prescription_id)))
  THEN RAISE EXCEPTION 'Source ownership/link integrity differs from reviewed preflight'; END IF;
END $data$;

-- Deliberately fail on an existing schema/name collision; do not replace unknown code.
CREATE SCHEMA medsage_ocr_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA medsage_ocr_private FROM PUBLIC, anon, authenticated;

CREATE FUNCTION medsage_ocr_private.is_ocr(j jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(j->>'ocr_review_required'='true'
    OR j->>'analysis_status'='pending_review'
    OR j->'analysis_result'->>'extraction_source'='paddleocr'
    OR j->'analysis_result'->>'analysis_status'='pending_review',false)
$$;

CREATE FUNCTION medsage_ocr_private.serialize_writes()
RETURNS void LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
BEGIN
  -- Volatile trigger queries take fresh READ COMMITTED snapshots after the lock.
  -- Reject snapshot isolation rather than accepting a stale integrity lookup.
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION USING ERRCODE='25000', MESSAGE='OCR provenance writes require READ COMMITTED';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(1835361395, 1868788338);
END $$;

CREATE FUNCTION medsage_ocr_private.guard_prescription()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = '' SET row_security = off AS $$
DECLARE flagged boolean;
BEGIN
  PERFORM medsage_ocr_private.serialize_writes();
  IF TG_OP='DELETE' THEN
    IF medsage_ocr_private.is_ocr(to_jsonb(OLD)) THEN
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

CREATE FUNCTION medsage_ocr_private.guard_verification()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = '' SET row_security = off AS $$
DECLARE p public.patient_prescriptions%ROWTYPE;
BEGIN
  PERFORM medsage_ocr_private.serialize_writes();
  IF TG_OP='DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.medication_schedules s WHERE s.verification_id=OLD.id)
    THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Linked verification cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' THEN
    IF (NEW.id,NEW.patient_id,NEW.prescription_id) IS DISTINCT FROM (OLD.id,OLD.patient_id,OLD.prescription_id) THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Verification source identity is immutable';
    END IF;
    IF (NEW.status IS DISTINCT FROM OLD.status
        OR (to_jsonb(NEW)->'bill_id') IS DISTINCT FROM (to_jsonb(OLD)->'bill_id')
        OR (to_jsonb(NEW)->'comparison_result') IS DISTINCT FROM (to_jsonb(OLD)->'comparison_result'))
      AND EXISTS (
      SELECT 1 FROM public.medication_schedules s WHERE s.verification_id=OLD.id)
    THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Linked verification result and status are immutable'; END IF;
  END IF;
  SELECT * INTO p FROM public.patient_prescriptions WHERE id=NEW.prescription_id;
  IF NOT FOUND OR p.patient_id IS DISTINCT FROM NEW.patient_id THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Invalid verification source';
  END IF;
  -- OCR has no bill-verifiable medicine objects. Reject all verification statuses,
  -- preserving the existing matched/needs_review/mismatch CHECK unchanged.
  IF medsage_ocr_private.is_ocr(to_jsonb(p)) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='OCR-only results cannot be bill verified';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION medsage_ocr_private.guard_schedule()
RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = '' SET row_security = off AS $$
DECLARE p public.patient_prescriptions%ROWTYPE;
        v public.prescription_bill_verifications%ROWTYPE;
BEGIN
  -- Stock, timing, dosage and other ordinary edits do not revalidate provenance.
  IF TG_OP='UPDATE' THEN
    IF (NEW.id,NEW.patient_id,NEW.prescription_id,NEW.verification_id)
      IS NOT DISTINCT FROM (OLD.id,OLD.patient_id,OLD.prescription_id,OLD.verification_id)
    THEN RETURN NEW; END IF;
  END IF;
  PERFORM medsage_ocr_private.serialize_writes();
  IF TG_OP='UPDATE' THEN
    IF (NEW.id,NEW.patient_id) IS DISTINCT FROM (OLD.id,OLD.patient_id)
      OR ((OLD.prescription_id IS NOT NULL OR OLD.verification_id IS NOT NULL)
        AND (NEW.prescription_id,NEW.verification_id) IS DISTINCT FROM (OLD.prescription_id,OLD.verification_id))
    THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Established schedule provenance cannot be detached or reassigned'; END IF;
  END IF;
  IF NEW.verification_id IS NOT NULL THEN
    SELECT * INTO v FROM public.prescription_bill_verifications WHERE id=NEW.verification_id;
    IF NOT FOUND OR v.patient_id IS DISTINCT FROM NEW.patient_id
      OR NEW.prescription_id IS NULL OR v.prescription_id IS DISTINCT FROM NEW.prescription_id
      OR v.status IS DISTINCT FROM 'matched'
    THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Invalid or untrusted schedule verification'; END IF;
  END IF;
  IF NEW.prescription_id IS NOT NULL THEN
    SELECT * INTO p FROM public.patient_prescriptions WHERE id=NEW.prescription_id;
    IF NOT FOUND OR p.patient_id IS DISTINCT FROM NEW.patient_id
      OR medsage_ocr_private.is_ocr(to_jsonb(p))
    THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Invalid or OCR-only schedule source'; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER medsage_ocr_prescription BEFORE INSERT OR UPDATE OR DELETE
ON public.patient_prescriptions FOR EACH ROW
EXECUTE FUNCTION medsage_ocr_private.guard_prescription();
CREATE TRIGGER medsage_ocr_verification BEFORE INSERT OR UPDATE OR DELETE
ON public.prescription_bill_verifications FOR EACH ROW
EXECUTE FUNCTION medsage_ocr_private.guard_verification();
CREATE TRIGGER medsage_ocr_schedule BEFORE INSERT OR UPDATE
ON public.medication_schedules FOR EACH ROW
EXECUTE FUNCTION medsage_ocr_private.guard_schedule();

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA medsage_ocr_private FROM PUBLIC, anon, authenticated;
-- Ownership is fixed by the precondition and explicit schema owner; no role grants,
-- client-facing RPCs, table policy changes, or modifications to dose logs.
COMMIT;
