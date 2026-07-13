-- IR-10.3 Labs PostgreSQL Authority.
-- Laboratory registries, custody, methods, equipment and immutable protocols are
-- normalized in PostgreSQL. Application access is tenant/participant scoped by RLS.

CREATE SCHEMA IF NOT EXISTS labs;
REVOKE ALL ON SCHEMA labs FROM PUBLIC;

ALTER TABLE public."lab_samples"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "custodyStatus" TEXT NOT NULL DEFAULT 'CREATED',
  ADD COLUMN IF NOT EXISTS "sampleCode" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedActorUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "latestEvidenceFileId" TEXT,
  ADD COLUMN IF NOT EXISTS "protocolResult" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public."lab_samples"
  ALTER COLUMN "version" TYPE BIGINT USING "version"::BIGINT,
  ALTER COLUMN "version" SET DEFAULT 0;

UPDATE public."lab_samples" sample
SET "tenantId" = COALESCE(
      deal."tenantId",
      'legacy-quarantine-' || left(md5(sample."dealId"), 16)
    ),
    "sampleCode" = COALESCE(sample."sampleCode", 'LEGACY-' || left(md5(sample."id"), 16)),
    "updatedAt" = COALESCE(sample."updatedAt", sample."createdAt", now())
FROM public."deals" deal
WHERE deal."id" = sample."dealId"
  AND (sample."tenantId" IS NULL OR sample."sampleCode" IS NULL);

DO $lab_sample_tenant_backfill$
BEGIN
  IF EXISTS (SELECT 1 FROM public."lab_samples" WHERE "tenantId" IS NULL) THEN
    RAISE EXCEPTION 'lab_samples tenant backfill is incomplete';
  END IF;
END
$lab_sample_tenant_backfill$;

ALTER TABLE public."lab_samples"
  ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.current_tenant_id'::text, true),
  ALTER COLUMN "tenantId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "lab_samples_tenant_sampleCode_key"
  ON public."lab_samples" ("tenantId", "sampleCode")
  WHERE "sampleCode" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "lab_samples_tenantId_idx" ON public."lab_samples" ("tenantId");
CREATE INDEX IF NOT EXISTS "lab_samples_shipmentId_idx" ON public."lab_samples" ("shipmentId");
CREATE INDEX IF NOT EXISTS "lab_samples_acceptanceId_idx" ON public."lab_samples" ("acceptanceId");
CREATE INDEX IF NOT EXISTS "lab_samples_labId_idx" ON public."lab_samples" ("labId");
CREATE INDEX IF NOT EXISTS "lab_samples_status_idx" ON public."lab_samples" ("status");

ALTER TABLE public."lab_tests"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "valueDec" NUMERIC(20,6),
  ADD COLUMN IF NOT EXISTS "normMinDec" NUMERIC(20,6),
  ADD COLUMN IF NOT EXISTS "normMaxDec" NUMERIC(20,6),
  ADD COLUMN IF NOT EXISTS "result" TEXT,
  ADD COLUMN IF NOT EXISTS "methodId" TEXT,
  ADD COLUMN IF NOT EXISTS "equipmentId" TEXT,
  ADD COLUMN IF NOT EXISTS "evidenceFileId" TEXT,
  ADD COLUMN IF NOT EXISTS "actorUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "commandId" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "correlationId" TEXT,
  ADD COLUMN IF NOT EXISTS "supersedesId" TEXT;

UPDATE public."lab_tests" test
SET "tenantId" = sample."tenantId",
    "valueDec" = COALESCE(test."valueDec", test."value"::NUMERIC(20,6)),
    "normMinDec" = COALESCE(test."normMinDec", test."normMin"::NUMERIC(20,6)),
    "normMaxDec" = COALESCE(test."normMaxDec", test."normMax"::NUMERIC(20,6)),
    "result" = COALESCE(test."result", CASE WHEN test."passed" THEN 'PASSED' ELSE 'FAILED' END)
FROM public."lab_samples" sample
WHERE sample."id" = test."sampleId";

ALTER TABLE public."lab_tests"
  ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.current_tenant_id'::text, true);

CREATE UNIQUE INDEX IF NOT EXISTS "lab_tests_idempotencyKey_key"
  ON public."lab_tests" ("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "lab_tests_tenantId_idx" ON public."lab_tests" ("tenantId");
CREATE INDEX IF NOT EXISTS "lab_tests_sample_recorded_idx" ON public."lab_tests" ("sampleId", "recordedAt");
CREATE INDEX IF NOT EXISTS "lab_tests_methodId_idx" ON public."lab_tests" ("methodId");
CREATE INDEX IF NOT EXISTS "lab_tests_equipmentId_idx" ON public."lab_tests" ("equipmentId");
CREATE INDEX IF NOT EXISTS "lab_tests_correlationId_idx" ON public."lab_tests" ("correlationId");

CREATE TABLE IF NOT EXISTS labs.laboratories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  accreditation_status TEXT NOT NULL DEFAULT 'PENDING',
  accreditation_ref TEXT NOT NULL,
  evidence_file_id TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT labs_laboratories_org_fkey
    FOREIGN KEY (organization_id) REFERENCES public."organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT labs_laboratories_evidence_fkey
    FOREIGN KEY (evidence_file_id) REFERENCES public."deal_documents"("id") ON DELETE RESTRICT,
  CONSTRAINT labs_laboratories_tenant_org_key UNIQUE (tenant_id, organization_id),
  CONSTRAINT labs_laboratories_status_check CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','REVOKED')),
  CONSTRAINT labs_laboratories_accreditation_check CHECK (accreditation_status IN ('PENDING','VERIFIED','SUSPENDED','REVOKED'))
);

CREATE TABLE IF NOT EXISTS labs.authorized_actors (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  laboratory_org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'ANALYST',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  evidence_file_id TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT labs_authorized_actors_laboratory_fkey
    FOREIGN KEY (tenant_id, laboratory_org_id)
    REFERENCES labs.laboratories(tenant_id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT labs_authorized_actors_user_fkey
    FOREIGN KEY (user_id) REFERENCES public."users"("id") ON DELETE RESTRICT,
  CONSTRAINT labs_authorized_actors_evidence_fkey
    FOREIGN KEY (evidence_file_id) REFERENCES public."deal_documents"("id") ON DELETE RESTRICT,
  CONSTRAINT labs_authorized_actors_tenant_user_key UNIQUE (tenant_id, laboratory_org_id, user_id),
  CONSTRAINT labs_authorized_actors_type_check CHECK (actor_type IN ('SAMPLER','COURIER','RECEIVER','ANALYST','SIGNATORY')),
  CONSTRAINT labs_authorized_actors_status_check CHECK (status IN ('ACTIVE','SUSPENDED','REVOKED'))
);

CREATE TABLE IF NOT EXISTS labs.methods (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  laboratory_org_id TEXT NOT NULL,
  code TEXT NOT NULL,
  parameter TEXT NOT NULL,
  unit TEXT NOT NULL,
  standard_ref TEXT NOT NULL,
  norm_min NUMERIC(20,6),
  norm_max NUMERIC(20,6),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  evidence_file_id TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT labs_methods_laboratory_fkey
    FOREIGN KEY (tenant_id, laboratory_org_id)
    REFERENCES labs.laboratories(tenant_id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT labs_methods_evidence_fkey
    FOREIGN KEY (evidence_file_id) REFERENCES public."deal_documents"("id") ON DELETE RESTRICT,
  CONSTRAINT labs_methods_tenant_code_key UNIQUE (tenant_id, laboratory_org_id, code),
  CONSTRAINT labs_methods_norm_check CHECK (norm_min IS NOT NULL OR norm_max IS NOT NULL),
  CONSTRAINT labs_methods_range_check CHECK (norm_min IS NULL OR norm_max IS NULL OR norm_min <= norm_max),
  CONSTRAINT labs_methods_status_check CHECK (status IN ('ACTIVE','SUSPENDED','REVOKED'))
);

CREATE TABLE IF NOT EXISTS labs.equipment (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  laboratory_org_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  serial_number TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  calibration_valid_until TIMESTAMPTZ NOT NULL,
  evidence_file_id TEXT NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT labs_equipment_laboratory_fkey
    FOREIGN KEY (tenant_id, laboratory_org_id)
    REFERENCES labs.laboratories(tenant_id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT labs_equipment_evidence_fkey
    FOREIGN KEY (evidence_file_id) REFERENCES public."deal_documents"("id") ON DELETE RESTRICT,
  CONSTRAINT labs_equipment_tenant_code_key UNIQUE (tenant_id, laboratory_org_id, code),
  CONSTRAINT labs_equipment_status_check CHECK (status IN ('ACTIVE','SUSPENDED','REVOKED'))
);

CREATE TABLE IF NOT EXISTS labs.sample_admissions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  shipment_id TEXT NOT NULL,
  acceptance_id TEXT NOT NULL,
  laboratory_org_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  evidence_file_id TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  consumed_by_sample_id TEXT,
  consumed_by_command_id TEXT,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT labs_sample_admissions_deal_fkey
    FOREIGN KEY (deal_id) REFERENCES public."deals"("id") ON DELETE RESTRICT,
  CONSTRAINT labs_sample_admissions_shipment_fkey
    FOREIGN KEY (shipment_id) REFERENCES public."shipments"("id") ON DELETE RESTRICT,
  CONSTRAINT labs_sample_admissions_acceptance_fkey
    FOREIGN KEY (acceptance_id) REFERENCES public."acceptance_records"("id") ON DELETE RESTRICT,
  CONSTRAINT labs_sample_admissions_laboratory_fkey
    FOREIGN KEY (tenant_id, laboratory_org_id)
    REFERENCES labs.laboratories(tenant_id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT labs_sample_admissions_evidence_fkey
    FOREIGN KEY (evidence_file_id) REFERENCES public."deal_documents"("id") ON DELETE RESTRICT,
  CONSTRAINT labs_sample_admissions_status_check CHECK (status IN ('ACTIVE','CONSUMED','EXPIRED','REVOKED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS labs_sample_admissions_active_basis_key
  ON labs.sample_admissions (deal_id, shipment_id, acceptance_id)
  WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS labs_sample_admissions_lookup_idx
  ON labs.sample_admissions (tenant_id, deal_id, laboratory_org_id, status);

CREATE TABLE IF NOT EXISTS labs.sample_custody_events (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  laboratory_org_id TEXT NOT NULL,
  evidence_file_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  correlation_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  prev_hash TEXT,
  hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT labs_custody_sample_fkey
    FOREIGN KEY (sample_id) REFERENCES public."lab_samples"("id") ON DELETE RESTRICT,
  CONSTRAINT labs_custody_actor_fkey
    FOREIGN KEY (actor_user_id) REFERENCES public."users"("id") ON DELETE RESTRICT,
  CONSTRAINT labs_custody_laboratory_fkey
    FOREIGN KEY (tenant_id, laboratory_org_id)
    REFERENCES labs.laboratories(tenant_id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT labs_custody_evidence_fkey
    FOREIGN KEY (evidence_file_id) REFERENCES public."deal_documents"("id") ON DELETE RESTRICT,
  CONSTRAINT labs_custody_event_check CHECK (event_type IN ('CREATED','COLLECTED','SEALED','HANDOFF','RECEIVED','OPENED','FINALIZED','CORRECTED'))
);
CREATE INDEX IF NOT EXISTS labs_custody_sample_occurred_idx
  ON labs.sample_custody_events (sample_id, occurred_at, id);
CREATE INDEX IF NOT EXISTS labs_custody_tenant_idx
  ON labs.sample_custody_events (tenant_id, occurred_at);

CREATE TABLE IF NOT EXISTS labs.protocols (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  protocol_number TEXT NOT NULL,
  laboratory_org_id TEXT NOT NULL,
  accreditation_ref TEXT NOT NULL,
  standard_ref TEXT NOT NULL,
  result TEXT NOT NULL,
  signed_evidence_file_id TEXT NOT NULL,
  finalized_by_user_id TEXT NOT NULL,
  finalized_at TIMESTAMPTZ NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  supersedes_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT labs_protocol_sample_fkey
    FOREIGN KEY (sample_id) REFERENCES public."lab_samples"("id") ON DELETE RESTRICT,
  CONSTRAINT labs_protocol_laboratory_fkey
    FOREIGN KEY (tenant_id, laboratory_org_id)
    REFERENCES labs.laboratories(tenant_id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT labs_protocol_evidence_fkey
    FOREIGN KEY (signed_evidence_file_id) REFERENCES public."deal_documents"("id") ON DELETE RESTRICT,
  CONSTRAINT labs_protocol_actor_fkey
    FOREIGN KEY (finalized_by_user_id) REFERENCES public."users"("id") ON DELETE RESTRICT,
  CONSTRAINT labs_protocol_supersedes_fkey
    FOREIGN KEY (supersedes_id) REFERENCES labs.protocols(id) ON DELETE RESTRICT,
  CONSTRAINT labs_protocol_sample_version_key UNIQUE (sample_id, version),
  CONSTRAINT labs_protocol_number_key UNIQUE (tenant_id, protocol_number),
  CONSTRAINT labs_protocol_result_check CHECK (result IN ('PASSED','FAILED','INCONCLUSIVE'))
);
CREATE INDEX IF NOT EXISTS labs_protocol_sample_idx ON labs.protocols (sample_id, version DESC);

ALTER TABLE public."lab_tests"
  DROP CONSTRAINT IF EXISTS "lab_tests_methodId_fkey",
  DROP CONSTRAINT IF EXISTS "lab_tests_equipmentId_fkey",
  DROP CONSTRAINT IF EXISTS "lab_tests_evidenceFileId_fkey",
  DROP CONSTRAINT IF EXISTS "lab_tests_actorUserId_fkey",
  DROP CONSTRAINT IF EXISTS "lab_tests_supersedesId_fkey";
ALTER TABLE public."lab_tests"
  ADD CONSTRAINT "lab_tests_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES labs.methods(id) ON DELETE RESTRICT,
  ADD CONSTRAINT "lab_tests_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES labs.equipment(id) ON DELETE RESTRICT,
  ADD CONSTRAINT "lab_tests_evidenceFileId_fkey" FOREIGN KEY ("evidenceFileId") REFERENCES public."deal_documents"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "lab_tests_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES public."users"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "lab_tests_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES public."lab_tests"("id") ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.app_labs_evidence_valid(
  p_evidence_id TEXT,
  p_tenant_id TEXT,
  p_deal_id TEXT DEFAULT NULL
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
      AND evidence."tenantId" = p_tenant_id
      AND (p_deal_id IS NULL OR evidence."dealId" = p_deal_id)
      AND evidence."type" = 'EVIDENCE_FILE'
      AND evidence."status" = 'VERIFIED'
      AND evidence."isImmutable"
      AND evidence."hash" IS NOT NULL
      AND evidence."s3Key" IS NOT NULL
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
SET search_path = pg_catalog, public
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
        current_setting('app.current_role', true) IN ('LAB','SURVEYOR')
        AND p_laboratory_org_id = current_setting('app.current_org_id', true)
      )
    )
$function$;

CREATE OR REPLACE FUNCTION public.app_labs_derive_sample_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  deal_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO deal_tenant FROM public."deals" WHERE "id" = NEW."dealId";
  IF NOT FOUND OR deal_tenant IS NULL THEN
    RAISE EXCEPTION 'laboratory sample deal has no tenant authority' USING ERRCODE = '23514';
  END IF;
  NEW."tenantId" := deal_tenant;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS lab_samples_derive_tenant ON public."lab_samples";
CREATE TRIGGER lab_samples_derive_tenant
BEFORE INSERT OR UPDATE OF "dealId", "tenantId" ON public."lab_samples"
FOR EACH ROW EXECUTE FUNCTION public.app_labs_derive_sample_tenant();

CREATE OR REPLACE FUNCTION public.app_labs_validate_sample_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, labs
AS $function$
DECLARE
  admission labs.sample_admissions%ROWTYPE;
BEGIN
  IF NEW."shipmentId" IS NULL OR NEW."acceptanceId" IS NULL
     OR NEW."labId" IS NULL OR NEW."assignedActorUserId" IS NULL
     OR NEW."latestEvidenceFileId" IS NULL OR NEW."status" <> 'CREATED'
  THEN
    RAISE EXCEPTION 'new laboratory sample requires canonical admission fields' USING ERRCODE = '23514';
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
  IF NOT public.app_labs_evidence_valid(admission.evidence_file_id, admission.tenant_id, admission.deal_id)
     OR NOT public.app_labs_evidence_valid(NEW."latestEvidenceFileId", NEW."tenantId", NEW."dealId")
  THEN
    RAISE EXCEPTION 'laboratory admission evidence is not verified immutable Deal evidence' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM labs.laboratories laboratory
    JOIN public."organizations" organization ON organization."id" = laboratory.organization_id
    WHERE laboratory.tenant_id = NEW."tenantId"
      AND laboratory.organization_id = NEW."labId"
      AND laboratory.status = 'ACTIVE'
      AND laboratory.accreditation_status = 'VERIFIED'
      AND organization."tenantId" = NEW."tenantId"
      AND organization."status" = 'VERIFIED'
      AND organization."kycStatus" = 'APPROVED'
  ) THEN
    RAISE EXCEPTION 'laboratory is not active and accredited' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM labs.authorized_actors actor
    WHERE actor.tenant_id = NEW."tenantId"
      AND actor.laboratory_org_id = NEW."labId"
      AND actor.user_id = NEW."assignedActorUserId"
      AND actor.status = 'ACTIVE'
      AND actor.valid_from <= now()
      AND (actor.valid_until IS NULL OR actor.valid_until > now())
  ) AND current_setting('app.current_role', true) NOT IN ('SUPPORT_MANAGER','ADMIN') THEN
    RAISE EXCEPTION 'laboratory actor is not authorized' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS lab_samples_validate_insert ON public."lab_samples";
CREATE TRIGGER lab_samples_validate_insert
BEFORE INSERT ON public."lab_samples"
FOR EACH ROW EXECUTE FUNCTION public.app_labs_validate_sample_insert();

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
  IF NOT FOUND OR sample_record."status" NOT IN ('RECEIVED','ANALYSIS_IN_PROGRESS') THEN
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
DROP TRIGGER IF EXISTS lab_tests_derive_authority ON public."lab_tests";
CREATE TRIGGER lab_tests_derive_authority
BEFORE INSERT ON public."lab_tests"
FOR EACH ROW EXECUTE FUNCTION public.app_labs_derive_test_authority();

CREATE OR REPLACE FUNCTION public.app_labs_sample_state_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
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
  IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
    (OLD."status" = 'CREATED' AND NEW."status" = 'COLLECTED') OR
    (OLD."status" = 'COLLECTED' AND NEW."status" = 'IN_TRANSIT') OR
    (OLD."status" = 'IN_TRANSIT' AND NEW."status" = 'RECEIVED') OR
    (OLD."status" = 'RECEIVED' AND NEW."status" = 'ANALYSIS_IN_PROGRESS') OR
    (OLD."status" = 'ANALYSIS_IN_PROGRESS' AND NEW."status" = 'FINALIZED')
  ) THEN
    RAISE EXCEPTION 'invalid laboratory sample state transition' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;
DROP TRIGGER IF EXISTS lab_samples_state_guard ON public."lab_samples";
CREATE TRIGGER lab_samples_state_guard
BEFORE UPDATE ON public."lab_samples"
FOR EACH ROW EXECUTE FUNCTION public.app_labs_sample_state_guard();

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
CREATE TRIGGER lab_tests_append_only BEFORE UPDATE OR DELETE ON public."lab_tests"
FOR EACH ROW EXECUTE FUNCTION public.app_labs_append_only();
DROP TRIGGER IF EXISTS labs_custody_append_only ON labs.sample_custody_events;
CREATE TRIGGER labs_custody_append_only BEFORE UPDATE OR DELETE ON labs.sample_custody_events
FOR EACH ROW EXECUTE FUNCTION public.app_labs_append_only();
DROP TRIGGER IF EXISTS labs_protocols_append_only ON labs.protocols;
CREATE TRIGGER labs_protocols_append_only BEFORE UPDATE OR DELETE ON labs.protocols
FOR EACH ROW EXECUTE FUNCTION public.app_labs_append_only();

ALTER TABLE public."lab_samples" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_samples" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."lab_tests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_tests" FORCE ROW LEVEL SECURITY;
ALTER TABLE labs.laboratories ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs.laboratories FORCE ROW LEVEL SECURITY;
ALTER TABLE labs.authorized_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs.authorized_actors FORCE ROW LEVEL SECURITY;
ALTER TABLE labs.methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs.methods FORCE ROW LEVEL SECURITY;
ALTER TABLE labs.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs.equipment FORCE ROW LEVEL SECURITY;
ALTER TABLE labs.sample_admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs.sample_admissions FORCE ROW LEVEL SECURITY;
ALTER TABLE labs.sample_custody_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs.sample_custody_events FORCE ROW LEVEL SECURITY;
ALTER TABLE labs.protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs.protocols FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lab_samples_select ON public."lab_samples";
CREATE POLICY lab_samples_select ON public."lab_samples" FOR SELECT USING (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_labs_deal_authorized("dealId", "labId", false)
);
DROP POLICY IF EXISTS lab_samples_insert ON public."lab_samples";
CREATE POLICY lab_samples_insert ON public."lab_samples" FOR INSERT WITH CHECK (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_labs_deal_authorized("dealId", "labId", true)
  AND "assignedActorUserId" = current_setting('app.current_user_id', true)
);
DROP POLICY IF EXISTS lab_samples_update ON public."lab_samples";
CREATE POLICY lab_samples_update ON public."lab_samples" FOR UPDATE USING (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_labs_deal_authorized("dealId", "labId", true)
) WITH CHECK (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_labs_deal_authorized("dealId", "labId", true)
);
DROP POLICY IF EXISTS lab_samples_delete ON public."lab_samples";
CREATE POLICY lab_samples_delete ON public."lab_samples" FOR DELETE USING (false);

DROP POLICY IF EXISTS lab_tests_select ON public."lab_tests";
CREATE POLICY lab_tests_select ON public."lab_tests" FOR SELECT USING (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND EXISTS (
    SELECT 1 FROM public."lab_samples" sample
    WHERE sample."id" = "sampleId"
      AND public.app_labs_deal_authorized(sample."dealId", sample."labId", false)
  )
);
DROP POLICY IF EXISTS lab_tests_insert ON public."lab_tests";
CREATE POLICY lab_tests_insert ON public."lab_tests" FOR INSERT WITH CHECK (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND "actorUserId" = current_setting('app.current_user_id', true)
  AND EXISTS (
    SELECT 1 FROM public."lab_samples" sample
    WHERE sample."id" = "sampleId"
      AND public.app_labs_deal_authorized(sample."dealId", sample."labId", true)
  )
);
DROP POLICY IF EXISTS lab_tests_update ON public."lab_tests";
DROP POLICY IF EXISTS lab_tests_delete ON public."lab_tests";

CREATE POLICY labs_laboratories_select ON labs.laboratories FOR SELECT USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND (organization_id = current_setting('app.current_org_id', true) OR public.app_rls_privileged())
);
CREATE POLICY labs_authorized_actors_select ON labs.authorized_actors FOR SELECT USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND (laboratory_org_id = current_setting('app.current_org_id', true) OR public.app_rls_privileged())
);
CREATE POLICY labs_methods_select ON labs.methods FOR SELECT USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND (laboratory_org_id = current_setting('app.current_org_id', true) OR public.app_rls_privileged())
);
CREATE POLICY labs_equipment_select ON labs.equipment FOR SELECT USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND (laboratory_org_id = current_setting('app.current_org_id', true) OR public.app_rls_privileged())
);
CREATE POLICY labs_admissions_select ON labs.sample_admissions FOR SELECT USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_labs_deal_authorized(deal_id, laboratory_org_id, false)
);
CREATE POLICY labs_admissions_update ON labs.sample_admissions FOR UPDATE USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND status = 'ACTIVE'
  AND public.app_labs_deal_authorized(deal_id, laboratory_org_id, true)
) WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_labs_deal_authorized(deal_id, laboratory_org_id, true)
);
CREATE POLICY labs_custody_select ON labs.sample_custody_events FOR SELECT USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND EXISTS (
    SELECT 1 FROM public."lab_samples" sample
    WHERE sample."id" = sample_id
      AND public.app_labs_deal_authorized(sample."dealId", sample."labId", false)
  )
);
CREATE POLICY labs_custody_insert ON labs.sample_custody_events FOR INSERT WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND actor_user_id = current_setting('app.current_user_id', true)
  AND EXISTS (
    SELECT 1 FROM public."lab_samples" sample
    WHERE sample."id" = sample_id
      AND public.app_labs_deal_authorized(sample."dealId", sample."labId", true)
  )
);
CREATE POLICY labs_protocols_select ON labs.protocols FOR SELECT USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND EXISTS (
    SELECT 1 FROM public."lab_samples" sample
    WHERE sample."id" = sample_id
      AND public.app_labs_deal_authorized(sample."dealId", sample."labId", false)
  )
);
CREATE POLICY labs_protocols_insert ON labs.protocols FOR INSERT WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND finalized_by_user_id = current_setting('app.current_user_id', true)
  AND EXISTS (
    SELECT 1 FROM public."lab_samples" sample
    WHERE sample."id" = sample_id
      AND public.app_labs_deal_authorized(sample."dealId", sample."labId", true)
  )
);

DO $labs_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT USAGE ON SCHEMA labs TO app_deal;
    GRANT SELECT, INSERT, UPDATE ON public."lab_samples" TO app_deal;
    GRANT SELECT, INSERT ON public."lab_tests" TO app_deal;
    GRANT SELECT ON labs.laboratories, labs.authorized_actors, labs.methods, labs.equipment TO app_deal;
    GRANT SELECT, UPDATE ON labs.sample_admissions TO app_deal;
    GRANT SELECT, INSERT ON labs.sample_custody_events, labs.protocols TO app_deal;
    GRANT EXECUTE ON FUNCTION public.app_labs_evidence_valid(TEXT, TEXT, TEXT) TO app_deal;
    GRANT EXECUTE ON FUNCTION public.app_labs_deal_authorized(TEXT, TEXT, BOOLEAN) TO app_deal;
  END IF;
END
$labs_grants$;
