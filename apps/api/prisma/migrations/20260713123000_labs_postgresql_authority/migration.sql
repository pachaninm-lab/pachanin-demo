-- IR-10.3 strict laboratory authority corrections.
-- This additive migration removes legacy compatibility shortcuts and makes actor,
-- evidence, correction and protocol authority explicit and fail-closed.

ALTER TABLE labs.authorized_actors
  DROP CONSTRAINT IF EXISTS labs_authorized_actors_tenant_user_key;
CREATE UNIQUE INDEX IF NOT EXISTS labs_authorized_actors_assignment_key
  ON labs.authorized_actors (tenant_id, laboratory_org_id, user_id, actor_type);

CREATE UNIQUE INDEX IF NOT EXISTS lab_tests_one_successor_key
  ON public."lab_tests" ("supersedesId")
  WHERE "supersedesId" IS NOT NULL;

CREATE OR REPLACE FUNCTION public.app_labs_actor_valid(
  p_tenant_id TEXT,
  p_laboratory_org_id TEXT,
  p_user_id TEXT,
  p_actor_type TEXT,
  p_at TIMESTAMPTZ DEFAULT now()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, labs
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM labs.authorized_actors actor
    WHERE actor.tenant_id = p_tenant_id
      AND actor.laboratory_org_id = p_laboratory_org_id
      AND actor.user_id = p_user_id
      AND actor.actor_type = p_actor_type
      AND actor.status = 'ACTIVE'
      AND actor.valid_from <= p_at
      AND (actor.valid_until IS NULL OR actor.valid_until > p_at)
  )
$function$;

CREATE OR REPLACE FUNCTION public.app_labs_evidence_purpose_valid(
  p_evidence_id TEXT,
  p_tenant_id TEXT,
  p_deal_id TEXT,
  p_purpose TEXT,
  p_sample_id TEXT DEFAULT NULL,
  p_shipment_id TEXT DEFAULT NULL,
  p_acceptance_id TEXT DEFAULT NULL,
  p_laboratory_org_id TEXT DEFAULT NULL,
  p_protocol_number TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public."deal_documents" evidence
    WHERE evidence."id" = p_evidence_id
      AND public.app_labs_evidence_valid(evidence."id", p_tenant_id, p_deal_id)
      AND evidence."metadata" IS NOT NULL
      AND upper(COALESCE(evidence."metadata" ->> 'labPurpose', '')) = upper(p_purpose)
      AND (p_sample_id IS NULL OR evidence."metadata" ->> 'sampleId' = p_sample_id)
      AND (p_shipment_id IS NULL OR evidence."metadata" ->> 'shipmentId' = p_shipment_id)
      AND (p_acceptance_id IS NULL OR evidence."metadata" ->> 'acceptanceId' = p_acceptance_id)
      AND (p_laboratory_org_id IS NULL OR evidence."metadata" ->> 'laboratoryOrgId' = p_laboratory_org_id)
      AND (p_protocol_number IS NULL OR evidence."metadata" ->> 'protocolNumber' = p_protocol_number)
  )
$function$;

CREATE OR REPLACE FUNCTION public.app_labs_deal_authorized(
  p_deal_id TEXT,
  p_laboratory_org_id TEXT DEFAULT NULL,
  p_write BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, labs
AS $function$
  SELECT public.app_rls_context_ready()
    AND (
      public.app_rls_privileged()
      OR EXISTS (
        SELECT 1
        FROM public."deal_participants" participant
        WHERE participant."dealId" = p_deal_id
          AND participant."tenantId" = current_setting('app.current_tenant_id', true)
          AND participant."organizationId" = current_setting('app.current_org_id', true)
          AND participant."userId" = current_setting('app.current_user_id', true)
          AND participant."role" = current_setting('app.current_role', true)
          AND participant."status" = 'ACTIVE'
          AND participant."accessLevel" IN (
            CASE WHEN p_write THEN 'WORK' ELSE 'READ' END,
            CASE WHEN p_write THEN 'APPROVE' ELSE 'WORK' END,
            'APPROVE'
          )
      )
    )
    AND (
      NOT p_write
      OR public.app_rls_privileged()
      OR (
        p_laboratory_org_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM labs.authorized_actors actor
          WHERE actor.tenant_id = current_setting('app.current_tenant_id', true)
            AND actor.laboratory_org_id = p_laboratory_org_id
            AND actor.user_id = current_setting('app.current_user_id', true)
            AND actor.status = 'ACTIVE'
            AND actor.valid_from <= now()
            AND (actor.valid_until IS NULL OR actor.valid_until > now())
        )
      )
    )
$function$;

CREATE OR REPLACE FUNCTION public.app_labs_validate_sample_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, labs
AS $function$
DECLARE
  admission labs.sample_admissions%ROWTYPE;
  current_user_id TEXT := current_setting('app.current_user_id', true);
BEGIN
  IF NEW."shipmentId" IS NULL OR NEW."acceptanceId" IS NULL
     OR NEW."labId" IS NULL OR NEW."assignedActorUserId" IS NULL
     OR NEW."latestEvidenceFileId" IS NULL OR NEW."status" <> 'CREATED'
     OR NEW."custodyStatus" <> 'CREATED'
  THEN
    RAISE EXCEPTION 'new laboratory sample requires canonical CREATED admission fields' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO admission
  FROM labs.sample_admissions candidate
  WHERE candidate.tenant_id = NEW."tenantId"
    AND candidate.deal_id = NEW."dealId"
    AND candidate.shipment_id = NEW."shipmentId"
    AND candidate.acceptance_id = NEW."acceptanceId"
    AND candidate.laboratory_org_id = NEW."labId"
    AND candidate.status = 'ACTIVE'
    AND candidate.valid_from <= now()
    AND (candidate.valid_until IS NULL OR candidate.valid_until > now())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'active normalized laboratory sample admission not found' USING ERRCODE = '23514';
  END IF;
  IF NEW."assignedActorUserId" <> current_user_id
     OR (
       NOT public.app_rls_privileged()
       AND NOT public.app_labs_actor_valid(NEW."tenantId", NEW."labId", current_user_id, 'SAMPLER', now())
     )
  THEN
    RAISE EXCEPTION 'authorized SAMPLER assignment is required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.app_labs_evidence_purpose_valid(
       NEW."latestEvidenceFileId", NEW."tenantId", NEW."dealId", 'ADMISSION',
       NEW."id", NEW."shipmentId", NEW."acceptanceId", NEW."labId", NULL
     )
  THEN
    RAISE EXCEPTION 'sample evidence is not purpose-bound to the exact admission' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM labs.laboratories laboratory
    JOIN public."organizations" organization ON organization."id" = laboratory.organization_id
    WHERE laboratory.tenant_id = NEW."tenantId"
      AND laboratory.organization_id = NEW."labId"
      AND laboratory.status = 'ACTIVE'
      AND laboratory.accreditation_status = 'VERIFIED'
      AND laboratory.valid_from <= now()
      AND (laboratory.valid_until IS NULL OR laboratory.valid_until > now())
      AND organization."tenantId" = NEW."tenantId"
      AND organization."status" = 'VERIFIED'
      AND organization."kycStatus" = 'APPROVED'
      AND public.app_labs_evidence_valid(laboratory.evidence_file_id, NEW."tenantId", NEW."dealId")
  ) THEN
    RAISE EXCEPTION 'laboratory is not active and accredited' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.app_labs_validate_custody_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, labs
AS $function$
DECLARE
  sample_record public."lab_samples"%ROWTYPE;
  required_actor_type TEXT;
  required_purpose TEXT;
BEGIN
  SELECT * INTO sample_record
  FROM public."lab_samples"
  WHERE "id" = NEW.sample_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'laboratory custody sample does not exist' USING ERRCODE = '23503';
  END IF;
  IF NEW.tenant_id <> sample_record."tenantId"
     OR NEW.laboratory_org_id <> sample_record."labId"
     OR NEW.actor_user_id <> current_setting('app.current_user_id', true)
  THEN
    RAISE EXCEPTION 'laboratory custody authority mismatch' USING ERRCODE = '42501';
  END IF;

  required_actor_type := CASE NEW.event_type
    WHEN 'CREATED' THEN 'SAMPLER'
    WHEN 'COLLECTED' THEN 'SAMPLER'
    WHEN 'SEALED' THEN 'COURIER'
    WHEN 'HANDOFF' THEN 'COURIER'
    WHEN 'RECEIVED' THEN 'RECEIVER'
    WHEN 'OPENED' THEN 'ANALYST'
    WHEN 'FINALIZED' THEN 'SIGNATORY'
    ELSE NULL
  END;
  required_purpose := CASE NEW.event_type
    WHEN 'CREATED' THEN 'ADMISSION'
    WHEN 'COLLECTED' THEN 'COLLECTION'
    ELSE NEW.event_type
  END;
  IF required_actor_type IS NULL THEN
    RAISE EXCEPTION 'unsupported custody event type' USING ERRCODE = '23514';
  END IF;
  IF NOT public.app_rls_privileged()
     AND NOT public.app_labs_actor_valid(
       NEW.tenant_id, NEW.laboratory_org_id, NEW.actor_user_id,
       required_actor_type, NEW.occurred_at
     )
  THEN
    RAISE EXCEPTION 'custody actor type is not authorized for operation' USING ERRCODE = '42501';
  END IF;
  IF NOT public.app_labs_evidence_purpose_valid(
       NEW.evidence_file_id, NEW.tenant_id, sample_record."dealId", required_purpose,
       NEW.sample_id, sample_record."shipmentId", sample_record."acceptanceId",
       NEW.laboratory_org_id,
       CASE WHEN NEW.event_type = 'FINALIZED' THEN sample_record."protocol" ELSE NULL END
     )
  THEN
    RAISE EXCEPTION 'custody evidence is not purpose-bound to the exact operation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS labs_custody_validate_insert ON labs.sample_custody_events;
CREATE TRIGGER labs_custody_validate_insert
BEFORE INSERT ON labs.sample_custody_events
FOR EACH ROW EXECUTE FUNCTION public.app_labs_validate_custody_insert();

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
  required_actor_type TEXT;
  required_purpose TEXT;
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
  IF NEW."status" = 'DONE' OR OLD."status" = 'PENDING' OR NEW."status" = 'PENDING' THEN
    RAISE EXCEPTION 'legacy laboratory states are forbidden' USING ERRCODE = '23514';
  END IF;
  IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
    (OLD."status" = 'CREATED' AND NEW."status" = 'COLLECTED') OR
    (OLD."status" = 'COLLECTED' AND NEW."status" = 'IN_TRANSIT') OR
    (OLD."status" = 'IN_TRANSIT' AND NEW."status" = 'RECEIVED') OR
    (OLD."status" = 'RECEIVED' AND NEW."status" = 'ANALYSIS_IN_PROGRESS') OR
    (OLD."status" = 'ANALYSIS_IN_PROGRESS' AND NEW."status" = 'FINALIZED')
  ) THEN
    RAISE EXCEPTION 'invalid laboratory sample state transition' USING ERRCODE = '23514';
  END IF;

  required_actor_type := CASE
    WHEN OLD."status" = 'CREATED' AND NEW."status" = 'COLLECTED' THEN 'SAMPLER'
    WHEN OLD."status" = 'COLLECTED' AND NEW."status" = 'IN_TRANSIT' THEN 'COURIER'
    WHEN OLD."status" = 'IN_TRANSIT' AND NEW."status" = 'RECEIVED' THEN 'RECEIVER'
    WHEN OLD."status" = 'RECEIVED' AND NEW."status" = 'ANALYSIS_IN_PROGRESS' THEN 'ANALYST'
    WHEN OLD."status" = 'ANALYSIS_IN_PROGRESS' AND NEW."status" = 'FINALIZED' THEN 'SIGNATORY'
    WHEN OLD."status" = NEW."status" AND NEW."custodyStatus" = 'SEALED' AND OLD."custodyStatus" <> 'SEALED' THEN 'COURIER'
    WHEN OLD."status" = NEW."status" AND NEW."custodyStatus" = 'OPENED' AND OLD."custodyStatus" <> 'OPENED' THEN 'ANALYST'
    ELSE NULL
  END;
  required_purpose := CASE
    WHEN OLD."status" = 'CREATED' AND NEW."status" = 'COLLECTED' THEN 'COLLECTION'
    WHEN OLD."status" = 'COLLECTED' AND NEW."status" = 'IN_TRANSIT' THEN 'HANDOFF'
    WHEN OLD."status" = 'IN_TRANSIT' AND NEW."status" = 'RECEIVED' THEN 'RECEIVED'
    WHEN OLD."status" = 'RECEIVED' AND NEW."status" = 'ANALYSIS_IN_PROGRESS' THEN
      CASE WHEN NEW."custodyStatus" = 'OPENED' THEN 'OPENED' ELSE 'TEST' END
    WHEN OLD."status" = 'ANALYSIS_IN_PROGRESS' AND NEW."status" = 'FINALIZED' THEN 'PROTOCOL'
    WHEN OLD."status" = NEW."status" AND NEW."custodyStatus" = 'SEALED' AND OLD."custodyStatus" <> 'SEALED' THEN 'SEALED'
    WHEN OLD."status" = NEW."status" AND NEW."custodyStatus" = 'OPENED' AND OLD."custodyStatus" <> 'OPENED' THEN 'OPENED'
    ELSE NULL
  END;

  IF required_actor_type IS NOT NULL AND NOT public.app_rls_privileged()
     AND NOT public.app_labs_actor_valid(
       OLD."tenantId", OLD."labId", current_setting('app.current_user_id', true),
       required_actor_type, now()
     )
  THEN
    RAISE EXCEPTION 'laboratory actor type is not authorized for state transition' USING ERRCODE = '42501';
  END IF;
  IF required_purpose IS NOT NULL
     AND NOT public.app_labs_evidence_purpose_valid(
       CASE WHEN required_purpose = 'PROTOCOL' THEN NEW."certificateDocId" ELSE NEW."latestEvidenceFileId" END,
       OLD."tenantId", OLD."dealId", required_purpose,
       OLD."id", OLD."shipmentId", OLD."acceptanceId", OLD."labId",
       CASE WHEN required_purpose = 'PROTOCOL' THEN NEW."protocol" ELSE NULL END
     )
  THEN
    RAISE EXCEPTION 'state transition evidence is not purpose-bound' USING ERRCODE = '23514';
  END IF;

  IF NEW."status" = 'FINALIZED' AND OLD."status" <> 'FINALIZED' THEN
    IF NEW."finalizedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'client-authored laboratory finalization time is forbidden' USING ERRCODE = '23514';
    END IF;
    IF OLD."custodyStatus" NOT IN ('OPENED','ANALYSIS_IN_PROGRESS')
       OR NEW."labId" IS NULL OR NEW."certificateDocId" IS NULL OR NEW."protocol" IS NULL
    THEN
      RAISE EXCEPTION 'complete custody, protocol and signed evidence are required' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM labs.sample_custody_events event
      WHERE event.sample_id = OLD."id" AND event.event_type = 'COLLECTED'
    ) OR NOT EXISTS (
      SELECT 1 FROM labs.sample_custody_events event
      WHERE event.sample_id = OLD."id" AND event.event_type = 'HANDOFF'
    ) OR NOT EXISTS (
      SELECT 1 FROM labs.sample_custody_events event
      WHERE event.sample_id = OLD."id" AND event.event_type = 'RECEIVED'
    ) OR NOT EXISTS (
      SELECT 1 FROM labs.sample_custody_events event
      WHERE event.sample_id = OLD."id" AND event.event_type = 'OPENED'
    ) THEN
      RAISE EXCEPTION 'complete persisted custody chain is required for finalization' USING ERRCODE = '23514';
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
    IF NOT public.app_labs_actor_valid(
      OLD."tenantId", OLD."labId", current_setting('app.current_user_id', true), 'SIGNATORY', now()
    ) AND NOT public.app_rls_privileged() THEN
      RAISE EXCEPTION 'authorized SIGNATORY assignment is required' USING ERRCODE = '42501';
    END IF;
    IF NOT public.app_labs_evidence_purpose_valid(
      NEW."certificateDocId", OLD."tenantId", OLD."dealId", 'PROTOCOL',
      OLD."id", OLD."shipmentId", OLD."acceptanceId", OLD."labId", NEW."protocol"
    ) THEN
      RAISE EXCEPTION 'signed protocol evidence is not bound to the exact sample and protocol' USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public."lab_tests" test
      JOIN labs.methods method ON method.id = test."methodId"
      JOIN labs.equipment equipment ON equipment.id = test."equipmentId"
      WHERE test."sampleId" = OLD."id"
        AND test."tenantId" = OLD."tenantId"
        AND NOT EXISTS (
          SELECT 1 FROM public."lab_tests" successor
          WHERE successor."supersedesId" = test."id"
        )
        AND method.tenant_id = OLD."tenantId"
        AND method.laboratory_org_id = OLD."labId"
        AND method.status = 'ACTIVE'
        AND equipment.tenant_id = OLD."tenantId"
        AND equipment.laboratory_org_id = OLD."labId"
        AND equipment.status = 'ACTIVE'
        AND equipment.calibration_valid_until > test."recordedAt"
        AND public.app_labs_actor_valid(
          OLD."tenantId", OLD."labId", test."actorUserId", 'ANALYST', test."recordedAt"
        )
        AND public.app_labs_evidence_purpose_valid(
          test."evidenceFileId", OLD."tenantId", OLD."dealId", 'TEST',
          OLD."id", OLD."shipmentId", OLD."acceptanceId", OLD."labId", NULL
        )
    ) THEN
      RAISE EXCEPTION 'at least one active authoritative laboratory test is required' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT test."parameter"
      FROM public."lab_tests" test
      WHERE test."sampleId" = OLD."id"
        AND NOT EXISTS (
          SELECT 1 FROM public."lab_tests" successor
          WHERE successor."supersedesId" = test."id"
        )
      GROUP BY test."parameter"
      HAVING count(*) <> 1
    ) THEN
      RAISE EXCEPTION 'protocol requires one deterministic active fact per parameter' USING ERRCODE = '23514';
    END IF;

    SELECT
      CASE WHEN bool_and(test."result" = 'PASSED') THEN 'PASSED' ELSE 'FAILED' END,
      string_agg(DISTINCT method.standard_ref, ',' ORDER BY method.standard_ref)
    INTO derived_result, derived_standard
    FROM public."lab_tests" test
    JOIN labs.methods method ON method.id = test."methodId"
    WHERE test."sampleId" = OLD."id"
      AND test."tenantId" = OLD."tenantId"
      AND NOT EXISTS (
        SELECT 1 FROM public."lab_tests" successor
        WHERE successor."supersedesId" = test."id"
      );
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
    NEW."finalizedAt" := clock_timestamp();
    NEW."latestEvidenceFileId" := NEW."certificateDocId";
    NEW."version" := OLD."version" + 1;
    NEW."updatedAt" := clock_timestamp();

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
      command_id, NEW."finalizedAt", 'Protocol finalized from active authoritative tests',
      previous_custody_hash, encode(digest(custody_material, 'sha256'), 'hex')
    );
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.app_labs_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, labs
AS $function$
BEGIN
  RAISE EXCEPTION 'confirmed laboratory facts are append-only' USING ERRCODE = '23514';
END
$function$;
DROP TRIGGER IF EXISTS lab_tests_append_only ON public."lab_tests";
CREATE TRIGGER lab_tests_append_only
BEFORE UPDATE OR DELETE ON public."lab_tests"
FOR EACH ROW EXECUTE FUNCTION public.app_labs_append_only();
DROP TRIGGER IF EXISTS labs_custody_append_only ON labs.sample_custody_events;
CREATE TRIGGER labs_custody_append_only
BEFORE UPDATE OR DELETE ON labs.sample_custody_events
FOR EACH ROW EXECUTE FUNCTION public.app_labs_append_only();
DROP TRIGGER IF EXISTS labs_protocols_append_only ON labs.protocols;
CREATE TRIGGER labs_protocols_append_only
BEFORE UPDATE OR DELETE ON labs.protocols
FOR EACH ROW EXECUTE FUNCTION public.app_labs_append_only();

DROP POLICY IF EXISTS labs_authorized_actors_select ON labs.authorized_actors;
CREATE POLICY labs_authorized_actors_select ON labs.authorized_actors FOR SELECT USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND (user_id = current_setting('app.current_user_id', true) OR public.app_rls_privileged())
);
DROP POLICY IF EXISTS labs_methods_select ON labs.methods;
CREATE POLICY labs_methods_select ON labs.methods FOR SELECT USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND (
    public.app_rls_privileged()
    OR EXISTS (
      SELECT 1 FROM labs.authorized_actors actor
      WHERE actor.tenant_id = labs.methods.tenant_id
        AND actor.laboratory_org_id = labs.methods.laboratory_org_id
        AND actor.user_id = current_setting('app.current_user_id', true)
        AND actor.status = 'ACTIVE'
    )
  )
);
DROP POLICY IF EXISTS labs_equipment_select ON labs.equipment;
CREATE POLICY labs_equipment_select ON labs.equipment FOR SELECT USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND (
    public.app_rls_privileged()
    OR EXISTS (
      SELECT 1 FROM labs.authorized_actors actor
      WHERE actor.tenant_id = labs.equipment.tenant_id
        AND actor.laboratory_org_id = labs.equipment.laboratory_org_id
        AND actor.user_id = current_setting('app.current_user_id', true)
        AND actor.status = 'ACTIVE'
    )
  )
);

DO $labs_strict_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT EXECUTE ON FUNCTION public.app_labs_actor_valid(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO app_deal;
    GRANT EXECUTE ON FUNCTION public.app_labs_evidence_purpose_valid(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO app_deal;
  END IF;
END
$labs_strict_grants$;
