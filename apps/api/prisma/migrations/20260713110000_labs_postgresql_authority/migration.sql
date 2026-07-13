-- IR-10.3 Labs PostgreSQL Authority.
-- Laboratory assignment, accreditation, methods, equipment, custody, tests and
-- protocol finalization are PostgreSQL-authoritative. External LIMS and live
-- accreditation providers are not activated by this migration.

CREATE SCHEMA IF NOT EXISTS labs;
REVOKE ALL ON SCHEMA labs FROM PUBLIC;

CREATE TABLE IF NOT EXISTS public."lab_assignments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "labOrgId" TEXT NOT NULL,
  "labUserId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3),
  "evidenceRef" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lab_assignments_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES public."deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "lab_assignments_labOrgId_fkey" FOREIGN KEY ("labOrgId") REFERENCES public."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "lab_assignments_labUserId_fkey" FOREIGN KEY ("labUserId") REFERENCES public."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "lab_assignments_evidenceRef_fkey" FOREIGN KEY ("evidenceRef") REFERENCES public."evidence_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "lab_assignments_status_check" CHECK ("status" IN ('ACTIVE','SUSPENDED','REVOKED','EXPIRED')),
  CONSTRAINT "lab_assignments_deal_user_key" UNIQUE ("dealId", "labUserId")
);
CREATE INDEX IF NOT EXISTS "lab_assignments_tenant_lab_status_idx" ON public."lab_assignments" ("tenantId", "labOrgId", "status");
CREATE INDEX IF NOT EXISTS "lab_assignments_user_status_idx" ON public."lab_assignments" ("labUserId", "status");

CREATE TABLE IF NOT EXISTS public."lab_accreditations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "labOrgId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "scope" JSONB,
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validUntil" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "evidenceRef" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lab_accreditations_labOrgId_fkey" FOREIGN KEY ("labOrgId") REFERENCES public."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "lab_accreditations_evidenceRef_fkey" FOREIGN KEY ("evidenceRef") REFERENCES public."evidence_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "lab_accreditations_status_check" CHECK ("status" IN ('ACTIVE','SUSPENDED','REVOKED','EXPIRED')),
  CONSTRAINT "lab_accreditations_tenant_org_reference_key" UNIQUE ("tenantId", "labOrgId", "reference")
);
CREATE INDEX IF NOT EXISTS "lab_accreditations_org_status_idx" ON public."lab_accreditations" ("labOrgId", "status");

CREATE TABLE IF NOT EXISTS public."lab_methods" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "labOrgId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "applicableStandard" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3),
  "evidenceRef" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lab_methods_labOrgId_fkey" FOREIGN KEY ("labOrgId") REFERENCES public."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "lab_methods_evidenceRef_fkey" FOREIGN KEY ("evidenceRef") REFERENCES public."evidence_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "lab_methods_status_check" CHECK ("status" IN ('ACTIVE','SUSPENDED','REVOKED','EXPIRED')),
  CONSTRAINT "lab_methods_tenant_org_code_key" UNIQUE ("tenantId", "labOrgId", "code")
);
CREATE INDEX IF NOT EXISTS "lab_methods_org_status_idx" ON public."lab_methods" ("labOrgId", "status");

CREATE TABLE IF NOT EXISTS public."lab_equipment" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "labOrgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "serialNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "calibratedAt" TIMESTAMP(3),
  "calibrationValidUntil" TIMESTAMP(3),
  "calibrationEvidenceRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lab_equipment_labOrgId_fkey" FOREIGN KEY ("labOrgId") REFERENCES public."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "lab_equipment_calibrationEvidenceRef_fkey" FOREIGN KEY ("calibrationEvidenceRef") REFERENCES public."evidence_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "lab_equipment_status_check" CHECK ("status" IN ('ACTIVE','SUSPENDED','REVOKED','EXPIRED','CALIBRATION_DUE')),
  CONSTRAINT "lab_equipment_tenant_org_serial_key" UNIQUE ("tenantId", "labOrgId", "serialNumber")
);
CREATE INDEX IF NOT EXISTS "lab_equipment_org_status_idx" ON public."lab_equipment" ("labOrgId", "status");

ALTER TABLE public."lab_samples"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedLabUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "samplerUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "currentCustodianOrgId" TEXT,
  ADD COLUMN IF NOT EXISTS "currentCustodianUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "accreditationId" TEXT,
  ADD COLUMN IF NOT EXISTS "finalizedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "protocolHash" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE public."lab_samples" sample
SET "tenantId" = deal."tenantId",
    "labId" = COALESCE(
      NULLIF(sample."labId", ''),
      (SELECT participant."organizationId" FROM public."deal_participants" participant
       WHERE participant."dealId" = sample."dealId" AND participant."role" = 'LAB' AND participant."status" = 'ACTIVE'
       ORDER BY participant."assignedAt" ASC LIMIT 1)
    ),
    "assignedLabUserId" = COALESCE(
      NULLIF(sample."assignedLabUserId", ''),
      (SELECT participant."userId" FROM public."deal_participants" participant
       WHERE participant."dealId" = sample."dealId" AND participant."role" = 'LAB' AND participant."status" = 'ACTIVE'
       ORDER BY participant."assignedAt" ASC LIMIT 1)
    )
FROM public."deals" deal
WHERE deal."id" = sample."dealId";

UPDATE public."lab_samples"
SET "currentCustodianOrgId" = COALESCE(NULLIF("currentCustodianOrgId", ''), "labId"),
    "currentCustodianUserId" = COALESCE(NULLIF("currentCustodianUserId", ''), "assignedLabUserId"),
    "status" = CASE
      WHEN "status" IN ('DONE','FINALIZED') THEN 'FINALIZED'
      WHEN "status" = 'PENDING' AND "collectedAt" IS NOT NULL THEN 'COLLECTED'
      ELSE "status"
    END;

DO $lab_sample_backfill$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public."lab_samples"
    WHERE "tenantId" IS NULL OR "labId" IS NULL OR "assignedLabUserId" IS NULL
       OR "currentCustodianOrgId" IS NULL OR "currentCustodianUserId" IS NULL
  ) THEN
    RAISE EXCEPTION 'lab_samples authority backfill is incomplete; assign an active LAB participant before migration';
  END IF;
END
$lab_sample_backfill$;

ALTER TABLE public."lab_samples"
  ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.current_tenant_id'::text, true),
  ALTER COLUMN "tenantId" SET NOT NULL,
  ALTER COLUMN "labId" SET DEFAULT current_setting('app.current_org_id'::text, true),
  ALTER COLUMN "labId" SET NOT NULL,
  ALTER COLUMN "assignedLabUserId" SET DEFAULT current_setting('app.current_user_id'::text, true),
  ALTER COLUMN "assignedLabUserId" SET NOT NULL,
  ALTER COLUMN "currentCustodianOrgId" SET DEFAULT current_setting('app.current_org_id'::text, true),
  ALTER COLUMN "currentCustodianOrgId" SET NOT NULL,
  ALTER COLUMN "currentCustodianUserId" SET DEFAULT current_setting('app.current_user_id'::text, true),
  ALTER COLUMN "currentCustodianUserId" SET NOT NULL,
  ALTER COLUMN "version" TYPE BIGINT USING "version"::BIGINT,
  ALTER COLUMN "version" SET DEFAULT 0;

ALTER TABLE public."lab_samples"
  ADD CONSTRAINT "lab_samples_labId_fkey" FOREIGN KEY ("labId") REFERENCES public."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "lab_samples_assignedLabUserId_fkey" FOREIGN KEY ("assignedLabUserId") REFERENCES public."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "lab_samples_samplerUserId_fkey" FOREIGN KEY ("samplerUserId") REFERENCES public."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "lab_samples_currentCustodianOrgId_fkey" FOREIGN KEY ("currentCustodianOrgId") REFERENCES public."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "lab_samples_currentCustodianUserId_fkey" FOREIGN KEY ("currentCustodianUserId") REFERENCES public."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "lab_samples_accreditationId_fkey" FOREIGN KEY ("accreditationId") REFERENCES public."lab_accreditations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "lab_samples_finalizedByUserId_fkey" FOREIGN KEY ("finalizedByUserId") REFERENCES public."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "lab_samples_status_check" CHECK ("status" IN ('PENDING','COLLECTED','RECEIVED','ANALYSIS_IN_PROGRESS','READY_FOR_FINALIZATION','FINALIZED'));

CREATE INDEX IF NOT EXISTS "lab_samples_tenantId_idx" ON public."lab_samples" ("tenantId");
CREATE INDEX IF NOT EXISTS "lab_samples_labId_status_idx" ON public."lab_samples" ("labId", "status");
CREATE INDEX IF NOT EXISTS "lab_samples_assignedLabUserId_status_idx" ON public."lab_samples" ("assignedLabUserId", "status");
CREATE INDEX IF NOT EXISTS "lab_samples_shipmentId_idx" ON public."lab_samples" ("shipmentId");

ALTER TABLE public."lab_tests"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "methodId" TEXT,
  ADD COLUMN IF NOT EXISTS "equipmentId" TEXT,
  ADD COLUMN IF NOT EXISTS "actorUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "correctionOfTestId" TEXT,
  ADD COLUMN IF NOT EXISTS "commandId" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "correlationId" TEXT,
  ADD COLUMN IF NOT EXISTS "note" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE public."lab_tests" test
SET "tenantId" = sample."tenantId"
FROM public."lab_samples" sample
WHERE sample."id" = test."sampleId" AND test."tenantId" IS NULL;

DO $lab_test_authority_backfill$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public."lab_tests"
    WHERE "tenantId" IS NULL OR "methodId" IS NULL OR "equipmentId" IS NULL
       OR "actorUserId" IS NULL OR "commandId" IS NULL OR "idempotencyKey" IS NULL
  ) THEN
    RAISE EXCEPTION 'legacy lab_tests lack method/equipment/actor/idempotency authority; migrate them explicitly before IR-10.3';
  END IF;
END
$lab_test_authority_backfill$;

ALTER TABLE public."lab_tests"
  ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.current_tenant_id'::text, true),
  ALTER COLUMN "tenantId" SET NOT NULL,
  ALTER COLUMN "methodId" SET NOT NULL,
  ALTER COLUMN "equipmentId" SET NOT NULL,
  ALTER COLUMN "actorUserId" SET NOT NULL,
  ALTER COLUMN "commandId" SET NOT NULL,
  ALTER COLUMN "idempotencyKey" SET NOT NULL,
  ALTER COLUMN "value" TYPE NUMERIC(20,6) USING "value"::NUMERIC(20,6),
  ALTER COLUMN "normMin" TYPE NUMERIC(20,6) USING "normMin"::NUMERIC(20,6),
  ALTER COLUMN "normMax" TYPE NUMERIC(20,6) USING "normMax"::NUMERIC(20,6);

ALTER TABLE public."lab_tests"
  ADD CONSTRAINT "lab_tests_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES public."lab_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "lab_tests_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES public."lab_equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "lab_tests_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES public."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "lab_tests_correctionOfTestId_fkey" FOREIGN KEY ("correctionOfTestId") REFERENCES public."lab_tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "lab_tests_norm_bounds_check" CHECK ("normMin" IS NULL OR "normMax" IS NULL OR "normMin" <= "normMax"),
  ADD CONSTRAINT "lab_tests_idempotencyKey_key" UNIQUE ("idempotencyKey");

DROP INDEX IF EXISTS public."lab_tests_sampleId_idx";
CREATE INDEX IF NOT EXISTS "lab_tests_sampleId_recordedAt_idx" ON public."lab_tests" ("sampleId", "recordedAt");
CREATE INDEX IF NOT EXISTS "lab_tests_tenantId_idx" ON public."lab_tests" ("tenantId");
CREATE INDEX IF NOT EXISTS "lab_tests_methodId_idx" ON public."lab_tests" ("methodId");
CREATE INDEX IF NOT EXISTS "lab_tests_equipmentId_idx" ON public."lab_tests" ("equipmentId");
CREATE INDEX IF NOT EXISTS "lab_tests_correctionOfTestId_idx" ON public."lab_tests" ("correctionOfTestId");

CREATE TABLE IF NOT EXISTS public."lab_custody_events" (
  "id" TEXT PRIMARY KEY,
  "sampleId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT current_setting('app.current_tenant_id'::text, true),
  "eventType" TEXT NOT NULL,
  "fromOrgId" TEXT,
  "fromUserId" TEXT,
  "toOrgId" TEXT NOT NULL,
  "toUserId" TEXT NOT NULL,
  "evidenceRef" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "commandId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "correlationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lab_custody_events_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES public."lab_samples"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "lab_custody_events_fromOrgId_fkey" FOREIGN KEY ("fromOrgId") REFERENCES public."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "lab_custody_events_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES public."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "lab_custody_events_toOrgId_fkey" FOREIGN KEY ("toOrgId") REFERENCES public."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "lab_custody_events_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES public."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "lab_custody_events_evidenceRef_fkey" FOREIGN KEY ("evidenceRef") REFERENCES public."evidence_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "lab_custody_events_type_check" CHECK ("eventType" IN ('REGISTERED','COLLECTED','HANDED_OFF','RECEIVED','FINALIZED')),
  CONSTRAINT "lab_custody_events_idempotencyKey_key" UNIQUE ("idempotencyKey")
);
CREATE INDEX IF NOT EXISTS "lab_custody_events_sampleId_occurredAt_idx" ON public."lab_custody_events" ("sampleId", "occurredAt");
CREATE INDEX IF NOT EXISTS "lab_custody_events_tenantId_idx" ON public."lab_custody_events" ("tenantId");
CREATE INDEX IF NOT EXISTS "lab_custody_events_toOrgId_toUserId_idx" ON public."lab_custody_events" ("toOrgId", "toUserId");
CREATE INDEX IF NOT EXISTS "lab_custody_events_correlationId_idx" ON public."lab_custody_events" ("correlationId");

CREATE OR REPLACE FUNCTION public.app_labs_assignment_valid(
  p_tenant_id TEXT,
  p_deal_id TEXT,
  p_lab_org_id TEXT,
  p_lab_user_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public."lab_assignments" assignment
    WHERE assignment."tenantId" = p_tenant_id
      AND assignment."dealId" = p_deal_id
      AND assignment."labOrgId" = p_lab_org_id
      AND assignment."labUserId" = p_lab_user_id
      AND assignment."status" = 'ACTIVE'
      AND assignment."validFrom" <= CURRENT_TIMESTAMP
      AND (assignment."validUntil" IS NULL OR assignment."validUntil" > CURRENT_TIMESTAMP)
  );
$function$;

CREATE OR REPLACE FUNCTION public.app_labs_prepare_sample()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  deal_tenant TEXT;
  assigned_org TEXT;
  assigned_user TEXT;
BEGIN
  SELECT deal."tenantId" INTO deal_tenant FROM public."deals" deal WHERE deal."id" = NEW."dealId";
  IF deal_tenant IS NULL THEN
    RAISE EXCEPTION 'laboratory sample requires a tenant-bound deal' USING ERRCODE = '23514';
  END IF;

  SELECT participant."organizationId", participant."userId"
  INTO assigned_org, assigned_user
  FROM public."deal_participants" participant
  WHERE participant."dealId" = NEW."dealId"
    AND participant."role" = 'LAB'
    AND participant."status" = 'ACTIVE'
  ORDER BY participant."assignedAt" ASC
  LIMIT 1;

  NEW."tenantId" := COALESCE(NULLIF(NEW."tenantId", ''), deal_tenant);
  NEW."labId" := COALESCE(NULLIF(NEW."labId", ''), assigned_org);
  NEW."assignedLabUserId" := COALESCE(NULLIF(NEW."assignedLabUserId", ''), assigned_user);
  NEW."currentCustodianOrgId" := COALESCE(NULLIF(NEW."currentCustodianOrgId", ''), NEW."labId");
  NEW."currentCustodianUserId" := COALESCE(NULLIF(NEW."currentCustodianUserId", ''), NEW."assignedLabUserId");

  IF NEW."tenantId" <> deal_tenant OR NEW."labId" IS NULL OR NEW."assignedLabUserId" IS NULL THEN
    RAISE EXCEPTION 'laboratory sample authority could not be derived' USING ERRCODE = '23514';
  END IF;

  IF public.app_rls_context_ready() AND NOT public.app_labs_assignment_valid(
    NEW."tenantId", NEW."dealId", NEW."labId", NEW."assignedLabUserId"
  ) THEN
    RAISE EXCEPTION 'active normalized laboratory assignment is required' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD."status" = 'FINALIZED' THEN
      RAISE EXCEPTION 'finalized laboratory protocol is immutable' USING ERRCODE = '23514';
    END IF;
    IF ROW(NEW."tenantId", NEW."dealId", NEW."labId", NEW."assignedLabUserId") IS DISTINCT FROM
       ROW(OLD."tenantId", OLD."dealId", OLD."labId", OLD."assignedLabUserId") THEN
      RAISE EXCEPTION 'laboratory authority fields are immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW."version" = OLD."version" THEN
      NEW."version" := OLD."version" + 1;
    END IF;
    NEW."updatedAt" := CURRENT_TIMESTAMP;
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS lab_samples_prepare_authority ON public."lab_samples";
CREATE TRIGGER lab_samples_prepare_authority
BEFORE INSERT OR UPDATE ON public."lab_samples"
FOR EACH ROW EXECUTE FUNCTION public.app_labs_prepare_sample();

CREATE OR REPLACE FUNCTION public.app_labs_validate_test()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  sample_row public."lab_samples"%ROWTYPE;
  method_org TEXT;
  equipment_org TEXT;
  equipment_status TEXT;
  calibration_until TIMESTAMP(3);
BEGIN
  SELECT * INTO sample_row FROM public."lab_samples" WHERE "id" = NEW."sampleId" FOR UPDATE;
  IF sample_row."id" IS NULL OR sample_row."status" = 'FINALIZED' THEN
    RAISE EXCEPTION 'laboratory test requires a mutable sample' USING ERRCODE = '23514';
  END IF;

  SELECT "labOrgId" INTO method_org FROM public."lab_methods"
  WHERE "id" = NEW."methodId" AND "tenantId" = sample_row."tenantId" AND "status" = 'ACTIVE'
    AND "validFrom" <= NEW."recordedAt" AND ("validUntil" IS NULL OR "validUntil" > NEW."recordedAt");
  SELECT "labOrgId", "status", "calibrationValidUntil" INTO equipment_org, equipment_status, calibration_until
  FROM public."lab_equipment" WHERE "id" = NEW."equipmentId" AND "tenantId" = sample_row."tenantId";

  IF method_org IS DISTINCT FROM sample_row."labId" OR equipment_org IS DISTINCT FROM sample_row."labId"
     OR equipment_status <> 'ACTIVE' OR calibration_until IS NULL OR calibration_until < NEW."recordedAt" THEN
    RAISE EXCEPTION 'active method and calibrated equipment of assigned laboratory are required' USING ERRCODE = '23514';
  END IF;

  NEW."tenantId" := sample_row."tenantId";
  IF public.app_rls_context_ready() THEN
    IF NEW."actorUserId" <> current_setting('app.current_user_id', true)
       OR NOT public.app_labs_assignment_valid(sample_row."tenantId", sample_row."dealId", sample_row."labId", NEW."actorUserId") THEN
      RAISE EXCEPTION 'assigned laboratory actor is required' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW."correctionOfTestId" IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public."lab_tests" original
      WHERE original."id" = NEW."correctionOfTestId" AND original."sampleId" = NEW."sampleId"
        AND NOT EXISTS (SELECT 1 FROM public."lab_tests" correction WHERE correction."correctionOfTestId" = original."id")
    ) THEN
      RAISE EXCEPTION 'correction target is missing, foreign or already superseded' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS lab_tests_validate_authority ON public."lab_tests";
CREATE TRIGGER lab_tests_validate_authority
BEFORE INSERT ON public."lab_tests"
FOR EACH ROW EXECUTE FUNCTION public.app_labs_validate_test();

CREATE OR REPLACE FUNCTION public.app_labs_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  owner_name TEXT;
BEGIN
  SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class WHERE oid = TG_RELID;
  IF current_setting('app.allow_trigger_bypass', true) = 'ci-test-only' AND session_user = owner_name THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'confirmed laboratory facts are append-only; create a superseding correction' USING ERRCODE = '23514';
END
$function$;

DROP TRIGGER IF EXISTS lab_tests_append_only ON public."lab_tests";
CREATE TRIGGER lab_tests_append_only BEFORE UPDATE OR DELETE ON public."lab_tests"
FOR EACH ROW EXECUTE FUNCTION public.app_labs_append_only();
DROP TRIGGER IF EXISTS lab_custody_events_append_only ON public."lab_custody_events";
CREATE TRIGGER lab_custody_events_append_only BEFORE UPDATE OR DELETE ON public."lab_custody_events"
FOR EACH ROW EXECUTE FUNCTION public.app_labs_append_only();

ALTER TABLE public."lab_samples" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_samples" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."lab_tests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_tests" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."lab_custody_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_custody_events" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."lab_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_assignments" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."lab_accreditations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_accreditations" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."lab_methods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_methods" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."lab_equipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_equipment" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lab_samples_select ON public."lab_samples";
CREATE POLICY lab_samples_select ON public."lab_samples" FOR SELECT USING (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_rls_deal_visible("dealId")
);
DROP POLICY IF EXISTS lab_samples_insert ON public."lab_samples";
CREATE POLICY lab_samples_insert ON public."lab_samples" FOR INSERT WITH CHECK (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_rls_deal_visible("dealId")
  AND current_setting('app.current_role', true) IN ('ELEVATOR','SURVEYOR','LAB','SUPPORT_MANAGER','ADMIN')
  AND public.app_labs_assignment_valid("tenantId", "dealId", "labId", "assignedLabUserId")
);
DROP POLICY IF EXISTS lab_samples_update ON public."lab_samples";
CREATE POLICY lab_samples_update ON public."lab_samples" FOR UPDATE USING (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_rls_deal_visible("dealId")
  AND (
    "assignedLabUserId" = current_setting('app.current_user_id', true)
    OR "currentCustodianUserId" = current_setting('app.current_user_id', true)
    OR current_setting('app.current_role', true) IN ('SUPPORT_MANAGER','ADMIN')
  )
) WITH CHECK (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_rls_deal_visible("dealId")
);
DROP POLICY IF EXISTS lab_samples_delete ON public."lab_samples";
CREATE POLICY lab_samples_delete ON public."lab_samples" FOR DELETE USING (false);

DROP POLICY IF EXISTS lab_tests_select ON public."lab_tests";
CREATE POLICY lab_tests_select ON public."lab_tests" FOR SELECT USING (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND EXISTS (SELECT 1 FROM public."lab_samples" sample WHERE sample."id" = "lab_tests"."sampleId" AND public.app_rls_deal_visible(sample."dealId"))
);
DROP POLICY IF EXISTS lab_tests_insert ON public."lab_tests";
CREATE POLICY lab_tests_insert ON public."lab_tests" FOR INSERT WITH CHECK (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "actorUserId" = current_setting('app.current_user_id', true)
  AND EXISTS (
    SELECT 1 FROM public."lab_samples" sample
    WHERE sample."id" = "lab_tests"."sampleId"
      AND sample."assignedLabUserId" = current_setting('app.current_user_id', true)
      AND public.app_rls_deal_visible(sample."dealId")
  )
);
DROP POLICY IF EXISTS lab_tests_update ON public."lab_tests";
DROP POLICY IF EXISTS lab_tests_delete ON public."lab_tests";

DROP POLICY IF EXISTS lab_custody_events_select ON public."lab_custody_events";
CREATE POLICY lab_custody_events_select ON public."lab_custody_events" FOR SELECT USING (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND EXISTS (SELECT 1 FROM public."lab_samples" sample WHERE sample."id" = "lab_custody_events"."sampleId" AND public.app_rls_deal_visible(sample."dealId"))
);
DROP POLICY IF EXISTS lab_custody_events_insert ON public."lab_custody_events";
CREATE POLICY lab_custody_events_insert ON public."lab_custody_events" FOR INSERT WITH CHECK (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND EXISTS (SELECT 1 FROM public."lab_samples" sample WHERE sample."id" = "lab_custody_events"."sampleId" AND public.app_rls_deal_visible(sample."dealId"))
  AND ("fromUserId" = current_setting('app.current_user_id', true) OR "toUserId" = current_setting('app.current_user_id', true) OR current_setting('app.current_role', true) IN ('SUPPORT_MANAGER','ADMIN'))
);
DROP POLICY IF EXISTS lab_custody_events_update ON public."lab_custody_events";
DROP POLICY IF EXISTS lab_custody_events_delete ON public."lab_custody_events";

DROP POLICY IF EXISTS lab_assignments_select ON public."lab_assignments";
CREATE POLICY lab_assignments_select ON public."lab_assignments" FOR SELECT USING (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (current_setting('app.current_role', true) IN ('SUPPORT_MANAGER','ADMIN') OR "labUserId" = current_setting('app.current_user_id', true))
);
DROP POLICY IF EXISTS lab_accreditations_select ON public."lab_accreditations";
CREATE POLICY lab_accreditations_select ON public."lab_accreditations" FOR SELECT USING (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (current_setting('app.current_role', true) IN ('SUPPORT_MANAGER','ADMIN') OR "labOrgId" = current_setting('app.current_org_id', true))
);
DROP POLICY IF EXISTS lab_methods_select ON public."lab_methods";
CREATE POLICY lab_methods_select ON public."lab_methods" FOR SELECT USING (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (current_setting('app.current_role', true) IN ('SUPPORT_MANAGER','ADMIN') OR "labOrgId" = current_setting('app.current_org_id', true))
);
DROP POLICY IF EXISTS lab_equipment_select ON public."lab_equipment";
CREATE POLICY lab_equipment_select ON public."lab_equipment" FOR SELECT USING (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (current_setting('app.current_role', true) IN ('SUPPORT_MANAGER','ADMIN') OR "labOrgId" = current_setting('app.current_org_id', true))
);

REVOKE ALL ON FUNCTION public.app_labs_prepare_sample() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_labs_validate_test() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_labs_append_only() FROM PUBLIC;
