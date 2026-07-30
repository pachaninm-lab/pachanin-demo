CREATE TABLE public."fgis_grain_tenant_read_authorizations" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "configurationId" text NOT NULL,
  "configurationVersion" bigint NOT NULL,
  "allowedOperations" text[] NOT NULL,
  "authorizationReference" text NOT NULL,
  "status" text NOT NULL DEFAULT 'ACCESS_REQUIRED',
  "validUntil" timestamptz NOT NULL,
  "reason" text NOT NULL,
  "attestationEvidenceReference" text,
  "attestationValidUntil" timestamptz,
  "attestationJustification" text,
  "attestedByUserId" text,
  "version" bigint NOT NULL DEFAULT 0,
  "createdByUserId" text NOT NULL,
  "updatedByUserId" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "fgis_grain_tenant_read_auth_config_fk"
    FOREIGN KEY ("configurationId")
    REFERENCES public."fgis_grain_provider_configurations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_auth_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_auth_created_user_fk"
    FOREIGN KEY ("createdByUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_auth_updated_user_fk"
    FOREIGN KEY ("updatedByUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_auth_attested_user_fk"
    FOREIGN KEY ("attestedByUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_auth_status_ck"
    CHECK ("status" IN (
      'ACCESS_REQUIRED',
      'AUTHORIZED_NOT_ATTESTED',
      'READ_ONLY_ATTESTED',
      'SUSPENDED',
      'REVOKED'
    )),
  CONSTRAINT "fgis_grain_tenant_read_auth_version_ck"
    CHECK ("version" >= 0 AND "configurationVersion" >= 0),
  CONSTRAINT "fgis_grain_tenant_read_auth_operations_ck"
    CHECK (cardinality("allowedOperations") > 0),
  CONSTRAINT "fgis_grain_tenant_read_auth_ttl_ck"
    CHECK ("validUntil" > "createdAt"),
  CONSTRAINT "fgis_grain_tenant_read_attestation_pair_ck"
    CHECK (
      ("attestationEvidenceReference" IS NULL
        AND "attestationValidUntil" IS NULL
        AND "attestationJustification" IS NULL
        AND "attestedByUserId" IS NULL)
      OR
      ("attestationEvidenceReference" IS NOT NULL
        AND "attestationValidUntil" IS NOT NULL
        AND "attestationJustification" IS NOT NULL
        AND "attestedByUserId" IS NOT NULL)
    ),
  CONSTRAINT "fgis_grain_tenant_read_auth_config_key"
    UNIQUE ("tenantId", "organizationId", "configurationId")
);

CREATE INDEX "fgis_grain_tenant_read_auth_status_idx"
  ON public."fgis_grain_tenant_read_authorizations"
  ("tenantId", "organizationId", "status", "validUntil");
CREATE INDEX "fgis_grain_tenant_read_auth_updated_idx"
  ON public."fgis_grain_tenant_read_authorizations"
  ("updatedAt" DESC, "id");

CREATE TABLE public."fgis_grain_tenant_read_audits" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "authorizationId" text NOT NULL,
  "configurationId" text NOT NULL,
  "actorUserId" text NOT NULL,
  "actorRole" text NOT NULL,
  "operationCode" text NOT NULL,
  "correlationId" text NOT NULL,
  "idempotencyKey" text NOT NULL,
  "requestReference" text NOT NULL,
  "requestSha256" char(64) NOT NULL,
  "decision" text NOT NULL,
  "reasonCode" text NOT NULL,
  "providerRequestId" text,
  "responseReference" text,
  "responseSha256" char(64),
  "receivedAt" timestamptz,
  "hash" char(64) NOT NULL,
  "prevHash" char(64),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "fgis_grain_tenant_read_audit_auth_fk"
    FOREIGN KEY ("authorizationId")
    REFERENCES public."fgis_grain_tenant_read_authorizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_audit_config_fk"
    FOREIGN KEY ("configurationId")
    REFERENCES public."fgis_grain_provider_configurations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_audit_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_audit_user_fk"
    FOREIGN KEY ("actorUserId") REFERENCES public."users"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_tenant_read_audit_decision_ck"
    CHECK ("decision" IN ('AUTHORIZED', 'ATTESTED', 'DENIED', 'SUCCEEDED', 'FAILED')),
  CONSTRAINT "fgis_grain_tenant_read_audit_request_hash_ck"
    CHECK ("requestSha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_tenant_read_audit_response_hash_ck"
    CHECK ("responseSha256" IS NULL OR "responseSha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_tenant_read_audit_hash_ck"
    CHECK ("hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_tenant_read_audit_prev_hash_ck"
    CHECK ("prevHash" IS NULL OR "prevHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_tenant_read_audit_provider_pair_ck"
    CHECK (
      ("providerRequestId" IS NULL
        AND "responseReference" IS NULL
        AND "responseSha256" IS NULL
        AND "receivedAt" IS NULL)
      OR
      ("providerRequestId" IS NOT NULL
        AND "responseReference" IS NOT NULL
        AND "responseSha256" IS NOT NULL
        AND "receivedAt" IS NOT NULL)
    ),
  CONSTRAINT "fgis_grain_tenant_read_audit_idempotency_key"
    UNIQUE ("tenantId", "organizationId", "idempotencyKey")
);

CREATE INDEX "fgis_grain_tenant_read_audit_auth_idx"
  ON public."fgis_grain_tenant_read_audits"
  ("authorizationId", "createdAt" DESC, "id" DESC);
CREATE INDEX "fgis_grain_tenant_read_audit_correlation_idx"
  ON public."fgis_grain_tenant_read_audits" ("correlationId");
CREATE INDEX "fgis_grain_tenant_read_audit_decision_idx"
  ON public."fgis_grain_tenant_read_audits"
  ("tenantId", "organizationId", "decision", "createdAt" DESC);

CREATE OR REPLACE FUNCTION public.reject_fgis_grain_tenant_read_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'FGIS Grain tenant-read audits are immutable'
    USING ERRCODE = '55000';
END;
$function$;

CREATE TRIGGER "fgis_grain_tenant_read_audits_no_update"
BEFORE UPDATE ON public."fgis_grain_tenant_read_audits"
FOR EACH ROW EXECUTE FUNCTION public.reject_fgis_grain_tenant_read_audit_mutation();

CREATE TRIGGER "fgis_grain_tenant_read_audits_no_delete"
BEFORE DELETE ON public."fgis_grain_tenant_read_audits"
FOR EACH ROW EXECUTE FUNCTION public.reject_fgis_grain_tenant_read_audit_mutation();

ALTER TABLE public."fgis_grain_tenant_read_authorizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_tenant_read_authorizations" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_tenant_read_audits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fgis_grain_tenant_read_audits" FORCE ROW LEVEL SECURITY;

CREATE POLICY "fgis_grain_tenant_read_auth_tenant_org_policy"
ON public."fgis_grain_tenant_read_authorizations"
FOR ALL
USING (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
)
WITH CHECK (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
);

CREATE POLICY "fgis_grain_tenant_read_audit_tenant_org_policy"
ON public."fgis_grain_tenant_read_audits"
FOR ALL
USING (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
)
WITH CHECK (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND "organizationId" = current_setting('app.current_org_id', true)
);

GRANT SELECT, INSERT, UPDATE ON public."fgis_grain_tenant_read_authorizations"
  TO grainflow_runtime;
GRANT SELECT, INSERT ON public."fgis_grain_tenant_read_audits"
  TO grainflow_runtime;
