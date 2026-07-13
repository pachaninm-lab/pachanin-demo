-- IR-10.3 canonical finalize guard.
-- The legacy Deal command shape is retained as an input contract, while
-- PostgreSQL derives the authoritative protocol from persisted custody, methods,
-- calibrated equipment and immutable test facts. Client indicator rewrites are ignored.

CREATE OR REPLACE FUNCTION public.app_labs_sample_state_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, labs
AS $function$
DECLARE
  laboratory labs.laboratories%ROWTYPE;
  derived_result TEXT;
  derived_standard TEXT;
  protocol_id TEXT;
  command_id TEXT;
  previous_custody_hash TEXT;
  custody_material TEXT;
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."dealId" IS DISTINCT FROM OLD."dealId"
     OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
     OR NEW."shipmentId" IS DISTINCT FROM OLD."shipmentId"
     OR NEW."acceptanceId" IS DISTINCT FROM OLD."acceptanceId"
     OR NEW."sampleCode" IS DISTINCT FROM OLD."sampleCode"
     OR NEW."labId" IS DISTINCT FROM OLD."labId"
     OR NEW."assignedActorUserId" IS DISTINCT FROM OLD."assignedActorUserId"
  THEN
    RAISE EXCEPTION 'laboratory sample authority basis is immutable' USING ERRCODE = '23514';
  END IF;

  IF OLD."status" = 'FINALIZED' AND ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*) THEN
    RAISE EXCEPTION 'finalized laboratory sample is immutable' USING ERRCODE = '23514';
  END IF;

  -- Canonical Deal command historically emits DONE. Normalize it to the single
  -- industrial state without exposing a second state machine.
  IF NEW."status" = 'DONE' THEN
    NEW."status" := 'FINALIZED';
  END IF;

  IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
    (OLD."status" = 'CREATED' AND NEW."status" = 'COLLECTED') OR
    (OLD."status" = 'COLLECTED' AND NEW."status" = 'IN_TRANSIT') OR
    (OLD."status" = 'IN_TRANSIT' AND NEW."status" = 'RECEIVED') OR
    (OLD."status" = 'RECEIVED' AND NEW."status" = 'ANALYSIS_IN_PROGRESS') OR
    (OLD."status" IN ('PENDING','ANALYSIS_IN_PROGRESS') AND NEW."status" = 'FINALIZED')
  ) THEN
    RAISE EXCEPTION 'invalid laboratory sample state transition' USING ERRCODE = '23514';
  END IF;

  IF NEW."status" = 'FINALIZED' AND OLD."status" <> 'FINALIZED' THEN
    IF OLD."custodyStatus" NOT IN ('RECEIVED','OPENED','ANALYSIS_IN_PROGRESS') THEN
      RAISE EXCEPTION 'complete laboratory custody is required for finalization' USING ERRCODE = '23514';
    END IF;
    IF NEW."labId" IS NULL OR NEW."certificateDocId" IS NULL OR NEW."protocol" IS NULL THEN
      RAISE EXCEPTION 'protocol, laboratory and signed evidence are required' USING ERRCODE = '23514';
    END IF;

    SELECT * INTO laboratory
    FROM labs.laboratories candidate
    WHERE candidate.tenant_id = OLD."tenantId"
      AND candidate.organization_id = OLD."labId"
      AND candidate.status = 'ACTIVE'
      AND candidate.accreditation_status = 'VERIFIED'
      AND candidate.valid_from <= now()
      AND (candidate.valid_until IS NULL OR candidate.valid_until > now());
    IF NOT FOUND OR NOT public.app_labs_evidence_valid(
      laboratory.evidence_file_id, OLD."tenantId", OLD."dealId"
    ) THEN
      RAISE EXCEPTION 'active accredited laboratory authority is required' USING ERRCODE = '23514';
    END IF;

    IF NOT public.app_labs_evidence_valid(
      NEW."certificateDocId", OLD."tenantId", OLD."dealId"
    ) THEN
      RAISE EXCEPTION 'signed protocol evidence is not verified immutable Deal evidence' USING ERRCODE = '23514';
    END IF;

    IF current_setting('app.current_role', true) NOT IN ('LAB','SUPPORT_MANAGER','ADMIN') THEN
      RAISE EXCEPTION 'laboratory protocol finalization role denied' USING ERRCODE = '42501';
    END IF;
    IF current_setting('app.current_role', true) = 'LAB' AND (
      current_setting('app.current_org_id', true) <> OLD."labId"
      OR NOT EXISTS (
        SELECT 1 FROM labs.authorized_actors actor
        WHERE actor.tenant_id = OLD."tenantId"
          AND actor.laboratory_org_id = OLD."labId"
          AND actor.user_id = current_setting('app.current_user_id', true)
          AND actor.actor_type IN ('ANALYST','SIGNATORY')
          AND actor.status = 'ACTIVE'
          AND actor.valid_from <= now()
          AND (actor.valid_until IS NULL OR actor.valid_until > now())
      )
    ) THEN
      RAISE EXCEPTION 'authorized laboratory signatory is required' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public."lab_tests" test
      JOIN labs.methods method ON method.id = test."methodId"
      JOIN labs.equipment equipment ON equipment.id = test."equipmentId"
      WHERE test."sampleId" = OLD."id"
        AND test."tenantId" = OLD."tenantId"
        AND test."evidenceFileId" IS NOT NULL
        AND test."actorUserId" IS NOT NULL
        AND test."commandId" IS NOT NULL
        AND test."idempotencyKey" IS NOT NULL
        AND method.tenant_id = OLD."tenantId"
        AND method.laboratory_org_id = OLD."labId"
        AND method.status = 'ACTIVE'
        AND equipment.tenant_id = OLD."tenantId"
        AND equipment.laboratory_org_id = OLD."labId"
        AND equipment.status = 'ACTIVE'
        AND equipment.calibration_valid_until > test."recordedAt"
        AND public.app_labs_evidence_valid(test."evidenceFileId", OLD."tenantId", OLD."dealId")
    ) THEN
      RAISE EXCEPTION 'at least one persisted authoritative laboratory test is required' USING ERRCODE = '23514';
    END IF;

    SELECT
      CASE WHEN bool_and(test."result" = 'PASSED') THEN 'PASSED' ELSE 'FAILED' END,
      string_agg(DISTINCT method.standard_ref, ',' ORDER BY method.standard_ref)
    INTO derived_result, derived_standard
    FROM public."lab_tests" test
    JOIN labs.methods method ON method.id = test."methodId"
    WHERE test."sampleId" = OLD."id"
      AND test."tenantId" = OLD."tenantId";

    IF derived_result IS NULL OR derived_standard IS NULL THEN
      RAISE EXCEPTION 'protocol result and standard cannot be derived' USING ERRCODE = '23514';
    END IF;

    command_id := current_setting('app.current_command_id', true);
    IF command_id IS NULL OR command_id = '' THEN
      RAISE EXCEPTION 'trusted command id is required for protocol finalization' USING ERRCODE = '23514';
    END IF;

    NEW."protocolResult" := derived_result;
    NEW."gost" := derived_standard;
    NEW."labName" := (
      SELECT organization.name FROM public."organizations" organization
      WHERE organization."id" = OLD."labId"
    );
    NEW."custodyStatus" := 'FINALIZED';
    NEW."finalizedAt" := COALESCE(NEW."finalizedAt", now());
    NEW."latestEvidenceFileId" := NEW."certificateDocId";
    NEW."version" := OLD."version" + 1;
    NEW."updatedAt" := now();

    protocol_id := 'lab-protocol-' || md5(OLD."id" || ':' || command_id);
    INSERT INTO labs.protocols (
      id, sample_id, tenant_id, protocol_number, laboratory_org_id,
      accreditation_ref, standard_ref, result, signed_evidence_file_id,
      finalized_by_user_id, finalized_at, version
    ) VALUES (
      protocol_id, OLD."id", OLD."tenantId", NEW."protocol", OLD."labId",
      laboratory.accreditation_ref, derived_standard, derived_result,
      NEW."certificateDocId", current_setting('app.current_user_id', true),
      NEW."finalizedAt", 1
    );

    SELECT event.hash INTO previous_custody_hash
    FROM labs.sample_custody_events event
    WHERE event.sample_id = OLD."id"
    ORDER BY event.occurred_at DESC, event.id DESC
    LIMIT 1;

    custody_material := concat_ws('|',
      OLD."id", OLD."tenantId", 'FINALIZED', OLD."status", 'FINALIZED',
      current_setting('app.current_user_id', true), OLD."labId",
      NEW."certificateDocId", command_id, previous_custody_hash
    );
    INSERT INTO labs.sample_custody_events (
      id, sample_id, tenant_id, event_type, from_status, to_status,
      actor_user_id, laboratory_org_id, evidence_file_id, command_id,
      idempotency_key, correlation_id, occurred_at, note, prev_hash, hash
    ) VALUES (
      'lab-custody-' || md5(OLD."id" || ':' || command_id || ':finalized'),
      OLD."id", OLD."tenantId", 'FINALIZED', OLD."status", 'FINALIZED',
      current_setting('app.current_user_id', true), OLD."labId",
      NEW."certificateDocId", command_id,
      'labs:' || OLD."tenantId" || ':' || current_setting('app.current_user_id', true) || ':' || command_id || ':finalize:custody',
      command_id, NEW."finalizedAt", 'Protocol finalized from persisted authoritative tests',
      previous_custody_hash, encode(digest(custody_material, 'sha256'), 'hex')
    );
  END IF;

  RETURN NEW;
END
$function$;

-- Existing canonical code attempts delete/recreate after updating the sample.
-- Never delete confirmed tests. Returning NULL makes the legacy delete a no-op;
-- a subsequent insert against a FINALIZED sample is also ignored by the insert guard.
CREATE OR REPLACE FUNCTION public.app_labs_test_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN NULL;
  END IF;
  RAISE EXCEPTION 'confirmed laboratory test facts are append-only' USING ERRCODE = '23514';
END
$function$;
DROP TRIGGER IF EXISTS lab_tests_append_only ON public."lab_tests";
CREATE TRIGGER lab_tests_append_only
BEFORE UPDATE OR DELETE ON public."lab_tests"
FOR EACH ROW EXECUTE FUNCTION public.app_labs_test_append_only();

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
BEGIN
  SELECT * INTO sample_record FROM public."lab_samples" WHERE "id" = NEW."sampleId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'laboratory sample does not exist' USING ERRCODE = '23503';
  END IF;
  IF sample_record."status" = 'FINALIZED' THEN
    RETURN NULL;
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
     OR method_record.status <> 'ACTIVE' OR equipment_record.status <> 'ACTIVE'
     OR equipment_record.calibration_valid_until <= now()
  THEN
    RAISE EXCEPTION 'laboratory method or equipment authority is invalid' USING ERRCODE = '23514';
  END IF;
  IF NEW."actorUserId" <> current_setting('app.current_user_id', true)
     OR NOT public.app_labs_evidence_valid(NEW."evidenceFileId", sample_record."tenantId", sample_record."dealId")
  THEN
    RAISE EXCEPTION 'laboratory test actor or evidence authority is invalid' USING ERRCODE = '23514';
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

CREATE OR REPLACE FUNCTION public.app_labs_acceptance_quality_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, labs
AS $function$
DECLARE
  authoritative_result TEXT;
BEGIN
  IF NEW."qualityStatus" IS DISTINCT FROM OLD."qualityStatus"
     AND NEW."qualityStatus" IN ('PASSED','FAILED') THEN
    SELECT sample."protocolResult" INTO authoritative_result
    FROM public."lab_samples" sample
    WHERE sample."dealId" = NEW."dealId"
      AND sample."shipmentId" = NEW."shipmentId"
      AND sample."status" = 'FINALIZED'
    ORDER BY sample."finalizedAt" DESC, sample."id" DESC
    LIMIT 1;
    IF authoritative_result IS NULL THEN
      RAISE EXCEPTION 'finalized authoritative laboratory protocol is required' USING ERRCODE = '23514';
    END IF;
    NEW."qualityStatus" := authoritative_result;
    NEW."gost" := (
      SELECT sample."gost"
      FROM public."lab_samples" sample
      WHERE sample."dealId" = NEW."dealId"
        AND sample."shipmentId" = NEW."shipmentId"
        AND sample."status" = 'FINALIZED'
      ORDER BY sample."finalizedAt" DESC, sample."id" DESC
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS acceptance_records_lab_quality_guard ON public."acceptance_records";
CREATE TRIGGER acceptance_records_lab_quality_guard
BEFORE UPDATE OF "qualityStatus", "gost" ON public."acceptance_records"
FOR EACH ROW EXECUTE FUNCTION public.app_labs_acceptance_quality_guard();
