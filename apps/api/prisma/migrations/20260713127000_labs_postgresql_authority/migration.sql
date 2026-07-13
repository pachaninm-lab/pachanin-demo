-- IR-10.3 correction facts are append-only successors. The predecessor identity
-- is bound into the immutable TEST evidence at upload time and derived by the
-- database on INSERT; application clients cannot rewrite an existing test.

CREATE OR REPLACE FUNCTION public.app_labs_derive_test_authority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, labs
AS $function$
DECLARE
  sample_record public."lab_samples"%ROWTYPE;
  method_record labs.methods%ROWTYPE;
  equipment_record labs.equipment%ROWTYPE;
  predecessor public."lab_tests"%ROWTYPE;
  evidence_supersedes_id TEXT;
BEGIN
  SELECT * INTO sample_record
  FROM public."lab_samples"
  WHERE "id" = NEW."sampleId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'laboratory sample does not exist' USING ERRCODE = '23503';
  END IF;
  IF sample_record."status" = 'FINALIZED' THEN
    RAISE EXCEPTION 'late laboratory test insert is forbidden after finalization' USING ERRCODE = '23514';
  END IF;
  IF sample_record."status" NOT IN ('RECEIVED','ANALYSIS_IN_PROGRESS') THEN
    RAISE EXCEPTION 'laboratory sample is not ready for test recording' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO method_record FROM labs.methods WHERE id = NEW."methodId";
  SELECT * INTO equipment_record FROM labs.equipment WHERE id = NEW."equipmentId";
  IF method_record.id IS NULL OR equipment_record.id IS NULL
     OR method_record.tenant_id <> sample_record."tenantId"
     OR equipment_record.tenant_id <> sample_record."tenantId"
     OR method_record.laboratory_org_id <> sample_record."labId"
     OR equipment_record.laboratory_org_id <> sample_record."labId"
     OR method_record.status <> 'ACTIVE'
     OR equipment_record.status <> 'ACTIVE'
     OR method_record.valid_from > NEW."recordedAt"
     OR (method_record.valid_until IS NOT NULL AND method_record.valid_until <= NEW."recordedAt")
     OR equipment_record.calibration_valid_until <= NEW."recordedAt"
  THEN
    RAISE EXCEPTION 'laboratory method or equipment authority is invalid at recorded time' USING ERRCODE = '23514';
  END IF;
  IF NEW."actorUserId" <> current_setting('app.current_user_id', true)
     OR (
       NOT public.app_rls_privileged()
       AND NOT public.app_labs_actor_valid(
         sample_record."tenantId", sample_record."labId", NEW."actorUserId", 'ANALYST', NEW."recordedAt"
       )
     )
  THEN
    RAISE EXCEPTION 'authorized ANALYST assignment is required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.app_labs_evidence_purpose_valid(
       NEW."evidenceFileId", sample_record."tenantId", sample_record."dealId", 'TEST',
       sample_record."id", sample_record."shipmentId", sample_record."acceptanceId",
       sample_record."labId", NULL
     )
  THEN
    RAISE EXCEPTION 'test evidence is not purpose-bound to the exact sample' USING ERRCODE = '23514';
  END IF;

  SELECT NULLIF(document.metadata ->> 'supersedesId', '')
  INTO evidence_supersedes_id
  FROM public."deal_documents" document
  WHERE document.id = NEW."evidenceFileId"
    AND document."tenantId" = sample_record."tenantId"
    AND document."dealId" = sample_record."dealId"
    AND document.status = 'VERIFIED'
    AND document."isImmutable" = true;

  IF evidence_supersedes_id IS NOT NULL THEN
    IF NEW."supersedesId" IS NOT NULL AND NEW."supersedesId" <> evidence_supersedes_id THEN
      RAISE EXCEPTION 'correction command and immutable evidence bind different predecessors' USING ERRCODE = '23514';
    END IF;
    NEW."supersedesId" := evidence_supersedes_id;
  ELSIF NEW."supersedesId" IS NOT NULL THEN
    RAISE EXCEPTION 'correction predecessor must be bound in immutable test evidence' USING ERRCODE = '23514';
  END IF;

  IF NEW."supersedesId" IS NOT NULL THEN
    SELECT * INTO predecessor
    FROM public."lab_tests"
    WHERE "id" = NEW."supersedesId"
    FOR SHARE;
    IF NOT FOUND OR predecessor."sampleId" <> NEW."sampleId"
       OR predecessor."parameter" <> method_record.parameter
    THEN
      RAISE EXCEPTION 'correction predecessor must be the same sample and parameter' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public."lab_tests" successor
      WHERE successor."supersedesId" = predecessor."id"
    ) THEN
      RAISE EXCEPTION 'laboratory fact already has a correction successor' USING ERRCODE = '23505';
    END IF;
  ELSIF EXISTS (
    SELECT 1
    FROM public."lab_tests" active
    WHERE active."sampleId" = NEW."sampleId"
      AND active."parameter" = method_record.parameter
      AND NOT EXISTS (
        SELECT 1 FROM public."lab_tests" successor
        WHERE successor."supersedesId" = active."id"
      )
  ) THEN
    RAISE EXCEPTION 'existing active test fact must be superseded, not overwritten' USING ERRCODE = '23514';
  END IF;

  NEW."tenantId" := sample_record."tenantId";
  NEW."parameter" := method_record.parameter;
  NEW."unit" := method_record.unit;
  NEW."normMinDec" := method_record.norm_min;
  NEW."normMaxDec" := method_record.norm_max;
  NEW."normMin" := method_record.norm_min::DOUBLE PRECISION;
  NEW."normMax" := method_record.norm_max::DOUBLE PRECISION;
  NEW."value" := NEW."valueDec"::DOUBLE PRECISION;
  NEW."passed" := (method_record.norm_min IS NULL OR NEW."valueDec" >= method_record.norm_min)
                  AND (method_record.norm_max IS NULL OR NEW."valueDec" <= method_record.norm_max);
  NEW."result" := CASE WHEN NEW."passed" THEN 'PASSED' ELSE 'FAILED' END;
  RETURN NEW;
END
$function$;
