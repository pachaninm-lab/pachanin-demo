-- IR-10.3 privileged laboratory authority provisioning.
-- Registry and admission writes are available only to trusted privileged Deal
-- contexts and remain tenant-bound by FORCE RLS.

DROP POLICY IF EXISTS labs_laboratories_admin_insert ON labs.laboratories;
CREATE POLICY labs_laboratories_admin_insert ON labs.laboratories
FOR INSERT WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_rls_privileged()
);
DROP POLICY IF EXISTS labs_laboratories_admin_update ON labs.laboratories;
CREATE POLICY labs_laboratories_admin_update ON labs.laboratories
FOR UPDATE USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_rls_privileged()
) WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_rls_privileged()
);

DROP POLICY IF EXISTS labs_authorized_actors_admin_insert ON labs.authorized_actors;
CREATE POLICY labs_authorized_actors_admin_insert ON labs.authorized_actors
FOR INSERT WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_rls_privileged()
);
DROP POLICY IF EXISTS labs_authorized_actors_admin_update ON labs.authorized_actors;
CREATE POLICY labs_authorized_actors_admin_update ON labs.authorized_actors
FOR UPDATE USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_rls_privileged()
) WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_rls_privileged()
);

DROP POLICY IF EXISTS labs_methods_admin_insert ON labs.methods;
CREATE POLICY labs_methods_admin_insert ON labs.methods
FOR INSERT WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_rls_privileged()
);
DROP POLICY IF EXISTS labs_methods_admin_update ON labs.methods;
CREATE POLICY labs_methods_admin_update ON labs.methods
FOR UPDATE USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_rls_privileged()
) WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_rls_privileged()
);

DROP POLICY IF EXISTS labs_equipment_admin_insert ON labs.equipment;
CREATE POLICY labs_equipment_admin_insert ON labs.equipment
FOR INSERT WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_rls_privileged()
);
DROP POLICY IF EXISTS labs_equipment_admin_update ON labs.equipment;
CREATE POLICY labs_equipment_admin_update ON labs.equipment
FOR UPDATE USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_rls_privileged()
) WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_rls_privileged()
);

DROP POLICY IF EXISTS labs_sample_admissions_admin_insert ON labs.sample_admissions;
CREATE POLICY labs_sample_admissions_admin_insert ON labs.sample_admissions
FOR INSERT WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_rls_privileged()
);
DROP POLICY IF EXISTS labs_sample_admissions_admin_update ON labs.sample_admissions;
CREATE POLICY labs_sample_admissions_admin_update ON labs.sample_admissions
FOR UPDATE USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_rls_privileged()
) WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_rls_privileged()
);

-- Admission evidence is bound to Deal + Shipment + Acceptance + Laboratory.
-- A sample identifier does not exist until the admission is atomically consumed.
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
       AND NOT public.app_labs_actor_valid(
         NEW."tenantId", NEW."labId", current_user_id, 'SAMPLER', now()
       )
     )
  THEN
    RAISE EXCEPTION 'authorized SAMPLER assignment is required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.app_labs_evidence_purpose_valid(
       NEW."latestEvidenceFileId", NEW."tenantId", NEW."dealId", 'ADMISSION',
       NULL, NEW."shipmentId", NEW."acceptanceId", NEW."labId", NULL
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
      AND public.app_labs_evidence_purpose_valid(
        laboratory.evidence_file_id, NEW."tenantId", NEW."dealId", 'LAB_AUTHORITY',
        NULL, NULL, NULL, NEW."labId", NULL
      )
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
  evidence_sample_id TEXT;
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
  evidence_sample_id := CASE WHEN NEW.event_type = 'CREATED' THEN NULL ELSE NEW.sample_id END;

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
       evidence_sample_id, sample_record."shipmentId", sample_record."acceptanceId",
       NEW.laboratory_org_id,
       CASE WHEN NEW.event_type = 'FINALIZED' THEN sample_record."protocol" ELSE NULL END
     )
  THEN
    RAISE EXCEPTION 'custody evidence is not purpose-bound to the exact operation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

DO $labs_authority_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT SELECT, INSERT, UPDATE ON labs.laboratories TO app_deal;
    GRANT SELECT, INSERT, UPDATE ON labs.authorized_actors TO app_deal;
    GRANT SELECT, INSERT, UPDATE ON labs.methods TO app_deal;
    GRANT SELECT, INSERT, UPDATE ON labs.equipment TO app_deal;
    GRANT SELECT, INSERT, UPDATE ON labs.sample_admissions TO app_deal;
  END IF;
END
$labs_authority_grants$;
