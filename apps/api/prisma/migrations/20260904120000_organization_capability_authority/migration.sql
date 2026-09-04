-- PC-CROP W1-A: tenant-scoped organization capability authority (shadow mode).
-- No registration, role-eligibility, Auction, Deal or Settlement policy reads
-- these tables in this slice.

CREATE TABLE public."organization_capability_assignments" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "capabilityCode" text NOT NULL,
  "status" text NOT NULL,
  "requiresVerification" boolean NOT NULL,
  "provenance" text NOT NULL DEFAULT 'SELF_DECLARED',
  "evidenceReference" text,
  "effectiveFrom" timestamptz(6),
  "effectiveTo" timestamptz(6),
  "version" bigint NOT NULL DEFAULT 1,
  "createdByMembershipId" text NOT NULL,
  "updatedByMembershipId" text NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organization_capability_org_code_key"
    UNIQUE ("organizationId", "capabilityCode"),
  CONSTRAINT "organization_capability_identity_key"
    UNIQUE ("id", "tenantId", "organizationId"),
  CONSTRAINT "organization_capability_organization_fkey"
    FOREIGN KEY ("organizationId", "tenantId")
    REFERENCES public."organizations" ("id", "tenantId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "organization_capability_created_by_fkey"
    FOREIGN KEY ("createdByMembershipId", "organizationId")
    REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "organization_capability_updated_by_fkey"
    FOREIGN KEY ("updatedByMembershipId", "organizationId")
    REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "organization_capability_code_check" CHECK (
    "capabilityCode" IN (
      'SELL_CROP', 'BUY_CROP', 'OWN_TRANSPORT', 'PROVIDE_LOGISTICS',
      'PROVIDE_EXPEDITION', 'STORE_CROP', 'PROVIDE_ELEVATOR_SERVICES',
      'PROVIDE_LAB_TESTING', 'PROVIDE_SURVEYING', 'PROVIDE_FINANCING',
      'PROVIDE_INSURANCE', 'ACCOUNTING_INTEGRATION', 'API_INTEGRATION'
    )
  ),
  CONSTRAINT "organization_capability_status_check" CHECK (
    "status" IN ('ACTIVE', 'PENDING_VERIFICATION', 'REVOKED')
  ),
  CONSTRAINT "organization_capability_verification_class_check" CHECK (
    "requiresVerification" = ("capabilityCode" NOT IN (
      'SELL_CROP', 'BUY_CROP', 'OWN_TRANSPORT', 'STORE_CROP'
    ))
  ),
  CONSTRAINT "organization_capability_self_declaration_check" CHECK (
    "provenance" = 'SELF_DECLARED'
    AND "evidenceReference" IS NULL
    AND (
      NOT "requiresVerification"
      OR "status" IN ('PENDING_VERIFICATION', 'REVOKED')
    )
  ),
  CONSTRAINT "organization_capability_effectivity_check" CHECK (
    ("status" = 'ACTIVE' AND "effectiveFrom" IS NOT NULL AND "effectiveTo" IS NULL)
    OR ("status" = 'PENDING_VERIFICATION' AND "effectiveFrom" IS NULL AND "effectiveTo" IS NULL)
    OR ("status" = 'REVOKED' AND "effectiveTo" IS NOT NULL)
  ),
  CONSTRAINT "organization_capability_version_check" CHECK ("version" >= 1)
);

CREATE INDEX "organization_capability_scope_status_idx"
  ON public."organization_capability_assignments" ("tenantId", "organizationId", "status");

CREATE TABLE public."organization_capability_events" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "assignmentId" text NOT NULL,
  "commandId" text NOT NULL,
  "idempotencyKey" text NOT NULL,
  "requestFingerprint" text NOT NULL,
  "action" text NOT NULL,
  "fromStatus" text,
  "toStatus" text NOT NULL,
  "reason" text NOT NULL,
  "actorUserId" text NOT NULL,
  "actorRole" text NOT NULL,
  "actorMembershipId" text NOT NULL,
  "correlationId" text NOT NULL,
  "prevHash" text,
  "hash" text NOT NULL,
  "auditEventId" text NOT NULL,
  "outboxEntryId" text NOT NULL,
  "aggregateVersion" bigint NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organization_capability_event_command_key"
    UNIQUE ("tenantId", "organizationId", "commandId"),
  CONSTRAINT "organization_capability_event_audit_key" UNIQUE ("auditEventId"),
  CONSTRAINT "organization_capability_event_outbox_key" UNIQUE ("outboxEntryId"),
  CONSTRAINT "organization_capability_event_idempotency_key"
    UNIQUE ("tenantId", "organizationId", "idempotencyKey"),
  CONSTRAINT "organization_capability_event_assignment_fkey"
    FOREIGN KEY ("assignmentId", "tenantId", "organizationId")
    REFERENCES public."organization_capability_assignments" ("id", "tenantId", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "organization_capability_event_organization_fkey"
    FOREIGN KEY ("organizationId", "tenantId")
    REFERENCES public."organizations" ("id", "tenantId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "organization_capability_event_actor_fkey"
    FOREIGN KEY ("actorMembershipId", "organizationId")
    REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "organization_capability_event_action_check"
    CHECK ("action" IN ('DECLARE', 'REVOKE')),
  CONSTRAINT "organization_capability_event_status_check" CHECK (
    ("fromStatus" IS NULL OR "fromStatus" IN ('ACTIVE', 'PENDING_VERIFICATION', 'REVOKED'))
    AND "toStatus" IN ('ACTIVE', 'PENDING_VERIFICATION', 'REVOKED')
  ),
  CONSTRAINT "organization_capability_event_hash_check" CHECK (
    "requestFingerprint" ~ '^[0-9a-f]{64}$'
    AND "hash" ~ '^[0-9a-f]{64}$'
    AND ("prevHash" IS NULL OR "prevHash" ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT "organization_capability_event_version_check" CHECK ("aggregateVersion" >= 1),
  CONSTRAINT "organization_capability_event_reason_check"
    CHECK (length(btrim("reason")) BETWEEN 10 AND 2000)
);

CREATE INDEX "organization_capability_event_chain_idx"
  ON public."organization_capability_events" ("assignmentId", "createdAt", "id");
CREATE INDEX "organization_capability_event_scope_idx"
  ON public."organization_capability_events" ("tenantId", "organizationId", "createdAt");

-- Resolve organization administration from the ACTIVE membership row. The
-- client cannot set any of the inputs: identity settings are installed by the
-- trusted transaction wrapper and the membership is looked up in PostgreSQL.
CREATE OR REPLACE FUNCTION public.app_organization_capability_is_org_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public."user_orgs" membership
    WHERE membership."id" = public.app_pc_crop_membership_id()
      AND membership."userId" = public.app_identity_user_id()
      AND membership."organizationId" = public.app_identity_org_id()
      AND membership."status" = 'ACTIVE'
      AND (membership."is_org_admin" OR membership."role" IN ('ADMIN', 'EXECUTIVE'))
  );
$function$;

DO $organization_capability_function_owner$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_identity_bootstrap') THEN
    ALTER FUNCTION public.app_organization_capability_is_org_admin()
      OWNER TO pc_identity_bootstrap;
    GRANT SELECT ("id", "userId", "organizationId", "status", "is_org_admin", "role")
      ON public."user_orgs" TO pc_identity_bootstrap;
  END IF;
END
$organization_capability_function_owner$;
REVOKE ALL ON FUNCTION public.app_organization_capability_is_org_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_organization_capability_is_org_admin() TO PUBLIC;

CREATE OR REPLACE FUNCTION public.app_organization_capability_guard_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '23000',
      MESSAGE = 'PC_ORG_CAPABILITY_DELETE_FORBIDDEN';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW."id" <> OLD."id"
       OR NEW."tenantId" <> OLD."tenantId"
       OR NEW."organizationId" <> OLD."organizationId"
       OR NEW."capabilityCode" <> OLD."capabilityCode"
       OR NEW."requiresVerification" <> OLD."requiresVerification"
       OR NEW."provenance" <> OLD."provenance"
       OR NEW."createdByMembershipId" <> OLD."createdByMembershipId"
       OR NEW."createdAt" <> OLD."createdAt" THEN
      RAISE EXCEPTION USING ERRCODE = '23000',
        MESSAGE = 'PC_ORG_CAPABILITY_IDENTITY_IMMUTABLE';
    END IF;
    IF NEW."version" <> OLD."version" + 1 THEN
      RAISE EXCEPTION USING ERRCODE = '40001',
        MESSAGE = 'PC_ORG_CAPABILITY_VERSION_CONFLICT';
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.app_organization_capability_guard_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  expected_prev_hash text;
  current_command_id text := nullif(current_setting('app.current_command_id', true), '');
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION USING ERRCODE = '23000',
      MESSAGE = 'PC_ORG_CAPABILITY_EVENT_IMMUTABLE';
  END IF;
  IF current_command_id IS NULL OR NEW."commandId" <> current_command_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'PC_ORG_CAPABILITY_COMMAND_CONTEXT_MISMATCH';
  END IF;
  IF NEW."actorUserId" <> public.app_identity_user_id()
     OR NEW."actorMembershipId" IS DISTINCT FROM public.app_pc_crop_membership_id()
     OR NEW."organizationId" <> public.app_identity_org_id()
     OR NEW."tenantId" <> public.app_identity_tenant_id() THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'PC_ORG_CAPABILITY_ACTOR_CONTEXT_MISMATCH';
  END IF;

  SELECT event."hash" INTO expected_prev_hash
  FROM public."organization_capability_events" event
  WHERE event."assignmentId" = NEW."assignmentId"
  ORDER BY event."createdAt" DESC, event."id" DESC
  LIMIT 1;
  IF NEW."prevHash" IS DISTINCT FROM expected_prev_hash THEN
    RAISE EXCEPTION USING ERRCODE = '23000',
      MESSAGE = 'PC_ORG_CAPABILITY_EVENT_CHAIN_MISMATCH';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER organization_capability_assignment_guard
BEFORE UPDATE OR DELETE ON public."organization_capability_assignments"
FOR EACH ROW EXECUTE FUNCTION public.app_organization_capability_guard_assignment();

CREATE TRIGGER organization_capability_event_guard
BEFORE INSERT OR UPDATE OR DELETE ON public."organization_capability_events"
FOR EACH ROW EXECUTE FUNCTION public.app_organization_capability_guard_event();

ALTER TABLE public."organization_capability_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."organization_capability_assignments" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."organization_capability_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."organization_capability_events" FORCE ROW LEVEL SECURITY;

CREATE POLICY organization_capability_assignment_select
ON public."organization_capability_assignments"
FOR SELECT USING (
  public.app_pc_crop_membership_id() IS NOT NULL
  AND "organizationId" = public.app_identity_org_id()
  AND "tenantId" = public.app_identity_tenant_id()
);

CREATE POLICY organization_capability_assignment_insert
ON public."organization_capability_assignments"
FOR INSERT WITH CHECK (
  public.app_organization_capability_is_org_admin()
  AND "organizationId" = public.app_identity_org_id()
  AND "tenantId" = public.app_identity_tenant_id()
  AND "createdByMembershipId" = public.app_pc_crop_membership_id()
  AND "updatedByMembershipId" = public.app_pc_crop_membership_id()
);

CREATE POLICY organization_capability_assignment_update
ON public."organization_capability_assignments"
FOR UPDATE USING (
  public.app_organization_capability_is_org_admin()
  AND "organizationId" = public.app_identity_org_id()
  AND "tenantId" = public.app_identity_tenant_id()
) WITH CHECK (
  public.app_organization_capability_is_org_admin()
  AND "organizationId" = public.app_identity_org_id()
  AND "tenantId" = public.app_identity_tenant_id()
  AND "updatedByMembershipId" = public.app_pc_crop_membership_id()
);

CREATE POLICY organization_capability_event_select
ON public."organization_capability_events"
FOR SELECT USING (
  public.app_pc_crop_membership_id() IS NOT NULL
  AND "organizationId" = public.app_identity_org_id()
  AND "tenantId" = public.app_identity_tenant_id()
);

CREATE POLICY organization_capability_event_insert
ON public."organization_capability_events"
FOR INSERT WITH CHECK (
  public.app_organization_capability_is_org_admin()
  AND "organizationId" = public.app_identity_org_id()
  AND "tenantId" = public.app_identity_tenant_id()
  AND "actorUserId" = public.app_identity_user_id()
  AND "actorMembershipId" = public.app_pc_crop_membership_id()
);

-- The outbox policy below binds every emitted envelope to the audit row that
-- was inserted earlier in the same transaction. audit_events is FORCE-RLS, so
-- the restricted runtime needs a narrowly-scoped SELECT contour for that
-- integrity check; table ACLs still limit this to the explicit runtime roles.
CREATE POLICY audit_events_organization_capability_select
ON public."audit_events"
FOR SELECT TO PUBLIC
USING (
  current_user IN (
    'pc_deal_runtime', 'one_deal_app', 'app_deal', 'app_runtime', 'app_deal_api'
  )
  AND public.app_rls_context_ready()
  AND "tenantId" = public.app_identity_tenant_id()
  AND "orgId" = public.app_identity_org_id()
  AND "actorUserId" = public.app_identity_user_id()
  AND "objectType" = 'ORGANIZATION_CAPABILITY'
  AND "action" IN (
    'ORGANIZATION_CAPABILITY_DECLARE', 'ORGANIZATION_CAPABILITY_REVOKE'
  )
);

-- Canonical transactional outbox, narrowed to this exact organization-scoped
-- event envelope. The Deal-scoped producer policy deliberately rejects rows
-- without dealId, so this is a separate additive contour rather than a
-- relaxation of the Deal boundary.
CREATE POLICY outbox_entries_organization_capability_insert
ON public."outbox_entries"
FOR INSERT TO PUBLIC
WITH CHECK (
  current_user IN (
    'pc_deal_runtime', 'one_deal_app', 'app_deal', 'app_runtime', 'app_deal_api'
  )
  AND public.app_rls_context_ready()
  AND "type" = 'organization.capability.changed.v1'
  AND "dealId" IS NULL
  AND "triggeredByUserId" = public.app_identity_user_id()
  AND "correlationId" IS NOT NULL
  AND "auditId" IS NOT NULL
  AND "idempotencyKey" ~ '^org-cap:[0-9a-f]{64}$'
  AND "runtimeIdempotencyKey" = "idempotencyKey"
  AND "payload" ->> 'schema' = 'organization-capability.command.v1'
  AND "payload" #>> '{event,type}' = "type"
  AND "payload" #>> '{event,tenantId}' = public.app_identity_tenant_id()
  AND "payload" #>> '{event,organizationId}' = public.app_identity_org_id()
  AND "payload" #>> '{event,auditId}' = "auditId"
  AND "payload" #>> '{event,correlationId}' = "correlationId"
  AND EXISTS (
    SELECT 1
    FROM public."organization_capability_events" event
    WHERE event."outboxEntryId" = "outbox_entries"."id"
      AND event."auditEventId" = "outbox_entries"."auditId"
      AND event."tenantId" = public.app_identity_tenant_id()
      AND event."organizationId" = public.app_identity_org_id()
      AND event."actorUserId" = public.app_identity_user_id()
      AND event."actorRole" = current_setting('app.current_role', true)
      AND event."correlationId" = "outbox_entries"."correlationId"
      AND event."commandId" = "payload" #>> '{event,commandId}'
      AND event."assignmentId" = "payload" #>> '{event,aggregateId}'
      AND event."requestFingerprint" = "payload" ->> 'requestFingerprint'
      AND event."action" = "payload" #>> '{event,action}'
      AND event."toStatus" = "payload" #>> '{event,status}'
      AND event."aggregateVersion"::text = "payload" #>> '{event,aggregateVersion}'
  )
);

REVOKE ALL ON FUNCTION public.app_organization_capability_guard_assignment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_organization_capability_guard_event() FROM PUBLIC;

-- Only the deal/API runtimes may touch this contour, and never DELETE/TRUNCATE.
DO $organization_capability_runtime_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'pc_deal_runtime', 'one_deal_app', 'app_deal', 'app_runtime', 'app_deal_api'
    )
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', runtime_role);
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE ON public."organization_capability_assignments" TO %I',
      runtime_role
    );
    EXECUTE format(
      'GRANT SELECT, INSERT ON public."organization_capability_events" TO %I',
      runtime_role
    );
    EXECUTE format(
      'GRANT SELECT, INSERT ON public."audit_events" TO %I',
      runtime_role
    );
    EXECUTE format(
      'GRANT INSERT ON public."outbox_entries" TO %I',
      runtime_role
    );
  END LOOP;

  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'pc_auth_runtime', 'pc_staff_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
      'one_deal_auth', 'one_deal_staff', 'one_deal_storage',
      'app_auth', 'app_staff', 'app_storage', 'app_outbox'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON public."organization_capability_assignments" FROM %I',
      runtime_role
    );
    EXECUTE format(
      'REVOKE ALL ON public."organization_capability_events" FROM %I',
      runtime_role
    );
  END LOOP;
END
$organization_capability_runtime_grants$;
