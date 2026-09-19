-- PC-CROP-07A durable regulatory integration inbox authority.
-- Forward-only PostgreSQL 16 migration. No vendor-specific mapping or live credentials.

CREATE TABLE public."regulatory_integration_inbox_entries" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT current_setting('app.current_tenant_id'::text, true),
  "organizationId" TEXT NOT NULL DEFAULT current_setting('app.current_org_id'::text, true),
  "adapterCode" VARCHAR(64) NOT NULL,
  "adapterVersion" VARCHAR(32) NOT NULL,
  "provider" VARCHAR(64) NOT NULL,
  "externalEventId" VARCHAR(255) NOT NULL,
  "schemaVersion" VARCHAR(64) NOT NULL,
  "mappingVersion" VARCHAR(64) NOT NULL,
  "environment" VARCHAR(24) NOT NULL,
  "capabilities" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL,
  "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),
  "rawBodySha256" CHAR(64) NOT NULL,
  "evidenceReference" TEXT NOT NULL,
  "signatureStatus" VARCHAR(24) NOT NULL,
  "signatureAlgorithm" VARCHAR(64),
  "signatureKeyReference" TEXT,
  "signatureKeyVersion" VARCHAR(64),
  "verificationResult" JSONB,
  "state" VARCHAR(24) NOT NULL DEFAULT 'RECEIVED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(3),
  "leaseOwner" TEXT,
  "leaseExpiresAt" TIMESTAMPTZ(3),
  "lastErrorCode" VARCHAR(64),
  "lastErrorCategory" VARCHAR(32),
  "lastErrorDetailReference" TEXT,
  "correlationId" TEXT NOT NULL,
  "causationId" TEXT,
  "linkedDomainOperationType" VARCHAR(64),
  "linkedDomainOperationId" TEXT,
  "outboxEntryId" TEXT,
  "providerAcknowledgedAt" TIMESTAMPTZ(3),
  "businessAcceptedAt" TIMESTAMPTZ(3),
  "version" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT "regulatory_integration_inbox_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "regulatory_integration_inbox_entries_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "regulatory_integration_inbox_entries_outboxEntryId_fkey"
    FOREIGN KEY ("outboxEntryId") REFERENCES public."outbox_entries"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "regulatory_integration_inbox_state_check"
    CHECK ("state" IN ('RECEIVED','VERIFIED','PROCESSING','PROCESSED','RETRY','QUARANTINED','DEAD')),
  CONSTRAINT "regulatory_integration_inbox_environment_check"
    CHECK ("environment" IN ('SANDBOX','TEST','PREPROD','PRODUCTION')),
  CONSTRAINT "regulatory_integration_inbox_signature_status_check"
    CHECK ("signatureStatus" IN ('NOT_REQUIRED','PENDING','VERIFIED','INVALID','UNKNOWN_KEY')),
  CONSTRAINT "regulatory_integration_inbox_hash_check"
    CHECK ("rawBodySha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "regulatory_integration_inbox_attempts_check"
    CHECK ("attempts" >= 0),
  CONSTRAINT "regulatory_integration_inbox_lease_pair_check"
    CHECK (("leaseOwner" IS NULL) = ("leaseExpiresAt" IS NULL)),
  CONSTRAINT "regulatory_integration_inbox_retry_schedule_check"
    CHECK (("state" = 'RETRY' AND "nextAttemptAt" IS NOT NULL) OR ("state" <> 'RETRY' AND "nextAttemptAt" IS NULL)),
  CONSTRAINT "regulatory_integration_inbox_processing_lease_check"
    CHECK (("state" = 'PROCESSING' AND "leaseOwner" IS NOT NULL) OR ("state" <> 'PROCESSING' AND "leaseOwner" IS NULL)),
  CONSTRAINT "regulatory_integration_inbox_ack_order_check"
    CHECK ("businessAcceptedAt" IS NULL OR "providerAcknowledgedAt" IS NOT NULL)
);

CREATE UNIQUE INDEX "regulatory_integration_inbox_identity_key"
  ON public."regulatory_integration_inbox_entries"
  ("tenantId", "organizationId", "provider", "externalEventId");
CREATE INDEX "regulatory_integration_inbox_claim_idx"
  ON public."regulatory_integration_inbox_entries"
  ("state", "nextAttemptAt", "leaseExpiresAt", "receivedAt", "id");
CREATE INDEX "regulatory_integration_inbox_tenant_org_state_idx"
  ON public."regulatory_integration_inbox_entries"
  ("tenantId", "organizationId", "state", "receivedAt" DESC);
CREATE INDEX "regulatory_integration_inbox_correlation_idx"
  ON public."regulatory_integration_inbox_entries" ("correlationId");
CREATE INDEX "regulatory_integration_inbox_outbox_idx"
  ON public."regulatory_integration_inbox_entries" ("outboxEntryId")
  WHERE "outboxEntryId" IS NOT NULL;

CREATE TABLE public."regulatory_integration_inbox_conflicts" (
  "id" TEXT NOT NULL,
  "inboxEntryId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "provider" VARCHAR(64) NOT NULL,
  "externalEventId" VARCHAR(255) NOT NULL,
  "existingRawBodySha256" CHAR(64) NOT NULL,
  "incomingRawBodySha256" CHAR(64) NOT NULL,
  "incomingEvidenceReference" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "detectedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT "regulatory_integration_inbox_conflicts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "regulatory_integration_inbox_conflicts_inboxEntryId_fkey"
    FOREIGN KEY ("inboxEntryId") REFERENCES public."regulatory_integration_inbox_entries"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "regulatory_integration_inbox_conflict_hashes_check"
    CHECK (
      "existingRawBodySha256" ~ '^[0-9a-f]{64}$'
      AND "incomingRawBodySha256" ~ '^[0-9a-f]{64}$'
      AND "existingRawBodySha256" <> "incomingRawBodySha256"
    )
);

CREATE UNIQUE INDEX "regulatory_integration_inbox_conflict_identity_key"
  ON public."regulatory_integration_inbox_conflicts"
  ("tenantId", "organizationId", "provider", "externalEventId", "incomingRawBodySha256");
CREATE INDEX "regulatory_integration_inbox_conflict_entry_idx"
  ON public."regulatory_integration_inbox_conflicts" ("inboxEntryId", "detectedAt" DESC);
CREATE INDEX "regulatory_integration_inbox_conflict_correlation_idx"
  ON public."regulatory_integration_inbox_conflicts" ("correlationId");

CREATE OR REPLACE FUNCTION public.app_regulatory_inbox_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  NEW."updatedAt" := clock_timestamp();
  RETURN NEW;
END
$function$;

CREATE TRIGGER regulatory_integration_inbox_touch_updated_at
BEFORE UPDATE ON public."regulatory_integration_inbox_entries"
FOR EACH ROW EXECUTE FUNCTION public.app_regulatory_inbox_touch_updated_at();

CREATE OR REPLACE FUNCTION public.app_regulatory_inbox_identity_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW."tenantId" <> OLD."tenantId"
     OR NEW."organizationId" <> OLD."organizationId"
     OR NEW."provider" <> OLD."provider"
     OR NEW."externalEventId" <> OLD."externalEventId"
     OR NEW."rawBodySha256" <> OLD."rawBodySha256"
     OR NEW."evidenceReference" <> OLD."evidenceReference"
     OR NEW."receivedAt" <> OLD."receivedAt"
  THEN
    RAISE EXCEPTION 'regulatory integration inbox durable identity is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER regulatory_integration_inbox_identity_immutable
BEFORE UPDATE ON public."regulatory_integration_inbox_entries"
FOR EACH ROW EXECUTE FUNCTION public.app_regulatory_inbox_identity_immutable();

CREATE OR REPLACE FUNCTION public.app_regulatory_inbox_conflict_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  RAISE EXCEPTION 'regulatory integration inbox conflict evidence is immutable'
    USING ERRCODE = '42501';
END
$function$;

CREATE TRIGGER regulatory_integration_inbox_conflict_no_update
BEFORE UPDATE ON public."regulatory_integration_inbox_conflicts"
FOR EACH ROW EXECUTE FUNCTION public.app_regulatory_inbox_conflict_immutable();
CREATE TRIGGER regulatory_integration_inbox_conflict_no_delete
BEFORE DELETE ON public."regulatory_integration_inbox_conflicts"
FOR EACH ROW EXECUTE FUNCTION public.app_regulatory_inbox_conflict_immutable();
