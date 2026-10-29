-- PC-CROP W1-B: durable provider registry and service offering authority.
-- Organization commands can create only PENDING_VERIFICATION state. No seed,
-- default provider, activation, external integration or Deal enforcement is
-- introduced by this migration.

CREATE TABLE public."providers" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "version" bigint NOT NULL DEFAULT 1,
  "createdByMembershipId" text NOT NULL,
  "updatedByMembershipId" text NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "provider_organization_key" UNIQUE ("organizationId"),
  CONSTRAINT "provider_scope_identity_key" UNIQUE ("id", "tenantId", "organizationId"),
  CONSTRAINT "provider_organization_fkey"
    FOREIGN KEY ("organizationId", "tenantId")
    REFERENCES public."organizations" ("id", "tenantId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "provider_created_by_fkey"
    FOREIGN KEY ("createdByMembershipId", "organizationId")
    REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "provider_updated_by_fkey"
    FOREIGN KEY ("updatedByMembershipId", "organizationId")
    REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "provider_status_check"
    CHECK ("status" IN ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
  CONSTRAINT "provider_version_check" CHECK ("version" >= 1)
);

CREATE INDEX "provider_tenant_status_idx"
  ON public."providers" ("tenantId", "status");

CREATE TABLE public."provider_capabilities" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "providerId" text NOT NULL,
  "category" text NOT NULL,
  "legalRole" text NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "version" bigint NOT NULL DEFAULT 1,
  "effectiveFrom" timestamptz(6),
  "effectiveTo" timestamptz(6),
  "createdByMembershipId" text NOT NULL,
  "updatedByMembershipId" text NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "provider_capability_category_key" UNIQUE ("providerId", "category"),
  CONSTRAINT "provider_capability_scope_identity_key"
    UNIQUE ("id", "tenantId", "organizationId"),
  CONSTRAINT "provider_capability_evidence_identity_key"
    UNIQUE ("id", "providerId", "tenantId", "organizationId"),
  CONSTRAINT "provider_capability_service_identity_key"
    UNIQUE ("id", "tenantId", "organizationId", "category"),
  CONSTRAINT "provider_capability_full_identity_key"
    UNIQUE ("id", "providerId", "tenantId", "organizationId", "category"),
  CONSTRAINT "provider_capability_offering_identity_key"
    UNIQUE ("providerId", "tenantId", "organizationId", "category"),
  CONSTRAINT "provider_capability_provider_fkey"
    FOREIGN KEY ("providerId", "tenantId", "organizationId")
    REFERENCES public."providers" ("id", "tenantId", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "provider_capability_created_by_fkey"
    FOREIGN KEY ("createdByMembershipId", "organizationId")
    REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "provider_capability_updated_by_fkey"
    FOREIGN KEY ("updatedByMembershipId", "organizationId")
    REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "provider_capability_category_check" CHECK (
    "category" IN ('LOGISTICS', 'INSURANCE', 'LAB', 'SURVEY', 'ELEVATOR', 'PORT', 'RAIL', 'BANK')
  ),
  CONSTRAINT "provider_capability_legal_role_check" CHECK (
    "legalRole" IN ('carrier', 'expeditor', 'mixed', 'lab', 'bank', 'other')
  ),
  CONSTRAINT "provider_capability_status_check" CHECK (
    "status" IN ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'REVOKED')
  ),
  CONSTRAINT "provider_capability_effectivity_check" CHECK (
    ("status" = 'ACTIVE' AND "effectiveFrom" IS NOT NULL AND "effectiveTo" IS NULL)
    OR ("status" = 'PENDING_VERIFICATION' AND "effectiveFrom" IS NULL AND "effectiveTo" IS NULL)
    OR ("status" IN ('SUSPENDED', 'REVOKED') AND "effectiveTo" IS NOT NULL)
  ),
  CONSTRAINT "provider_capability_version_check" CHECK ("version" >= 1)
);

CREATE INDEX "provider_capability_catalog_idx"
  ON public."provider_capabilities" ("tenantId", "category", "status");

CREATE TABLE public."service_offerings" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "providerId" text NOT NULL,
  "capabilityId" text NOT NULL,
  "offeringKey" text NOT NULL,
  "category" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "regions" text[] NOT NULL,
  "cultures" text[] NOT NULL,
  "stages" text[] NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "version" bigint NOT NULL DEFAULT 1,
  "createdByMembershipId" text NOT NULL,
  "updatedByMembershipId" text NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "service_offering_provider_key" UNIQUE ("providerId", "offeringKey"),
  CONSTRAINT "service_offering_scope_identity_key"
    UNIQUE ("id", "tenantId", "organizationId"),
  CONSTRAINT "service_offering_capability_fkey"
    FOREIGN KEY ("capabilityId", "providerId", "tenantId", "organizationId", "category")
    REFERENCES public."provider_capabilities" ("id", "providerId", "tenantId", "organizationId", "category")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "service_offering_created_by_fkey"
    FOREIGN KEY ("createdByMembershipId", "organizationId")
    REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "service_offering_updated_by_fkey"
    FOREIGN KEY ("updatedByMembershipId", "organizationId")
    REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "service_offering_key_check"
    CHECK ("offeringKey" ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{2,79}$'),
  CONSTRAINT "service_offering_category_check" CHECK (
    "category" IN ('LOGISTICS', 'INSURANCE', 'LAB', 'SURVEY', 'ELEVATOR', 'PORT', 'RAIL', 'BANK')
  ),
  CONSTRAINT "service_offering_status_check" CHECK (
    "status" IN ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'WITHDRAWN')
  ),
  CONSTRAINT "service_offering_text_check" CHECK (
    length(btrim("title")) BETWEEN 3 AND 160
    AND length(btrim("description")) BETWEEN 10 AND 2000
  ),
  CONSTRAINT "service_offering_coverage_check" CHECK (
    cardinality("regions") <= 50
    AND cardinality("cultures") <= 50
    AND cardinality("stages") BETWEEN 1 AND 5
    AND "stages" <@ ARRAY['DISPATCH', 'LAB', 'RECEIVING', 'EXPORT', 'PAYMENT']::text[]
  ),
  CONSTRAINT "service_offering_version_check" CHECK ("version" >= 1)
);

CREATE INDEX "service_offering_catalog_idx"
  ON public."service_offerings" ("tenantId", "category", "status");

CREATE TABLE public."provider_registry_evidence" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "providerId" text NOT NULL,
  "providerCapabilityId" text NOT NULL,
  "checkCode" text NOT NULL,
  "status" text NOT NULL,
  "source" text NOT NULL,
  "evidenceReference" text NOT NULL,
  "checkedAt" timestamptz(6) NOT NULL,
  "expiresAt" timestamptz(6),
  "version" bigint NOT NULL DEFAULT 1,
  "recordedByAuthority" text NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "provider_registry_evidence_version_key"
    UNIQUE ("providerCapabilityId", "checkCode", "version"),
  CONSTRAINT "provider_registry_evidence_capability_fkey"
    FOREIGN KEY ("providerCapabilityId", "providerId", "tenantId", "organizationId")
    REFERENCES public."provider_capabilities" ("id", "providerId", "tenantId", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "provider_registry_evidence_check_code_check" CHECK (
    "checkCode" IN (
      'lab_accreditation', 'declaration_validity', 'goslog_carrier',
      'goslog_expeditor', 'epd_ready', 'qualified_signature',
      'gps_evidence', 'bank_whitelist'
    )
  ),
  CONSTRAINT "provider_registry_evidence_status_check" CHECK (
    "status" IN ('LIVE_OK', 'SANDBOX_ONLY', 'MANUAL_ONLY', 'MISSING', 'EXPIRED')
  ),
  CONSTRAINT "provider_registry_evidence_text_check" CHECK (
    length(btrim("source")) BETWEEN 2 AND 160
    AND length(btrim("evidenceReference")) BETWEEN 3 AND 500
    AND length(btrim("recordedByAuthority")) BETWEEN 3 AND 240
  ),
  CONSTRAINT "provider_registry_evidence_validity_check" CHECK (
    "expiresAt" IS NULL OR "expiresAt" > "checkedAt"
  ),
  CONSTRAINT "provider_registry_evidence_version_check" CHECK ("version" >= 1)
);

CREATE INDEX "provider_registry_evidence_lookup_idx"
  ON public."provider_registry_evidence"
  ("tenantId", "providerId", "checkCode", "checkedAt" DESC);

CREATE TABLE public."provider_registry_events" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "providerId" text NOT NULL,
  "entityType" text NOT NULL,
  "entityId" text NOT NULL,
  "category" text NOT NULL,
  "action" text NOT NULL,
  "resultStatus" text NOT NULL,
  "commandId" text NOT NULL,
  "idempotencyKey" text NOT NULL,
  "requestFingerprint" text NOT NULL,
  "reason" text NOT NULL,
  "actorUserId" text NOT NULL,
  "actorRole" text NOT NULL,
  "actorMembershipId" text NOT NULL,
  "correlationId" text NOT NULL,
  "beforeState" jsonb,
  "afterState" jsonb NOT NULL,
  "prevHash" text,
  "hash" text NOT NULL,
  "auditEventId" text NOT NULL,
  "outboxEntryId" text NOT NULL,
  "aggregateVersion" bigint NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "provider_registry_event_command_key"
    UNIQUE ("tenantId", "organizationId", "commandId"),
  CONSTRAINT "provider_registry_event_idempotency_key"
    UNIQUE ("tenantId", "organizationId", "idempotencyKey"),
  CONSTRAINT "provider_registry_event_audit_key" UNIQUE ("auditEventId"),
  CONSTRAINT "provider_registry_event_outbox_key" UNIQUE ("outboxEntryId"),
  CONSTRAINT "provider_registry_event_provider_fkey"
    FOREIGN KEY ("providerId", "tenantId", "organizationId")
    REFERENCES public."providers" ("id", "tenantId", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "provider_registry_event_organization_fkey"
    FOREIGN KEY ("organizationId", "tenantId")
    REFERENCES public."organizations" ("id", "tenantId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "provider_registry_event_actor_fkey"
    FOREIGN KEY ("actorMembershipId", "organizationId")
    REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "provider_registry_event_entity_check"
    CHECK ("entityType" IN ('PROVIDER_CAPABILITY', 'SERVICE_OFFERING')),
  CONSTRAINT "provider_registry_event_action_check" CHECK (
    ("entityType" = 'PROVIDER_CAPABILITY' AND "action" IN ('DECLARE', 'REVOKE'))
    OR ("entityType" = 'SERVICE_OFFERING' AND "action" IN ('UPSERT', 'WITHDRAW'))
  ),
  CONSTRAINT "provider_registry_event_category_check" CHECK (
    "category" IN ('LOGISTICS', 'INSURANCE', 'LAB', 'SURVEY', 'ELEVATOR', 'PORT', 'RAIL', 'BANK')
  ),
  CONSTRAINT "provider_registry_event_hash_check" CHECK (
    "requestFingerprint" ~ '^[0-9a-f]{64}$'
    AND "hash" ~ '^[0-9a-f]{64}$'
    AND ("prevHash" IS NULL OR "prevHash" ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT "provider_registry_event_reason_check"
    CHECK (length(btrim("reason")) BETWEEN 10 AND 2000),
  CONSTRAINT "provider_registry_event_version_check" CHECK ("aggregateVersion" >= 1)
);

CREATE INDEX "provider_registry_event_chain_idx"
  ON public."provider_registry_events" ("providerId", "createdAt", "id");

CREATE OR REPLACE FUNCTION public.app_provider_registry_guard_provider()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_PROVIDER_DELETE_FORBIDDEN';
  END IF;
  IF NEW."id" <> OLD."id"
     OR NEW."tenantId" <> OLD."tenantId"
     OR NEW."organizationId" <> OLD."organizationId"
     OR NEW."createdByMembershipId" <> OLD."createdByMembershipId"
     OR NEW."createdAt" <> OLD."createdAt" THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_PROVIDER_IDENTITY_IMMUTABLE';
  END IF;
  IF NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'PC_PROVIDER_VERSION_CONFLICT';
  END IF;
  IF current_user IN ('pc_deal_runtime', 'one_deal_app', 'app_deal', 'app_runtime', 'app_deal_api')
     AND NEW."status" <> OLD."status" THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_PROVIDER_SELF_ACTIVATION_FORBIDDEN';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.app_provider_registry_guard_capability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_PROVIDER_CAPABILITY_DELETE_FORBIDDEN';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW."id" <> OLD."id"
       OR NEW."tenantId" <> OLD."tenantId"
       OR NEW."organizationId" <> OLD."organizationId"
       OR NEW."providerId" <> OLD."providerId"
       OR NEW."category" <> OLD."category"
       OR NEW."createdByMembershipId" <> OLD."createdByMembershipId"
       OR NEW."createdAt" <> OLD."createdAt" THEN
      RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_PROVIDER_CAPABILITY_IDENTITY_IMMUTABLE';
    END IF;
    IF NEW."version" <> OLD."version" + 1 THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'PC_PROVIDER_CAPABILITY_VERSION_CONFLICT';
    END IF;
  END IF;
  IF current_user IN ('pc_deal_runtime', 'one_deal_app', 'app_deal', 'app_runtime', 'app_deal_api')
     AND NEW."status" NOT IN ('PENDING_VERIFICATION', 'REVOKED') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_PROVIDER_CAPABILITY_SELF_ACTIVATION_FORBIDDEN';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.app_provider_registry_guard_offering()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_SERVICE_OFFERING_DELETE_FORBIDDEN';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW."id" <> OLD."id"
       OR NEW."tenantId" <> OLD."tenantId"
       OR NEW."organizationId" <> OLD."organizationId"
       OR NEW."providerId" <> OLD."providerId"
       OR NEW."capabilityId" <> OLD."capabilityId"
       OR NEW."offeringKey" <> OLD."offeringKey"
       OR NEW."category" <> OLD."category"
       OR NEW."createdByMembershipId" <> OLD."createdByMembershipId"
       OR NEW."createdAt" <> OLD."createdAt" THEN
      RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_SERVICE_OFFERING_IDENTITY_IMMUTABLE';
    END IF;
    IF NEW."version" <> OLD."version" + 1 THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'PC_SERVICE_OFFERING_VERSION_CONFLICT';
    END IF;
  END IF;
  IF current_user IN ('pc_deal_runtime', 'one_deal_app', 'app_deal', 'app_runtime', 'app_deal_api')
     AND NEW."status" NOT IN ('PENDING_VERIFICATION', 'WITHDRAWN') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_SERVICE_OFFERING_SELF_ACTIVATION_FORBIDDEN';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.app_provider_registry_guard_evidence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_PROVIDER_EVIDENCE_IMMUTABLE';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.app_provider_registry_guard_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  expected_prev_hash text;
  current_command_id text := nullif(current_setting('app.current_command_id', true), '');
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_PROVIDER_EVENT_IMMUTABLE';
  END IF;
  IF current_command_id IS NULL OR NEW."commandId" <> current_command_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_PROVIDER_COMMAND_CONTEXT_MISMATCH';
  END IF;
  IF NEW."actorUserId" <> public.app_identity_user_id()
     OR NEW."actorMembershipId" IS DISTINCT FROM public.app_pc_crop_membership_id()
     OR NEW."organizationId" <> public.app_identity_org_id()
     OR NEW."tenantId" <> public.app_identity_tenant_id() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_PROVIDER_ACTOR_CONTEXT_MISMATCH';
  END IF;

  SELECT event."hash" INTO expected_prev_hash
  FROM public."provider_registry_events" event
  WHERE event."providerId" = NEW."providerId"
  ORDER BY event."createdAt" DESC, event."id" DESC
  LIMIT 1;
  IF NEW."prevHash" IS DISTINCT FROM expected_prev_hash THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_PROVIDER_EVENT_CHAIN_MISMATCH';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER provider_registry_provider_guard
BEFORE UPDATE OR DELETE ON public."providers"
FOR EACH ROW EXECUTE FUNCTION public.app_provider_registry_guard_provider();

CREATE TRIGGER provider_registry_capability_guard
BEFORE INSERT OR UPDATE OR DELETE ON public."provider_capabilities"
FOR EACH ROW EXECUTE FUNCTION public.app_provider_registry_guard_capability();

CREATE TRIGGER provider_registry_offering_guard
BEFORE INSERT OR UPDATE OR DELETE ON public."service_offerings"
FOR EACH ROW EXECUTE FUNCTION public.app_provider_registry_guard_offering();

CREATE TRIGGER provider_registry_evidence_guard
BEFORE INSERT OR UPDATE OR DELETE ON public."provider_registry_evidence"
FOR EACH ROW EXECUTE FUNCTION public.app_provider_registry_guard_evidence();

CREATE TRIGGER provider_registry_event_guard
BEFORE INSERT OR UPDATE OR DELETE ON public."provider_registry_events"
FOR EACH ROW EXECUTE FUNCTION public.app_provider_registry_guard_event();

ALTER TABLE public."providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."providers" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."provider_capabilities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."provider_capabilities" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."service_offerings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."service_offerings" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."provider_registry_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."provider_registry_evidence" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."provider_registry_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."provider_registry_events" FORCE ROW LEVEL SECURITY;

CREATE POLICY provider_select
ON public."providers"
FOR SELECT USING (
  public.app_pc_crop_membership_id() IS NOT NULL
  AND "tenantId" = public.app_identity_tenant_id()
  AND ("organizationId" = public.app_identity_org_id() OR "status" = 'ACTIVE')
);

CREATE POLICY provider_insert
ON public."providers"
FOR INSERT WITH CHECK (
  public.app_organization_capability_is_org_admin()
  AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id()
  AND "status" = 'PENDING_VERIFICATION'
  AND "createdByMembershipId" = public.app_pc_crop_membership_id()
  AND "updatedByMembershipId" = public.app_pc_crop_membership_id()
);

CREATE POLICY provider_update
ON public."providers"
FOR UPDATE USING (
  public.app_organization_capability_is_org_admin()
  AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id()
) WITH CHECK (
  public.app_organization_capability_is_org_admin()
  AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id()
  AND "updatedByMembershipId" = public.app_pc_crop_membership_id()
);

CREATE POLICY provider_capability_select
ON public."provider_capabilities"
FOR SELECT USING (
  public.app_pc_crop_membership_id() IS NOT NULL
  AND "tenantId" = public.app_identity_tenant_id()
  AND ("organizationId" = public.app_identity_org_id() OR "status" = 'ACTIVE')
);

CREATE POLICY provider_capability_insert
ON public."provider_capabilities"
FOR INSERT WITH CHECK (
  public.app_organization_capability_is_org_admin()
  AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id()
  AND "status" = 'PENDING_VERIFICATION'
  AND "createdByMembershipId" = public.app_pc_crop_membership_id()
  AND "updatedByMembershipId" = public.app_pc_crop_membership_id()
);

CREATE POLICY provider_capability_update
ON public."provider_capabilities"
FOR UPDATE USING (
  public.app_organization_capability_is_org_admin()
  AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id()
) WITH CHECK (
  public.app_organization_capability_is_org_admin()
  AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id()
  AND "status" IN ('PENDING_VERIFICATION', 'REVOKED')
  AND "updatedByMembershipId" = public.app_pc_crop_membership_id()
);

CREATE POLICY service_offering_select
ON public."service_offerings"
FOR SELECT USING (
  public.app_pc_crop_membership_id() IS NOT NULL
  AND "tenantId" = public.app_identity_tenant_id()
  AND ("organizationId" = public.app_identity_org_id() OR "status" = 'ACTIVE')
);

CREATE POLICY service_offering_insert
ON public."service_offerings"
FOR INSERT WITH CHECK (
  public.app_organization_capability_is_org_admin()
  AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id()
  AND "status" = 'PENDING_VERIFICATION'
  AND "createdByMembershipId" = public.app_pc_crop_membership_id()
  AND "updatedByMembershipId" = public.app_pc_crop_membership_id()
);

CREATE POLICY service_offering_update
ON public."service_offerings"
FOR UPDATE USING (
  public.app_organization_capability_is_org_admin()
  AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id()
) WITH CHECK (
  public.app_organization_capability_is_org_admin()
  AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id()
  AND "status" IN ('PENDING_VERIFICATION', 'WITHDRAWN')
  AND "updatedByMembershipId" = public.app_pc_crop_membership_id()
);

CREATE POLICY provider_registry_evidence_select
ON public."provider_registry_evidence"
FOR SELECT USING (
  public.app_pc_crop_membership_id() IS NOT NULL
  AND "tenantId" = public.app_identity_tenant_id()
  AND (
    "organizationId" = public.app_identity_org_id()
    OR EXISTS (
      SELECT 1
      FROM public."provider_capabilities" capability
      WHERE capability."id" = "provider_registry_evidence"."providerCapabilityId"
        AND capability."tenantId" = public.app_identity_tenant_id()
        AND capability."status" = 'ACTIVE'
    )
  )
);

CREATE POLICY provider_registry_event_select
ON public."provider_registry_events"
FOR SELECT USING (
  public.app_pc_crop_membership_id() IS NOT NULL
  AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id()
);

CREATE POLICY provider_registry_event_insert
ON public."provider_registry_events"
FOR INSERT WITH CHECK (
  public.app_organization_capability_is_org_admin()
  AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id()
  AND "actorUserId" = public.app_identity_user_id()
  AND "actorMembershipId" = public.app_pc_crop_membership_id()
);

CREATE POLICY outbox_entries_provider_registry_insert
ON public."outbox_entries"
FOR INSERT TO PUBLIC
WITH CHECK (
  current_user IN ('pc_deal_runtime', 'one_deal_app', 'app_deal', 'app_runtime', 'app_deal_api')
  AND public.app_rls_context_ready()
  AND "type" = 'provider.registry.changed.v1'
  AND "dealId" IS NULL
  AND "triggeredByUserId" = public.app_identity_user_id()
  AND "correlationId" IS NOT NULL
  AND "auditId" IS NOT NULL
  AND "idempotencyKey" ~ '^provider-registry:[0-9a-f]{64}$'
  AND "runtimeIdempotencyKey" = "idempotencyKey"
  AND "payload" ->> 'schema' = 'provider-registry.command.v1'
  AND "payload" #>> '{event,type}' = "type"
  AND "payload" #>> '{event,tenantId}' = public.app_identity_tenant_id()
  AND "payload" #>> '{event,organizationId}' = public.app_identity_org_id()
  AND "payload" #>> '{event,auditId}' = "auditId"
  AND "payload" #>> '{event,correlationId}' = "correlationId"
  AND EXISTS (
    SELECT 1
    FROM public."provider_registry_events" event
    WHERE event."outboxEntryId" = "outbox_entries"."id"
      AND event."auditEventId" = "outbox_entries"."auditId"
      AND event."tenantId" = public.app_identity_tenant_id()
      AND event."organizationId" = public.app_identity_org_id()
      AND event."actorUserId" = public.app_identity_user_id()
      AND event."actorRole" = current_setting('app.current_role', true)
      AND event."correlationId" = "outbox_entries"."correlationId"
      AND event."commandId" = "payload" #>> '{event,commandId}'
      AND event."providerId" = "payload" #>> '{event,providerId}'
      AND event."entityType" = "payload" #>> '{event,entityType}'
      AND event."entityId" = "payload" #>> '{event,entityId}'
      AND event."category" = "payload" #>> '{event,category}'
      AND event."action" = "payload" #>> '{event,action}'
      AND event."resultStatus" = "payload" #>> '{event,status}'
      AND event."requestFingerprint" = "payload" ->> 'requestFingerprint'
      AND event."aggregateVersion"::text = "payload" #>> '{event,aggregateVersion}'
  )
);

REVOKE ALL ON FUNCTION public.app_provider_registry_guard_provider() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_provider_registry_guard_capability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_provider_registry_guard_offering() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_provider_registry_guard_evidence() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_provider_registry_guard_event() FROM PUBLIC;

DO $provider_registry_runtime_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_deal_runtime', 'one_deal_app', 'app_deal', 'app_runtime', 'app_deal_api')
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', runtime_role);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public."providers" TO %I', runtime_role);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public."provider_capabilities" TO %I', runtime_role);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public."service_offerings" TO %I', runtime_role);
    EXECUTE format('GRANT SELECT ON public."provider_registry_evidence" TO %I', runtime_role);
    EXECUTE format('GRANT SELECT, INSERT ON public."provider_registry_events" TO %I', runtime_role);
    EXECUTE format('GRANT SELECT, INSERT ON public."audit_events" TO %I', runtime_role);
    EXECUTE format('GRANT INSERT ON public."outbox_entries" TO %I', runtime_role);
  END LOOP;

  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'pc_auth_runtime', 'pc_staff_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
      'one_deal_auth', 'one_deal_staff', 'one_deal_storage',
      'app_auth', 'app_staff', 'app_storage', 'app_outbox'
    )
  LOOP
    EXECUTE format('REVOKE ALL ON public."providers" FROM %I', runtime_role);
    EXECUTE format('REVOKE ALL ON public."provider_capabilities" FROM %I', runtime_role);
    EXECUTE format('REVOKE ALL ON public."service_offerings" FROM %I', runtime_role);
    EXECUTE format('REVOKE ALL ON public."provider_registry_evidence" FROM %I', runtime_role);
    EXECUTE format('REVOKE ALL ON public."provider_registry_events" FROM %I', runtime_role);
  END LOOP;
END
$provider_registry_runtime_grants$;
