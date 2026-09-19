-- PC-CROP W1-C: durable provider-neutral IntegrationBinding authority and the
-- canonical evidence-backed integration capability maturity ladder.
-- Organization users can declare references only into PENDING_VERIFICATION.
-- They cannot activate bindings, write evidence or assert LIVE_ACCEPTED.

CREATE TABLE public."integration_bindings" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "providerId" text NOT NULL,
  "providerCapabilityId" text NOT NULL,
  "bindingKey" text NOT NULL,
  "capabilityCode" text NOT NULL,
  "transportType" text NOT NULL,
  "environment" text NOT NULL,
  "endpointReference" text,
  "credentialReference" text,
  "status" text NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "version" bigint NOT NULL DEFAULT 1,
  "createdByMembershipId" text NOT NULL,
  "updatedByMembershipId" text NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "integration_binding_provider_key" UNIQUE ("providerId", "bindingKey"),
  CONSTRAINT "integration_binding_scope_identity_key" UNIQUE ("id", "tenantId", "organizationId"),
  CONSTRAINT "integration_binding_evidence_identity_key" UNIQUE ("id", "providerId", "tenantId", "organizationId"),
  CONSTRAINT "integration_binding_provider_fkey"
    FOREIGN KEY ("providerId", "tenantId", "organizationId")
    REFERENCES public."providers" ("id", "tenantId", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "integration_binding_provider_capability_fkey"
    FOREIGN KEY ("providerCapabilityId", "providerId", "tenantId", "organizationId")
    REFERENCES public."provider_capabilities" ("id", "providerId", "tenantId", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "integration_binding_organization_fkey"
    FOREIGN KEY ("organizationId", "tenantId")
    REFERENCES public."organizations" ("id", "tenantId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "integration_binding_created_by_fkey"
    FOREIGN KEY ("createdByMembershipId", "organizationId")
    REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "integration_binding_updated_by_fkey"
    FOREIGN KEY ("updatedByMembershipId", "organizationId")
    REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "integration_binding_key_check"
    CHECK ("bindingKey" ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{2,79}$'),
  CONSTRAINT "integration_binding_capability_code_check"
    CHECK ("capabilityCode" ~ '^[A-Z][A-Z0-9_.-]{2,79}$'),
  CONSTRAINT "integration_binding_transport_check" CHECK (
    "transportType" IN ('REST', 'WEBHOOK', '1C', 'SFTP', 'FILE', 'DEEPLINK', 'PLATFORM_UI', 'MANUAL')
  ),
  CONSTRAINT "integration_binding_environment_check"
    CHECK ("environment" ~ '^[A-Z][A-Z0-9_]{1,31}$'),
  CONSTRAINT "integration_binding_reference_check" CHECK (
    ("endpointReference" IS NULL OR (
      length(btrim("endpointReference")) BETWEEN 3 AND 240
      AND "endpointReference" ~ '^(endpoint|config|binding):[A-Za-z0-9][A-Za-z0-9:_.\/-]{1,220}$'
      AND "endpointReference" !~ '[?@=]'
    ))
    AND ("credentialReference" IS NULL OR (
      length(btrim("credentialReference")) BETWEEN 3 AND 240
      AND "credentialReference" ~ '^(secret|vault|kms|credential):[A-Za-z0-9][A-Za-z0-9:_.\/-]{1,220}$'
      AND "credentialReference" !~ '[?@=]'
    ))
  ),
  CONSTRAINT "integration_binding_status_check" CHECK (
    "status" IN ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'WITHDRAWN')
  ),
  CONSTRAINT "integration_binding_version_check" CHECK ("version" >= 1)
);

CREATE INDEX "integration_binding_org_status_idx"
  ON public."integration_bindings" ("tenantId", "organizationId", "status");
CREATE INDEX "integration_binding_capability_status_idx"
  ON public."integration_bindings" ("providerCapabilityId", "status");

CREATE TABLE public."integration_capability_evidence" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "providerId" text NOT NULL,
  "integrationBindingId" text NOT NULL,
  "maturity" text NOT NULL,
  "evidenceReference" text NOT NULL,
  "evidenceIssuer" text NOT NULL,
  "externalReceiptId" text,
  "checkedAt" timestamptz(6) NOT NULL,
  "expiresAt" timestamptz(6),
  "version" bigint NOT NULL DEFAULT 1,
  "recordedByAuthority" text NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "integration_capability_evidence_version_key"
    UNIQUE ("integrationBindingId", "maturity", "version"),
  CONSTRAINT "integration_capability_evidence_binding_fkey"
    FOREIGN KEY ("integrationBindingId", "providerId", "tenantId", "organizationId")
    REFERENCES public."integration_bindings" ("id", "providerId", "tenantId", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "integration_capability_evidence_maturity_check" CHECK (
    "maturity" IN (
      'PUBLIC_SPEC_VERIFIED', 'CONTRACT_MAPPED', 'ADAPTER_IMPLEMENTED',
      'CONTRACT_TESTED', 'EXTERNAL_ACCESS_PENDING', 'CONTRACT_PENDING',
      'LIVE_TESTING', 'LIVE_ACCEPTED', 'DEGRADED', 'SUSPENDED'
    )
  ),
  CONSTRAINT "integration_capability_evidence_text_check" CHECK (
    length(btrim("evidenceReference")) BETWEEN 3 AND 500
    AND length(btrim("evidenceIssuer")) BETWEEN 2 AND 160
    AND length(btrim("recordedByAuthority")) BETWEEN 3 AND 240
    AND ("externalReceiptId" IS NULL OR length(btrim("externalReceiptId")) BETWEEN 3 AND 240)
  ),
  CONSTRAINT "integration_capability_evidence_live_receipt_check" CHECK (
    "maturity" <> 'LIVE_ACCEPTED'
    OR (
      "externalReceiptId" IS NOT NULL
      AND upper(btrim("evidenceIssuer")) NOT IN ('PC_CROP', 'PLATFORM', 'SELF', 'INTERNAL')
    )
  ),
  CONSTRAINT "integration_capability_evidence_validity_check"
    CHECK ("expiresAt" IS NULL OR "expiresAt" > "checkedAt"),
  CONSTRAINT "integration_capability_evidence_version_check" CHECK ("version" >= 1)
);

CREATE INDEX "integration_capability_evidence_lookup_idx"
  ON public."integration_capability_evidence"
  ("tenantId", "organizationId", "integrationBindingId", "checkedAt" DESC);

CREATE TABLE public."integration_binding_events" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "providerId" text NOT NULL,
  "integrationBindingId" text NOT NULL,
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

  CONSTRAINT "integration_binding_event_command_key"
    UNIQUE ("tenantId", "organizationId", "commandId"),
  CONSTRAINT "integration_binding_event_idempotency_key"
    UNIQUE ("tenantId", "organizationId", "idempotencyKey"),
  CONSTRAINT "integration_binding_event_audit_key" UNIQUE ("auditEventId"),
  CONSTRAINT "integration_binding_event_outbox_key" UNIQUE ("outboxEntryId"),
  CONSTRAINT "integration_binding_event_binding_fkey"
    FOREIGN KEY ("integrationBindingId", "tenantId", "organizationId")
    REFERENCES public."integration_bindings" ("id", "tenantId", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "integration_binding_event_organization_fkey"
    FOREIGN KEY ("organizationId", "tenantId")
    REFERENCES public."organizations" ("id", "tenantId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "integration_binding_event_actor_fkey"
    FOREIGN KEY ("actorMembershipId", "organizationId")
    REFERENCES public."user_orgs" ("id", "organizationId")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "integration_binding_event_action_check" CHECK ("action" IN ('UPSERT', 'WITHDRAW')),
  CONSTRAINT "integration_binding_event_hash_check" CHECK (
    "requestFingerprint" ~ '^[0-9a-f]{64}$'
    AND "hash" ~ '^[0-9a-f]{64}$'
    AND ("prevHash" IS NULL OR "prevHash" ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT "integration_binding_event_reason_check"
    CHECK (length(btrim("reason")) BETWEEN 10 AND 2000),
  CONSTRAINT "integration_binding_event_version_check" CHECK ("aggregateVersion" >= 1)
);

CREATE INDEX "integration_binding_event_chain_idx"
  ON public."integration_binding_events" ("integrationBindingId", "createdAt", "id");

CREATE OR REPLACE FUNCTION public.app_integration_binding_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_INTEGRATION_BINDING_DELETE_FORBIDDEN';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW."id" <> OLD."id"
       OR NEW."tenantId" <> OLD."tenantId"
       OR NEW."organizationId" <> OLD."organizationId"
       OR NEW."providerId" <> OLD."providerId"
       OR NEW."providerCapabilityId" <> OLD."providerCapabilityId"
       OR NEW."bindingKey" <> OLD."bindingKey"
       OR NEW."capabilityCode" <> OLD."capabilityCode"
       OR NEW."createdByMembershipId" <> OLD."createdByMembershipId"
       OR NEW."createdAt" <> OLD."createdAt" THEN
      RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_INTEGRATION_BINDING_IDENTITY_IMMUTABLE';
    END IF;
    IF NEW."version" <> OLD."version" + 1 THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'PC_INTEGRATION_BINDING_VERSION_CONFLICT';
    END IF;
  END IF;
  IF current_user IN ('pc_deal_runtime', 'one_deal_app', 'app_deal', 'app_runtime', 'app_deal_api')
     AND NEW."status" NOT IN ('PENDING_VERIFICATION', 'WITHDRAWN') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_INTEGRATION_BINDING_SELF_ACTIVATION_FORBIDDEN';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.app_integration_capability_evidence_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_INTEGRATION_CAPABILITY_EVIDENCE_IMMUTABLE';
  END IF;
  IF current_user IN ('pc_deal_runtime', 'one_deal_app', 'app_deal', 'app_runtime', 'app_deal_api') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_INTEGRATION_CAPABILITY_EVIDENCE_AUTHORITY_REQUIRED';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.app_integration_binding_event_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  expected_prev_hash text;
  current_command_id text := nullif(current_setting('app.current_command_id', true), '');
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_INTEGRATION_BINDING_EVENT_IMMUTABLE';
  END IF;
  IF current_command_id IS NULL OR NEW."commandId" <> current_command_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_INTEGRATION_BINDING_COMMAND_CONTEXT_MISMATCH';
  END IF;
  IF NEW."actorUserId" <> public.app_identity_user_id()
     OR NEW."actorMembershipId" IS DISTINCT FROM public.app_pc_crop_membership_id()
     OR NEW."organizationId" <> public.app_identity_org_id()
     OR NEW."tenantId" <> public.app_identity_tenant_id() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PC_INTEGRATION_BINDING_ACTOR_CONTEXT_MISMATCH';
  END IF;
  SELECT event."hash" INTO expected_prev_hash
    FROM public."integration_binding_events" event
   WHERE event."integrationBindingId" = NEW."integrationBindingId"
   ORDER BY event."createdAt" DESC, event."id" DESC
   LIMIT 1;
  IF NEW."prevHash" IS DISTINCT FROM expected_prev_hash THEN
    RAISE EXCEPTION USING ERRCODE = '23000', MESSAGE = 'PC_INTEGRATION_BINDING_EVENT_CHAIN_MISMATCH';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER integration_binding_guard
BEFORE INSERT OR UPDATE OR DELETE ON public."integration_bindings"
FOR EACH ROW EXECUTE FUNCTION public.app_integration_binding_guard();

CREATE TRIGGER integration_capability_evidence_guard
BEFORE INSERT OR UPDATE OR DELETE ON public."integration_capability_evidence"
FOR EACH ROW EXECUTE FUNCTION public.app_integration_capability_evidence_guard();

CREATE TRIGGER integration_binding_event_guard
BEFORE INSERT OR UPDATE OR DELETE ON public."integration_binding_events"
FOR EACH ROW EXECUTE FUNCTION public.app_integration_binding_event_guard();

ALTER TABLE public."integration_bindings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."integration_bindings" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."integration_capability_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."integration_capability_evidence" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."integration_binding_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."integration_binding_events" FORCE ROW LEVEL SECURITY;

CREATE POLICY integration_binding_select
ON public."integration_bindings"
FOR SELECT USING (
  public.app_pc_crop_membership_id() IS NOT NULL
  AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id()
);

CREATE POLICY integration_binding_insert
ON public."integration_bindings"
FOR INSERT WITH CHECK (
  public.app_organization_capability_is_org_admin()
  AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id()
  AND "status" = 'PENDING_VERIFICATION'
  AND "createdByMembershipId" = public.app_pc_crop_membership_id()
  AND "updatedByMembershipId" = public.app_pc_crop_membership_id()
);

CREATE POLICY integration_binding_update
ON public."integration_bindings"
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

CREATE POLICY integration_capability_evidence_select
ON public."integration_capability_evidence"
FOR SELECT USING (
  public.app_pc_crop_membership_id() IS NOT NULL
  AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id()
);

CREATE POLICY integration_binding_event_select
ON public."integration_binding_events"
FOR SELECT USING (
  public.app_pc_crop_membership_id() IS NOT NULL
  AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id()
);

CREATE POLICY integration_binding_event_insert
ON public."integration_binding_events"
FOR INSERT WITH CHECK (
  public.app_organization_capability_is_org_admin()
  AND "tenantId" = public.app_identity_tenant_id()
  AND "organizationId" = public.app_identity_org_id()
  AND "actorUserId" = public.app_identity_user_id()
  AND "actorMembershipId" = public.app_pc_crop_membership_id()
);

CREATE POLICY outbox_entries_integration_binding_insert
ON public."outbox_entries"
FOR INSERT TO PUBLIC
WITH CHECK (
  current_user IN ('pc_deal_runtime', 'one_deal_app', 'app_deal', 'app_runtime', 'app_deal_api')
  AND public.app_rls_context_ready()
  AND "type" = 'integration.binding.changed.v1'
  AND "dealId" IS NULL
  AND "triggeredByUserId" = public.app_identity_user_id()
  AND "correlationId" IS NOT NULL
  AND "auditId" IS NOT NULL
  AND "idempotencyKey" ~ '^integration-binding:[0-9a-f]{64}$'
  AND "runtimeIdempotencyKey" = "idempotencyKey"
  AND "payload" ->> 'schema' = 'integration-binding.command.v1'
  AND "payload" #>> '{event,type}' = "type"
  AND "payload" #>> '{event,tenantId}' = public.app_identity_tenant_id()
  AND "payload" #>> '{event,organizationId}' = public.app_identity_org_id()
  AND "payload" #>> '{event,auditId}' = "auditId"
  AND "payload" #>> '{event,correlationId}' = "correlationId"
  AND EXISTS (
    SELECT 1 FROM public."integration_binding_events" event
    WHERE event."outboxEntryId" = "outbox_entries"."id"
      AND event."auditEventId" = "outbox_entries"."auditId"
      AND event."tenantId" = public.app_identity_tenant_id()
      AND event."organizationId" = public.app_identity_org_id()
      AND event."actorUserId" = public.app_identity_user_id()
      AND event."actorRole" = current_setting('app.current_role', true)
      AND event."correlationId" = "outbox_entries"."correlationId"
      AND event."commandId" = "payload" #>> '{event,commandId}'
      AND event."integrationBindingId" = "payload" #>> '{event,integrationBindingId}'
      AND event."action" = "payload" #>> '{event,action}'
      AND event."resultStatus" = "payload" #>> '{event,status}'
      AND event."requestFingerprint" = "payload" ->> 'requestFingerprint'
      AND event."aggregateVersion"::text = "payload" #>> '{event,aggregateVersion}'
  )
);

REVOKE ALL ON FUNCTION public.app_integration_binding_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_integration_capability_evidence_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_integration_binding_event_guard() FROM PUBLIC;

DO $integration_binding_runtime_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_deal_runtime', 'one_deal_app', 'app_deal', 'app_runtime', 'app_deal_api')
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', runtime_role);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public."integration_bindings" TO %I', runtime_role);
    EXECUTE format('GRANT SELECT ON public."integration_capability_evidence" TO %I', runtime_role);
    EXECUTE format('GRANT SELECT, INSERT ON public."integration_binding_events" TO %I', runtime_role);
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
    EXECUTE format('REVOKE ALL ON public."integration_bindings" FROM %I', runtime_role);
    EXECUTE format('REVOKE ALL ON public."integration_capability_evidence" FROM %I', runtime_role);
    EXECUTE format('REVOKE ALL ON public."integration_binding_events" FROM %I', runtime_role);
  END LOOP;
END
$integration_binding_runtime_grants$;
