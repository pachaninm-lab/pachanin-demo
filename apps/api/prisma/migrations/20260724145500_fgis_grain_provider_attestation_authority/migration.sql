CREATE TABLE public."fgis_grain_provider_configurations" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "adapterCode" text NOT NULL DEFAULT 'FGIS_ZERNO',
  "apiVersion" text NOT NULL DEFAULT '1.0.23',
  "mappingVersion" text NOT NULL DEFAULT 'fgis-zerno-1.0.23-catalog.v1',
  "signingPolicyVersion" text NOT NULL DEFAULT 'fgis-zerno-1.0.23-signing-policy.v1',
  "environment" text NOT NULL,
  "endpointReference" text NOT NULL,
  "tlsPolicyReference" text NOT NULL,
  "credentialReference" text NOT NULL,
  "signingKeyReference" text NOT NULL,
  "payloadStoreReference" text NOT NULL,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "version" bigint NOT NULL DEFAULT 0,
  "createdByUserId" text NOT NULL,
  "updatedByUserId" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "fgis_grain_provider_config_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_provider_config_created_user_fk"
    FOREIGN KEY ("createdByUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_provider_config_updated_user_fk"
    FOREIGN KEY ("updatedByUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_provider_config_adapter_ck"
    CHECK ("adapterCode" = 'FGIS_ZERNO'),
  CONSTRAINT "fgis_grain_provider_config_api_ck"
    CHECK ("apiVersion" = '1.0.23'),
  CONSTRAINT "fgis_grain_provider_config_mapping_ck"
    CHECK ("mappingVersion" = 'fgis-zerno-1.0.23-catalog.v1'),
  CONSTRAINT "fgis_grain_provider_config_signing_ck"
    CHECK ("signingPolicyVersion" = 'fgis-zerno-1.0.23-signing-policy.v1'),
  CONSTRAINT "fgis_grain_provider_config_environment_ck"
    CHECK ("environment" IN ('PRE_PRODUCTION', 'PRODUCTION')),
  CONSTRAINT "fgis_grain_provider_config_status_ck"
    CHECK ("status" IN ('DRAFT', 'UNDER_REVIEW', 'TEST_APPROVED', 'SUSPENDED', 'REVOKED')),
  CONSTRAINT "fgis_grain_provider_config_version_ck"
    CHECK ("version" >= 0),
  CONSTRAINT "fgis_grain_provider_config_tenant_org_env_key"
    UNIQUE ("tenantId", "organizationId", "adapterCode", "environment")
);

CREATE INDEX "fgis_grain_provider_config_status_idx"
  ON public."fgis_grain_provider_configurations" ("tenantId", "organizationId", "status");
CREATE INDEX "fgis_grain_provider_config_updated_idx"
  ON public."fgis_grain_provider_configurations" ("updatedAt" DESC, "id");

CREATE TABLE public."fgis_grain_provider_attestations" (
  "id" text PRIMARY KEY,
  "configurationId" text NOT NULL,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "gate" text NOT NULL,
  "decision" text NOT NULL,
  "configurationVersion" bigint NOT NULL,
  "actorUserId" text NOT NULL,
  "actorRole" text NOT NULL,
  "mfaVerified" boolean NOT NULL,
  "justification" text NOT NULL,
  "evidenceReference" text NOT NULL,
  "validUntil" timestamptz NOT NULL,
  "idempotencyKey" text NOT NULL UNIQUE,
  "correlationId" text NOT NULL,
  "hash" text NOT NULL,
  "prevHash" text,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "fgis_grain_provider_attestation_config_fk"
    FOREIGN KEY ("configurationId")
    REFERENCES public."fgis_grain_provider_configurations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_provider_attestation_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_provider_attestation_user_fk"
    FOREIGN KEY ("actorUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_provider_attestation_gate_ck"
    CHECK ("gate" IN ('OWNER', 'SECURITY', 'LEGAL', 'OPERATIONS')),
  CONSTRAINT "fgis_grain_provider_attestation_decision_ck"
    CHECK ("decision" IN ('APPROVED', 'REJECTED')),
  CONSTRAINT "fgis_grain_provider_attestation_version_ck"
    CHECK ("configurationVersion" >= 0),
  CONSTRAINT "fgis_grain_provider_attestation_mfa_ck"
    CHECK ("mfaVerified" IS TRUE),
  CONSTRAINT "fgis_grain_provider_attestation_hash_ck"
    CHECK ("hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_provider_attestation_prev_hash_ck"
    CHECK ("prevHash" IS NULL OR "prevHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_provider_attestation_ttl_ck"
    CHECK ("validUntil" > "createdAt")
);

CREATE INDEX "fgis_grain_provider_attestation_config_idx"
  ON public."fgis_grain_provider_attestations"
  ("configurationId", "configurationVersion", "gate", "createdAt" DESC, "id" DESC);
CREATE INDEX "fgis_grain_provider_attestation_expiry_idx"
  ON public."fgis_grain_provider_attestations" ("validUntil");
CREATE INDEX "fgis_grain_provider_attestation_actor_idx"
  ON public."fgis_grain_provider_attestations" ("actorUserId", "createdAt" DESC);

CREATE OR REPLACE FUNCTION public.reject_fgis_grain_provider_attestation_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'FGIS Grain provider attestations are immutable'
    USING ERRCODE = '55000';
END;
$function$;

CREATE TRIGGER "fgis_grain_provider_attestations_no_update"
BEFORE UPDATE ON public."fgis_grain_provider_attestations"
FOR EACH ROW EXECUTE FUNCTION public.reject_fgis_grain_provider_attestation_mutation();

CREATE TRIGGER "fgis_grain_provider_attestations_no_delete"
BEFORE DELETE ON public."fgis_grain_provider_attestations"
FOR EACH ROW EXECUTE FUNCTION public.reject_fgis_grain_provider_attestation_mutation();

ALTER TABLE public."fgis_grain_provider_configurations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_provider_configurations" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_provider_attestations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_provider_attestations" FORCE ROW LEVEL SECURITY;

CREATE POLICY "fgis_grain_provider_config_tenant_org_policy"
ON public."fgis_grain_provider_configurations"
FOR ALL
USING (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
)
WITH CHECK (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
);

CREATE POLICY "fgis_grain_provider_attestation_tenant_org_policy"
ON public."fgis_grain_provider_attestations"
FOR ALL
USING (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
)
WITH CHECK (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
);
