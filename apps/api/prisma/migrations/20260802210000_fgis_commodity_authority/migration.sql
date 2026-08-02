-- P0.2-2A — canonical PostgreSQL commodity authority for FGIS-confirmed grain.
--
-- This slice creates only the durable domain boundary. It performs no provider
-- network call, stores no credential/certificate/token/private key/raw XML,
-- creates no second inbox/outbox/worker/adapter, publishes no commercial lot,
-- and does not remove the P0.2-1A FGIS publication quarantine.

CREATE SCHEMA IF NOT EXISTS fgis_commodity;
REVOKE ALL ON SCHEMA fgis_commodity FROM PUBLIC;

-- ── Durable tables ────────────────────────────────────────────────────────────

CREATE TABLE public."fgis_grain_organization_connections" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "providerConfigurationId" text NOT NULL UNIQUE,
  "providerConfigurationVersion" bigint NOT NULL,
  "providerAttestationFingerprint" char(64) NOT NULL,
  "status" text NOT NULL DEFAULT 'BOUND',
  "authMode" text NOT NULL DEFAULT 'REFERENCE_ONLY',
  "externalOrganizationId" text,
  "externalOrganizationReference" text,
  "apiVersion" text NOT NULL,
  "adapterVersion" text NOT NULL,
  "version" bigint NOT NULL DEFAULT 1,
  "lastAttemptAt" timestamptz,
  "lastSuccessfulSyncAt" timestamptz,
  "lastErrorCode" text,
  "lastErrorCorrelationId" text,
  "createdByUserId" text NOT NULL,
  "updatedByUserId" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "disabledAt" timestamptz,
  "revokedAt" timestamptz,
  CONSTRAINT "fgis_grain_org_connection_org_fk"
    FOREIGN KEY ("organizationId") REFERENCES public."organizations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_org_connection_config_fk"
    FOREIGN KEY ("providerConfigurationId")
    REFERENCES public."fgis_grain_provider_configurations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_org_connection_attestation_hash_ck"
    CHECK ("providerAttestationFingerprint" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_org_connection_status_ck"
    CHECK ("status" IN ('BOUND', 'SUSPENDED', 'REVOKED')),
  CONSTRAINT "fgis_grain_org_connection_auth_mode_ck"
    CHECK ("authMode" = 'REFERENCE_ONLY'),
  CONSTRAINT "fgis_grain_org_connection_version_ck"
    CHECK ("version" > 0),
  CONSTRAINT "fgis_grain_org_connection_reference_bounds_ck"
    CHECK (
      length("apiVersion") BETWEEN 1 AND 64
      AND length("adapterVersion") BETWEEN 1 AND 128
      AND length(COALESCE("externalOrganizationId", '')) <= 256
      AND length(COALESCE("externalOrganizationReference", '')) <= 512
      AND length(COALESCE("lastErrorCode", '')) <= 128
      AND length(COALESCE("lastErrorCorrelationId", '')) <= 128
    ),
  CONSTRAINT "fgis_grain_org_connection_tenant_org_key"
    UNIQUE ("tenantId", "organizationId", "id")
);

CREATE INDEX "fgis_grain_org_connection_status_idx"
  ON public."fgis_grain_organization_connections"
  ("tenantId", "organizationId", "status", "updatedAt" DESC, "id");

CREATE TABLE public."fgis_grain_sync_runs" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "connectionId" text NOT NULL,
  "operationCode" text NOT NULL DEFAULT 'GET_LIST_LOT',
  "status" text NOT NULL DEFAULT 'REQUESTED',
  "startedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "completedAt" timestamptz,
  "recordsReceived" integer NOT NULL DEFAULT 0,
  "recordsCreated" integer NOT NULL DEFAULT 0,
  "recordsUpdated" integer NOT NULL DEFAULT 0,
  "recordsUnchanged" integer NOT NULL DEFAULT 0,
  "recordsFailed" integer NOT NULL DEFAULT 0,
  "pageCursor" text,
  "recordsModifiedFrom" timestamptz,
  "correlationId" text NOT NULL,
  "providerRequestId" text,
  "errorCode" text,
  "errorDetailReference" text,
  "initiatedByUserId" text NOT NULL,
  "idempotencyKey" text NOT NULL,
  "requestFingerprint" char(64) NOT NULL,
  "version" bigint NOT NULL DEFAULT 1,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "fgis_grain_sync_run_connection_fk"
    FOREIGN KEY ("connectionId")
    REFERENCES public."fgis_grain_organization_connections"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_sync_run_operation_ck"
    CHECK ("operationCode" IN ('GET_LIST_LOT', 'GET_LIST_SDIZ')),
  CONSTRAINT "fgis_grain_sync_run_status_ck"
    CHECK ("status" IN (
      'REQUESTED', 'DISPATCHED', 'WAITING_RESPONSE', 'PROCESSING',
      'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED'
    )),
  CONSTRAINT "fgis_grain_sync_run_counts_ck"
    CHECK (
      "recordsReceived" >= 0 AND "recordsCreated" >= 0
      AND "recordsUpdated" >= 0 AND "recordsUnchanged" >= 0
      AND "recordsFailed" >= 0
    ),
  CONSTRAINT "fgis_grain_sync_run_hash_ck"
    CHECK ("requestFingerprint" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_sync_run_version_ck"
    CHECK ("version" > 0),
  CONSTRAINT "fgis_grain_sync_run_bounds_ck"
    CHECK (
      length("correlationId") BETWEEN 1 AND 128
      AND length(COALESCE("providerRequestId", '')) <= 256
      AND length(COALESCE("pageCursor", '')) <= 2048
      AND length(COALESCE("errorCode", '')) <= 128
      AND length(COALESCE("errorDetailReference", '')) <= 512
      AND length("idempotencyKey") BETWEEN 1 AND 256
    ),
  CONSTRAINT "fgis_grain_sync_run_idempotency_key"
    UNIQUE ("tenantId", "organizationId", "idempotencyKey"),
  CONSTRAINT "fgis_grain_sync_run_scope_key"
    UNIQUE ("tenantId", "organizationId", "connectionId", "id")
);

CREATE INDEX "fgis_grain_sync_run_status_idx"
  ON public."fgis_grain_sync_runs"
  ("tenantId", "organizationId", "connectionId", "status", "startedAt" DESC, "id");
CREATE UNIQUE INDEX "fgis_grain_sync_run_one_active_idx"
  ON public."fgis_grain_sync_runs" ("tenantId", "organizationId", "connectionId")
  WHERE "status" IN ('REQUESTED', 'DISPATCHED', 'WAITING_RESPONSE', 'PROCESSING');

CREATE TABLE public."fgis_grain_party_snapshots" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "connectionId" text NOT NULL,
  "syncRunId" text NOT NULL,
  "externalPartyId" text NOT NULL,
  "externalPartyNumber" text,
  "externalRecordId" text,
  "adapterVersion" text NOT NULL,
  "contractVersion" text NOT NULL,
  "ownerReference" text,
  "agentReference" text,
  "repositoryReference" text,
  "productCode" text,
  "productName" text,
  "okpd2Code" text,
  "tnvedCode" text,
  "targetCode" text,
  "purposeCode" text,
  "harvestYear" integer,
  "storagePlace" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "amountOriginal" numeric(20,6),
  "amountAvailable" numeric(20,6) NOT NULL,
  "sourceUnitCode" text,
  "normalizedUnitCode" text,
  "unitAuthority" text NOT NULL DEFAULT 'UNCONFIRMED',
  "qualityValues" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "externalStatus" text NOT NULL,
  "sourceRegisteredAt" timestamptz,
  "sourceUpdatedAt" timestamptz NOT NULL,
  "fetchedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "organicFlag" boolean,
  "quarantineZoneFlag" boolean,
  "payloadHash" char(64) NOT NULL,
  "criticalHash" char(64) NOT NULL,
  "protectedRawReference" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "fgis_grain_party_snapshot_connection_fk"
    FOREIGN KEY ("connectionId")
    REFERENCES public."fgis_grain_organization_connections"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_party_snapshot_sync_run_fk"
    FOREIGN KEY ("syncRunId") REFERENCES public."fgis_grain_sync_runs"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_party_snapshot_amount_ck"
    CHECK (
      "amountAvailable" >= 0
      AND ("amountOriginal" IS NULL OR "amountOriginal" >= 0)
    ),
  CONSTRAINT "fgis_grain_party_snapshot_unit_authority_ck"
    CHECK ("unitAuthority" IN ('UNCONFIRMED', 'CONTRACT', 'PROVIDER')),
  CONSTRAINT "fgis_grain_party_snapshot_unit_consistency_ck"
    CHECK (
      ("unitAuthority" = 'UNCONFIRMED' AND "normalizedUnitCode" IS NULL)
      OR ("unitAuthority" IN ('CONTRACT', 'PROVIDER') AND "normalizedUnitCode" IS NOT NULL)
    ),
  CONSTRAINT "fgis_grain_party_snapshot_hash_ck"
    CHECK (
      "payloadHash" ~ '^[a-f0-9]{64}$'
      AND "criticalHash" ~ '^[a-f0-9]{64}$'
    ),
  CONSTRAINT "fgis_grain_party_snapshot_json_bounds_ck"
    CHECK (
      jsonb_typeof("storagePlace") = 'object'
      AND jsonb_typeof("qualityValues") = 'object'
      AND octet_length("storagePlace"::text) <= 16384
      AND octet_length("qualityValues"::text) <= 65536
    ),
  CONSTRAINT "fgis_grain_party_snapshot_bounds_ck"
    CHECK (
      length("externalPartyId") BETWEEN 1 AND 256
      AND length(COALESCE("externalPartyNumber", '')) <= 256
      AND length(COALESCE("externalRecordId", '')) <= 256
      AND length("adapterVersion") BETWEEN 1 AND 128
      AND length("contractVersion") BETWEEN 1 AND 64
      AND length(COALESCE("ownerReference", '')) <= 512
      AND length(COALESCE("agentReference", '')) <= 512
      AND length(COALESCE("repositoryReference", '')) <= 512
      AND length(COALESCE("productCode", '')) <= 128
      AND length(COALESCE("productName", '')) <= 512
      AND length(COALESCE("sourceUnitCode", '')) <= 64
      AND length(COALESCE("normalizedUnitCode", '')) <= 64
      AND length("externalStatus") BETWEEN 1 AND 64
      AND length("protectedRawReference") BETWEEN 1 AND 512
    ),
  CONSTRAINT "fgis_grain_party_snapshot_replay_key"
    UNIQUE ("tenantId", "organizationId", "externalPartyId", "payloadHash")
);

CREATE INDEX "fgis_grain_party_snapshot_party_idx"
  ON public."fgis_grain_party_snapshots"
  ("tenantId", "organizationId", "externalPartyId", "sourceUpdatedAt" DESC, "id" DESC);
CREATE INDEX "fgis_grain_party_snapshot_sync_idx"
  ON public."fgis_grain_party_snapshots" ("syncRunId", "createdAt", "id");
CREATE INDEX "fgis_grain_party_snapshot_critical_idx"
  ON public."fgis_grain_party_snapshots"
  ("tenantId", "organizationId", "criticalHash", "createdAt" DESC);

CREATE TABLE public."fgis_grain_party_current" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "connectionId" text NOT NULL,
  "externalPartyId" text NOT NULL,
  "currentSnapshotId" text NOT NULL,
  "normalizedStatus" text NOT NULL,
  "freshnessStatus" text NOT NULL DEFAULT 'FRESH',
  "sourceUpdatedAt" timestamptz NOT NULL,
  "fetchedAt" timestamptz NOT NULL,
  "availableSourceAmount" numeric(20,6) NOT NULL,
  "normalizedUnitCode" text,
  "criticalHash" char(64) NOT NULL,
  "version" bigint NOT NULL DEFAULT 1,
  "lastReconciledAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "fgis_grain_party_current_connection_fk"
    FOREIGN KEY ("connectionId")
    REFERENCES public."fgis_grain_organization_connections"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_party_current_snapshot_fk"
    FOREIGN KEY ("currentSnapshotId")
    REFERENCES public."fgis_grain_party_snapshots"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_party_current_status_ck"
    CHECK ("normalizedStatus" IN (
      'AVAILABLE', 'PARTIALLY_RESERVED', 'FULLY_RESERVED',
      'REFRESH_REQUIRED', 'RECONCILIATION_REQUIRED',
      'RESTRICTED', 'UNAVAILABLE', 'SYNC_ERROR'
    )),
  CONSTRAINT "fgis_grain_party_current_freshness_ck"
    CHECK ("freshnessStatus" IN ('FRESH', 'ACCEPTABLE', 'STALE', 'UNKNOWN', 'SYNC_FAILED')),
  CONSTRAINT "fgis_grain_party_current_amount_ck"
    CHECK ("availableSourceAmount" >= 0),
  CONSTRAINT "fgis_grain_party_current_hash_ck"
    CHECK ("criticalHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_party_current_version_ck"
    CHECK ("version" > 0),
  CONSTRAINT "fgis_grain_party_current_identity_key"
    UNIQUE ("tenantId", "organizationId", "externalPartyId")
);

CREATE INDEX "fgis_grain_party_current_status_idx"
  ON public."fgis_grain_party_current"
  ("tenantId", "organizationId", "normalizedStatus", "freshnessStatus", "updatedAt" DESC, "id");
CREATE INDEX "fgis_grain_party_current_connection_idx"
  ON public."fgis_grain_party_current" ("connectionId", "externalPartyId");

CREATE TABLE public."commodity_reservations" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "partyCurrentId" text NOT NULL,
  "sourceSnapshotId" text NOT NULL,
  "lotId" text,
  "dealId" text,
  "volume" numeric(20,6) NOT NULL,
  "unit" text NOT NULL,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "reason" text NOT NULL,
  "idempotencyKey" text NOT NULL,
  "requestFingerprint" char(64) NOT NULL,
  "version" bigint NOT NULL DEFAULT 1,
  "createdByUserId" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "expiresAt" timestamptz NOT NULL,
  "activatedAt" timestamptz,
  "releasedAt" timestamptz,
  "releaseReason" text,
  "auditReference" text,
  CONSTRAINT "commodity_reservation_party_fk"
    FOREIGN KEY ("partyCurrentId") REFERENCES public."fgis_grain_party_current"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "commodity_reservation_snapshot_fk"
    FOREIGN KEY ("sourceSnapshotId") REFERENCES public."fgis_grain_party_snapshots"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "commodity_reservation_volume_ck" CHECK ("volume" > 0),
  CONSTRAINT "commodity_reservation_status_ck"
    CHECK ("status" IN (
      'PENDING', 'ACTIVE', 'CONVERTED_TO_DEAL', 'RELEASED',
      'EXPIRED', 'FROZEN', 'CANCELLED'
    )),
  CONSTRAINT "commodity_reservation_hash_ck"
    CHECK ("requestFingerprint" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "commodity_reservation_version_ck" CHECK ("version" > 0),
  CONSTRAINT "commodity_reservation_bounds_ck"
    CHECK (
      length("unit") BETWEEN 1 AND 64
      AND length("reason") BETWEEN 1 AND 1000
      AND length("idempotencyKey") BETWEEN 1 AND 256
      AND length(COALESCE("lotId", '')) <= 256
      AND length(COALESCE("dealId", '')) <= 256
      AND length(COALESCE("releaseReason", '')) <= 1000
      AND length(COALESCE("auditReference", '')) <= 256
    ),
  CONSTRAINT "commodity_reservation_idempotency_key"
    UNIQUE ("tenantId", "organizationId", "idempotencyKey")
);

CREATE INDEX "commodity_reservation_party_status_idx"
  ON public."commodity_reservations"
  ("tenantId", "organizationId", "partyCurrentId", "status", "createdAt", "id");
CREATE INDEX "commodity_reservation_expiry_idx"
  ON public."commodity_reservations" ("status", "expiresAt", "id");
CREATE INDEX "commodity_reservation_lot_idx"
  ON public."commodity_reservations" ("lotId") WHERE "lotId" IS NOT NULL;
CREATE INDEX "commodity_reservation_deal_idx"
  ON public."commodity_reservations" ("dealId") WHERE "dealId" IS NOT NULL;

CREATE TABLE public."fgis_grain_lot_passports" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "sourceType" text NOT NULL DEFAULT 'FGIS_GRAIN',
  "partyCurrentId" text NOT NULL,
  "sourceSnapshotId" text NOT NULL,
  "reservationId" text NOT NULL UNIQUE,
  "product" jsonb NOT NULL,
  "harvestYear" integer,
  "storagePlace" jsonb NOT NULL,
  "quality" jsonb NOT NULL,
  "volume" numeric(20,6) NOT NULL,
  "unit" text NOT NULL,
  "sourceHash" char(64) NOT NULL,
  "criticalHash" char(64) NOT NULL,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "version" bigint NOT NULL DEFAULT 1,
  "createdByUserId" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "sealedAt" timestamptz,
  "publishedAt" timestamptz,
  "frozenAt" timestamptz,
  "cancelledAt" timestamptz,
  CONSTRAINT "fgis_grain_lot_passport_party_fk"
    FOREIGN KEY ("partyCurrentId") REFERENCES public."fgis_grain_party_current"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_lot_passport_snapshot_fk"
    FOREIGN KEY ("sourceSnapshotId") REFERENCES public."fgis_grain_party_snapshots"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_lot_passport_reservation_fk"
    FOREIGN KEY ("reservationId") REFERENCES public."commodity_reservations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_lot_passport_source_ck" CHECK ("sourceType" = 'FGIS_GRAIN'),
  CONSTRAINT "fgis_grain_lot_passport_status_ck"
    CHECK ("status" IN ('DRAFT', 'SEALED', 'PUBLISHED', 'FROZEN', 'CANCELLED')),
  CONSTRAINT "fgis_grain_lot_passport_volume_ck" CHECK ("volume" > 0),
  CONSTRAINT "fgis_grain_lot_passport_hash_ck"
    CHECK ("sourceHash" ~ '^[a-f0-9]{64}$' AND "criticalHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_lot_passport_json_bounds_ck"
    CHECK (
      jsonb_typeof("product") = 'object'
      AND jsonb_typeof("storagePlace") = 'object'
      AND jsonb_typeof("quality") = 'object'
      AND octet_length("product"::text) <= 16384
      AND octet_length("storagePlace"::text) <= 16384
      AND octet_length("quality"::text) <= 131072
    ),
  CONSTRAINT "fgis_grain_lot_passport_version_ck" CHECK ("version" > 0)
);

CREATE INDEX "fgis_grain_lot_passport_status_idx"
  ON public."fgis_grain_lot_passports"
  ("tenantId", "organizationId", "status", "createdAt" DESC, "id");
CREATE INDEX "fgis_grain_lot_passport_party_idx"
  ON public."fgis_grain_lot_passports" ("partyCurrentId", "createdAt" DESC, "id");

CREATE TABLE public."fgis_grain_reconciliation_cases" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "partyCurrentId" text NOT NULL,
  "previousSnapshotId" text,
  "actualSnapshotId" text NOT NULL,
  "lotId" text,
  "reservationId" text,
  "severity" text NOT NULL,
  "status" text NOT NULL DEFAULT 'OPEN',
  "reasonCode" text NOT NULL,
  "expectedState" jsonb NOT NULL,
  "actualState" jsonb NOT NULL,
  "differenceHash" char(64) NOT NULL,
  "ownerUserId" text,
  "version" bigint NOT NULL DEFAULT 1,
  "idempotencyKey" text NOT NULL,
  "requestFingerprint" char(64) NOT NULL,
  "openedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "acknowledgedAt" timestamptz,
  "resolvedAt" timestamptz,
  "resolutionCode" text,
  "resolutionNote" text,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "fgis_grain_reconciliation_party_fk"
    FOREIGN KEY ("partyCurrentId") REFERENCES public."fgis_grain_party_current"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_reconciliation_previous_snapshot_fk"
    FOREIGN KEY ("previousSnapshotId") REFERENCES public."fgis_grain_party_snapshots"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_reconciliation_actual_snapshot_fk"
    FOREIGN KEY ("actualSnapshotId") REFERENCES public."fgis_grain_party_snapshots"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_reconciliation_reservation_fk"
    FOREIGN KEY ("reservationId") REFERENCES public."commodity_reservations"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_reconciliation_severity_ck"
    CHECK ("severity" IN ('INFO', 'WARNING', 'HIGH', 'CRITICAL')),
  CONSTRAINT "fgis_grain_reconciliation_status_ck"
    CHECK ("status" IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'DISMISSED')),
  CONSTRAINT "fgis_grain_reconciliation_hash_ck"
    CHECK (
      "differenceHash" ~ '^[a-f0-9]{64}$'
      AND "requestFingerprint" ~ '^[a-f0-9]{64}$'
    ),
  CONSTRAINT "fgis_grain_reconciliation_json_bounds_ck"
    CHECK (
      jsonb_typeof("expectedState") = 'object'
      AND jsonb_typeof("actualState") = 'object'
      AND octet_length("expectedState"::text) <= 131072
      AND octet_length("actualState"::text) <= 131072
    ),
  CONSTRAINT "fgis_grain_reconciliation_version_ck" CHECK ("version" > 0),
  CONSTRAINT "fgis_grain_reconciliation_idempotency_key"
    UNIQUE ("tenantId", "organizationId", "idempotencyKey")
);

CREATE UNIQUE INDEX "fgis_grain_reconciliation_open_case_idx"
  ON public."fgis_grain_reconciliation_cases"
  ("tenantId", "organizationId", "partyCurrentId", "reasonCode", "differenceHash")
  WHERE "status" IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING');
CREATE INDEX "fgis_grain_reconciliation_status_idx"
  ON public."fgis_grain_reconciliation_cases"
  ("tenantId", "organizationId", "status", "severity", "openedAt" DESC, "id");

CREATE TABLE public."fgis_grain_commodity_commands" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "organizationId" text NOT NULL,
  "actorUserId" text NOT NULL,
  "actorRole" text NOT NULL,
  "commandType" text NOT NULL,
  "commandId" text NOT NULL UNIQUE,
  "idempotencyKey" text NOT NULL,
  "requestHash" char(64) NOT NULL,
  "outcome" text NOT NULL,
  "objectType" text,
  "objectId" text,
  "result" jsonb NOT NULL,
  "auditEventId" text NOT NULL UNIQUE,
  "outboxEntryId" text UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "fgis_grain_commodity_command_audit_fk"
    FOREIGN KEY ("auditEventId") REFERENCES public."audit_events"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_commodity_command_outbox_fk"
    FOREIGN KEY ("outboxEntryId") REFERENCES public."outbox_entries"("id")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT "fgis_grain_commodity_command_hash_ck"
    CHECK ("requestHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "fgis_grain_commodity_command_outcome_ck"
    CHECK ("outcome" IN ('ACCEPTED', 'DENIED')),
  CONSTRAINT "fgis_grain_commodity_command_result_ck"
    CHECK (jsonb_typeof("result") = 'object' AND octet_length("result"::text) <= 262144),
  CONSTRAINT "fgis_grain_commodity_command_bounds_ck"
    CHECK (
      length("actorUserId") BETWEEN 1 AND 256
      AND length("actorRole") BETWEEN 1 AND 128
      AND length("commandType") BETWEEN 1 AND 128
      AND length("commandId") BETWEEN 1 AND 256
      AND length("idempotencyKey") BETWEEN 1 AND 256
      AND length(COALESCE("objectType", '')) <= 128
      AND length(COALESCE("objectId", '')) <= 256
    ),
  CONSTRAINT "fgis_grain_commodity_command_idempotency_key"
    UNIQUE ("tenantId", "organizationId", "commandType", "idempotencyKey")
);

CREATE INDEX "fgis_grain_commodity_command_created_idx"
  ON public."fgis_grain_commodity_commands"
  ("tenantId", "organizationId", "createdAt" DESC, "id");
CREATE INDEX "fgis_grain_commodity_command_object_idx"
  ON public."fgis_grain_commodity_commands"
  ("objectType", "objectId", "createdAt" DESC);

-- ── Scope and immutability triggers ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION fgis_commodity.reject_immutable_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'FGIS_COMMODITY_IMMUTABLE_EVIDENCE';
END;
$function$;

CREATE TRIGGER "fgis_grain_party_snapshots_no_update"
BEFORE UPDATE ON public."fgis_grain_party_snapshots"
FOR EACH ROW EXECUTE FUNCTION fgis_commodity.reject_immutable_mutation();
CREATE TRIGGER "fgis_grain_party_snapshots_no_delete"
BEFORE DELETE ON public."fgis_grain_party_snapshots"
FOR EACH ROW EXECUTE FUNCTION fgis_commodity.reject_immutable_mutation();
CREATE TRIGGER "fgis_grain_commodity_commands_no_update"
BEFORE UPDATE ON public."fgis_grain_commodity_commands"
FOR EACH ROW EXECUTE FUNCTION fgis_commodity.reject_immutable_mutation();
CREATE TRIGGER "fgis_grain_commodity_commands_no_delete"
BEFORE DELETE ON public."fgis_grain_commodity_commands"
FOR EACH ROW EXECUTE FUNCTION fgis_commodity.reject_immutable_mutation();

CREATE OR REPLACE FUNCTION fgis_commodity.reject_business_evidence_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'FGIS_COMMODITY_EVIDENCE_DELETE_DENIED';
END;
$function$;

CREATE TRIGGER "fgis_grain_connections_no_delete"
BEFORE DELETE ON public."fgis_grain_organization_connections"
FOR EACH ROW EXECUTE FUNCTION fgis_commodity.reject_business_evidence_delete();
CREATE TRIGGER "fgis_grain_sync_runs_no_delete"
BEFORE DELETE ON public."fgis_grain_sync_runs"
FOR EACH ROW EXECUTE FUNCTION fgis_commodity.reject_business_evidence_delete();
CREATE TRIGGER "fgis_grain_party_current_no_delete"
BEFORE DELETE ON public."fgis_grain_party_current"
FOR EACH ROW EXECUTE FUNCTION fgis_commodity.reject_business_evidence_delete();
CREATE TRIGGER "commodity_reservations_no_delete"
BEFORE DELETE ON public."commodity_reservations"
FOR EACH ROW EXECUTE FUNCTION fgis_commodity.reject_business_evidence_delete();
CREATE TRIGGER "fgis_grain_lot_passports_no_delete"
BEFORE DELETE ON public."fgis_grain_lot_passports"
FOR EACH ROW EXECUTE FUNCTION fgis_commodity.reject_business_evidence_delete();
CREATE TRIGGER "fgis_grain_reconciliation_cases_no_delete"
BEFORE DELETE ON public."fgis_grain_reconciliation_cases"
FOR EACH ROW EXECUTE FUNCTION fgis_commodity.reject_business_evidence_delete();

CREATE OR REPLACE FUNCTION fgis_commodity.guard_passport_source_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
BEGIN
  IF OLD."status" IN ('SEALED', 'PUBLISHED', 'FROZEN', 'CANCELLED')
     AND (
       NEW."tenantId", NEW."organizationId", NEW."sourceType",
       NEW."partyCurrentId", NEW."sourceSnapshotId", NEW."reservationId",
       NEW."product", NEW."harvestYear", NEW."storagePlace", NEW."quality",
       NEW."volume", NEW."unit", NEW."sourceHash", NEW."criticalHash",
       NEW."createdByUserId", NEW."createdAt"
     ) IS DISTINCT FROM (
       OLD."tenantId", OLD."organizationId", OLD."sourceType",
       OLD."partyCurrentId", OLD."sourceSnapshotId", OLD."reservationId",
       OLD."product", OLD."harvestYear", OLD."storagePlace", OLD."quality",
       OLD."volume", OLD."unit", OLD."sourceHash", OLD."criticalHash",
       OLD."createdByUserId", OLD."createdAt"
     )
  THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'FGIS_LOT_PASSPORT_SOURCE_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER "fgis_grain_lot_passports_source_immutable"
BEFORE UPDATE ON public."fgis_grain_lot_passports"
FOR EACH ROW EXECUTE FUNCTION fgis_commodity.guard_passport_source_immutability();

CREATE OR REPLACE FUNCTION fgis_commodity.assert_reference_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
DECLARE
  v_tenant text;
  v_org text;
BEGIN
  v_tenant := NEW."tenantId";
  v_org := NEW."organizationId";

  IF TG_TABLE_NAME = 'fgis_grain_organization_connections' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public."organizations" o
      JOIN public."fgis_grain_provider_configurations" c
        ON c."id" = NEW."providerConfigurationId"
      WHERE o."id" = v_org AND o."tenantId" = v_tenant
        AND c."tenantId" = v_tenant AND c."organizationId" = v_org
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FGIS_CONNECTION_SCOPE_MISMATCH';
    END IF;
  ELSIF TG_TABLE_NAME = 'fgis_grain_sync_runs' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public."fgis_grain_organization_connections" c
      WHERE c."id" = NEW."connectionId"
        AND c."tenantId" = v_tenant AND c."organizationId" = v_org
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FGIS_SYNC_RUN_SCOPE_MISMATCH';
    END IF;
  ELSIF TG_TABLE_NAME = 'fgis_grain_party_snapshots' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public."fgis_grain_organization_connections" c
      JOIN public."fgis_grain_sync_runs" r ON r."id" = NEW."syncRunId"
      WHERE c."id" = NEW."connectionId"
        AND c."tenantId" = v_tenant AND c."organizationId" = v_org
        AND r."connectionId" = c."id"
        AND r."tenantId" = v_tenant AND r."organizationId" = v_org
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FGIS_PARTY_SNAPSHOT_SCOPE_MISMATCH';
    END IF;
  ELSIF TG_TABLE_NAME = 'fgis_grain_party_current' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public."fgis_grain_organization_connections" c
      JOIN public."fgis_grain_party_snapshots" s ON s."id" = NEW."currentSnapshotId"
      WHERE c."id" = NEW."connectionId"
        AND c."tenantId" = v_tenant AND c."organizationId" = v_org
        AND s."connectionId" = c."id"
        AND s."tenantId" = v_tenant AND s."organizationId" = v_org
        AND s."externalPartyId" = NEW."externalPartyId"
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FGIS_PARTY_CURRENT_SCOPE_MISMATCH';
    END IF;
  ELSIF TG_TABLE_NAME = 'commodity_reservations' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public."fgis_grain_party_current" p
      JOIN public."fgis_grain_party_snapshots" s ON s."id" = NEW."sourceSnapshotId"
      WHERE p."id" = NEW."partyCurrentId"
        AND p."tenantId" = v_tenant AND p."organizationId" = v_org
        AND s."tenantId" = v_tenant AND s."organizationId" = v_org
        AND s."externalPartyId" = p."externalPartyId"
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FGIS_RESERVATION_SCOPE_MISMATCH';
    END IF;
  ELSIF TG_TABLE_NAME = 'fgis_grain_lot_passports' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public."fgis_grain_party_current" p
      JOIN public."fgis_grain_party_snapshots" s ON s."id" = NEW."sourceSnapshotId"
      JOIN public."commodity_reservations" r ON r."id" = NEW."reservationId"
      WHERE p."id" = NEW."partyCurrentId"
        AND p."tenantId" = v_tenant AND p."organizationId" = v_org
        AND s."tenantId" = v_tenant AND s."organizationId" = v_org
        AND r."tenantId" = v_tenant AND r."organizationId" = v_org
        AND r."partyCurrentId" = p."id" AND r."sourceSnapshotId" = s."id"
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FGIS_LOT_PASSPORT_SCOPE_MISMATCH';
    END IF;
  ELSIF TG_TABLE_NAME = 'fgis_grain_reconciliation_cases' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public."fgis_grain_party_current" p
      JOIN public."fgis_grain_party_snapshots" a ON a."id" = NEW."actualSnapshotId"
      LEFT JOIN public."fgis_grain_party_snapshots" b ON b."id" = NEW."previousSnapshotId"
      LEFT JOIN public."commodity_reservations" r ON r."id" = NEW."reservationId"
      WHERE p."id" = NEW."partyCurrentId"
        AND p."tenantId" = v_tenant AND p."organizationId" = v_org
        AND a."tenantId" = v_tenant AND a."organizationId" = v_org
        AND a."externalPartyId" = p."externalPartyId"
        AND (b."id" IS NULL OR (
          b."tenantId" = v_tenant AND b."organizationId" = v_org
          AND b."externalPartyId" = p."externalPartyId"
        ))
        AND (r."id" IS NULL OR (
          r."tenantId" = v_tenant AND r."organizationId" = v_org
          AND r."partyCurrentId" = p."id"
        ))
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FGIS_RECONCILIATION_SCOPE_MISMATCH';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER "fgis_grain_connections_scope_guard"
BEFORE INSERT OR UPDATE ON public."fgis_grain_organization_connections"
FOR EACH ROW EXECUTE FUNCTION fgis_commodity.assert_reference_scope();
CREATE TRIGGER "fgis_grain_sync_runs_scope_guard"
BEFORE INSERT OR UPDATE ON public."fgis_grain_sync_runs"
FOR EACH ROW EXECUTE FUNCTION fgis_commodity.assert_reference_scope();
CREATE TRIGGER "fgis_grain_party_snapshots_scope_guard"
BEFORE INSERT OR UPDATE ON public."fgis_grain_party_snapshots"
FOR EACH ROW EXECUTE FUNCTION fgis_commodity.assert_reference_scope();
CREATE TRIGGER "fgis_grain_party_current_scope_guard"
BEFORE INSERT OR UPDATE ON public."fgis_grain_party_current"
FOR EACH ROW EXECUTE FUNCTION fgis_commodity.assert_reference_scope();
CREATE TRIGGER "commodity_reservations_scope_guard"
BEFORE INSERT OR UPDATE ON public."commodity_reservations"
FOR EACH ROW EXECUTE FUNCTION fgis_commodity.assert_reference_scope();
CREATE TRIGGER "fgis_grain_lot_passports_scope_guard"
BEFORE INSERT OR UPDATE ON public."fgis_grain_lot_passports"
FOR EACH ROW EXECUTE FUNCTION fgis_commodity.assert_reference_scope();
CREATE TRIGGER "fgis_grain_reconciliation_cases_scope_guard"
BEFORE INSERT OR UPDATE ON public."fgis_grain_reconciliation_cases"
FOR EACH ROW EXECUTE FUNCTION fgis_commodity.assert_reference_scope();

-- ── Forced RLS ────────────────────────────────────────────────────────────────

DO $do$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'fgis_grain_organization_connections',
    'fgis_grain_sync_runs',
    'fgis_grain_party_snapshots',
    'fgis_grain_party_current',
    'commodity_reservations',
    'fgis_grain_lot_passports',
    'fgis_grain_reconciliation_cases',
    'fgis_grain_commodity_commands'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL '
      || 'USING ("tenantId" = current_setting(''app.current_tenant_id'', true) '
      || 'AND "organizationId" = current_setting(''app.current_org_id'', true)) '
      || 'WITH CHECK ("tenantId" = current_setting(''app.current_tenant_id'', true) '
      || 'AND "organizationId" = current_setting(''app.current_org_id'', true))',
      table_name || '_tenant_org_policy', table_name
    );
  END LOOP;
END
$do$;

-- ── Trusted context, audit, outbox, and idempotency helpers ──────────────────

CREATE OR REPLACE FUNCTION fgis_commodity.assert_actor(p_allowed_roles text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
DECLARE
  v_tenant text := NULLIF(current_setting('app.current_tenant_id', true), '');
  v_org text := NULLIF(current_setting('app.current_org_id', true), '');
  v_user text := NULLIF(current_setting('app.current_user_id', true), '');
  v_role text := NULLIF(current_setting('app.current_role', true), '');
BEGIN
  IF v_tenant IS NULL OR v_org IS NULL OR v_user IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FGIS_COMMODITY_TRUSTED_CONTEXT_REQUIRED';
  END IF;
  IF NOT (v_role = ANY(p_allowed_roles)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FGIS_COMMODITY_ROLE_DENIED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public."organizations" o
    WHERE o."id" = v_org AND o."tenantId" = v_tenant
      AND o."status" IN ('VERIFIED', 'ACTIVE')
      AND o."kycStatus" = 'APPROVED'
      AND o."amlStatus" = 'CLEAR'
      AND o."sanctionHit" = false
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FGIS_COMMODITY_ORGANIZATION_NOT_ADMITTED';
  END IF;
  IF v_role NOT IN ('SYSTEM', 'SERVICE') AND NOT EXISTS (
    SELECT 1
    FROM public."users" u
    JOIN public."user_orgs" m ON m."userId" = u."id"
    WHERE u."id" = v_user
      AND u."status" = 'ACTIVE' AND u."deletedAt" IS NULL
      AND m."organizationId" = v_org AND m."role" = v_role
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FGIS_COMMODITY_MEMBERSHIP_INVALID';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION fgis_commodity.lock_key(p_material text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
BEGIN
  IF NULLIF(btrim(p_material), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FGIS_COMMODITY_LOCK_KEY_REQUIRED';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_material, 3628));
END;
$function$;

CREATE OR REPLACE FUNCTION fgis_commodity.append_audit(
  p_action text,
  p_object_type text,
  p_object_id text,
  p_before jsonb,
  p_after jsonb,
  p_outcome text,
  p_reason text,
  p_metadata jsonb,
  p_correlation_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
DECLARE
  v_id text := 'fgis-commodity-audit-' || gen_random_uuid()::text;
  v_prev_hash text;
  v_hash text;
  v_material jsonb;
  v_created_at timestamptz := clock_timestamp();
BEGIN
  IF NULLIF(btrim(p_action), '') IS NULL
     OR NULLIF(btrim(p_object_type), '') IS NULL
     OR NULLIF(btrim(p_correlation_id), '') IS NULL
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FGIS_COMMODITY_AUDIT_FIELDS_REQUIRED';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('public.audit_events.global-head', 0));
  SELECT a."hash" INTO v_prev_hash
  FROM public."audit_events" a
  ORDER BY a."createdAt" DESC, a."id" DESC
  LIMIT 1;

  v_material := jsonb_build_object(
    'id', v_id,
    'action', p_action,
    'actorUserId', current_setting('app.current_user_id', true),
    'actorRole', current_setting('app.current_role', true),
    'tenantId', current_setting('app.current_tenant_id', true),
    'orgId', current_setting('app.current_org_id', true),
    'objectType', p_object_type,
    'objectId', p_object_id,
    'beforeState', p_before,
    'afterState', p_after,
    'outcome', p_outcome,
    'reason', p_reason,
    'metadata', COALESCE(p_metadata, '{}'::jsonb),
    'correlationId', p_correlation_id,
    'prevHash', v_prev_hash
  );
  v_hash := encode(digest(convert_to(v_material::text, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public."audit_events" (
    "id", "action", "actorUserId", "actorRole", "tenantId", "orgId",
    "objectType", "objectId", "beforeState", "afterState", "outcome",
    "reason", "metadata", "correlationId", "hash", "prevHash", "createdAt"
  ) VALUES (
    v_id, p_action, current_setting('app.current_user_id', true),
    current_setting('app.current_role', true),
    current_setting('app.current_tenant_id', true),
    current_setting('app.current_org_id', true),
    p_object_type, p_object_id, p_before, p_after, p_outcome, p_reason,
    COALESCE(p_metadata, '{}'::jsonb), p_correlation_id, v_hash, v_prev_hash,
    v_created_at
  );
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION fgis_commodity.append_outbox(
  p_type text,
  p_payload jsonb,
  p_idempotency_key text,
  p_correlation_id text,
  p_audit_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
DECLARE
  v_id text := 'fgis-commodity-outbox-' || gen_random_uuid()::text;
BEGIN
  INSERT INTO public."outbox_entries" (
    "id", "type", "payload", "status", "triggeredByUserId",
    "idempotencyKey", "maxRetries", "retryCount", "nextRetryAt",
    "correlationId", "auditId", "createdAt"
  ) VALUES (
    v_id, p_type, p_payload, 'PENDING',
    current_setting('app.current_user_id', true), p_idempotency_key,
    5, 0, clock_timestamp(), p_correlation_id, p_audit_id, clock_timestamp()
  );
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION fgis_commodity.replay_command(
  p_command_type text,
  p_idempotency_key text,
  p_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
DECLARE
  v_row public."fgis_grain_commodity_commands"%ROWTYPE;
BEGIN
  PERFORM fgis_commodity.lock_key(
    current_setting('app.current_tenant_id', true) || ':'
    || current_setting('app.current_org_id', true) || ':'
    || p_command_type || ':' || p_idempotency_key
  );
  SELECT * INTO v_row
  FROM public."fgis_grain_commodity_commands"
  WHERE "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
    AND "commandType" = p_command_type
    AND "idempotencyKey" = p_idempotency_key;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_row."requestHash" <> p_request_hash THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FGIS_COMMODITY_IDEMPOTENCY_CONFLICT';
  END IF;
  RETURN v_row."result" || jsonb_build_object('duplicate', true);
END;
$function$;

CREATE OR REPLACE FUNCTION fgis_commodity.save_command(
  p_command_type text,
  p_command_id text,
  p_idempotency_key text,
  p_request_hash text,
  p_outcome text,
  p_object_type text,
  p_object_id text,
  p_result jsonb,
  p_audit_id text,
  p_outbox_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
BEGIN
  INSERT INTO public."fgis_grain_commodity_commands" (
    "id", "tenantId", "organizationId", "actorUserId", "actorRole",
    "commandType", "commandId", "idempotencyKey", "requestHash",
    "outcome", "objectType", "objectId", "result", "auditEventId",
    "outboxEntryId", "createdAt"
  ) VALUES (
    'fgis-commodity-command-' || gen_random_uuid()::text,
    current_setting('app.current_tenant_id', true),
    current_setting('app.current_org_id', true),
    current_setting('app.current_user_id', true),
    current_setting('app.current_role', true),
    p_command_type, p_command_id, p_idempotency_key, p_request_hash,
    p_outcome, p_object_type, p_object_id, p_result, p_audit_id,
    p_outbox_id, clock_timestamp()
  );
END;
$function$;

CREATE OR REPLACE FUNCTION fgis_commodity.deny_command(
  p_command_type text,
  p_command_id text,
  p_idempotency_key text,
  p_request_hash text,
  p_object_type text,
  p_object_id text,
  p_code text,
  p_correlation_id text,
  p_metadata jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
DECLARE
  v_audit_id text;
  v_result jsonb;
BEGIN
  v_audit_id := fgis_commodity.append_audit(
    lower(p_command_type) || '.denied', p_object_type, p_object_id,
    NULL, NULL, 'DENIED', p_code,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('commandId', p_command_id),
    p_correlation_id
  );
  v_result := jsonb_build_object(
    'ok', false,
    'code', p_code,
    'correlationId', p_correlation_id,
    'auditId', v_audit_id,
    'duplicate', false
  );
  PERFORM fgis_commodity.save_command(
    p_command_type, p_command_id, p_idempotency_key, p_request_hash,
    'DENIED', p_object_type, p_object_id, v_result, v_audit_id, NULL
  );
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION fgis_commodity.refresh_party_reservation_status(p_party_current_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
DECLARE
  v_current public."fgis_grain_party_current"%ROWTYPE;
  v_consumed numeric(20,6);
BEGIN
  SELECT * INTO v_current
  FROM public."fgis_grain_party_current"
  WHERE "id" = p_party_current_id
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FGIS_PARTY_NOT_FOUND';
  END IF;

  SELECT COALESCE(sum(r."volume"), 0)::numeric(20,6)
  INTO v_consumed
  FROM public."commodity_reservations" r
  WHERE r."partyCurrentId" = v_current."id"
    AND r."tenantId" = v_current."tenantId"
    AND r."organizationId" = v_current."organizationId"
    AND r."status" IN ('PENDING', 'ACTIVE', 'CONVERTED_TO_DEAL', 'FROZEN');

  IF v_current."normalizedStatus" NOT IN (
    'REFRESH_REQUIRED', 'RECONCILIATION_REQUIRED', 'RESTRICTED', 'UNAVAILABLE', 'SYNC_ERROR'
  ) THEN
    UPDATE public."fgis_grain_party_current"
    SET "normalizedStatus" = CASE
          WHEN v_consumed >= v_current."availableSourceAmount" THEN 'FULLY_RESERVED'
          WHEN v_consumed > 0 THEN 'PARTIALLY_RESERVED'
          ELSE 'AVAILABLE'
        END,
        "version" = "version" + 1,
        "updatedAt" = clock_timestamp()
    WHERE "id" = v_current."id";
  ELSE
    UPDATE public."fgis_grain_party_current"
    SET "version" = "version" + 1,
        "updatedAt" = clock_timestamp()
    WHERE "id" = v_current."id";
  END IF;
END;
$function$;

-- ── Controlled commands ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fgis_commodity.bind_organization_connection(
  p_provider_configuration_id text,
  p_expected_version bigint,
  p_command_id text,
  p_idempotency_key text,
  p_correlation_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
DECLARE
  v_request_hash text;
  v_replay jsonb;
  v_config public."fgis_grain_provider_configurations"%ROWTYPE;
  v_connection public."fgis_grain_organization_connections"%ROWTYPE;
  v_gate_count integer;
  v_attestation_fingerprint text;
  v_audit_id text;
  v_outbox_id text;
  v_result jsonb;
  v_now timestamptz := clock_timestamp();
BEGIN
  PERFORM fgis_commodity.assert_actor(ARRAY['ADMIN']);
  v_request_hash := encode(digest(convert_to(concat_ws('|',
    p_provider_configuration_id, p_expected_version::text
  ), 'UTF8'), 'sha256'), 'hex');
  v_replay := fgis_commodity.replay_command('BIND_CONNECTION', p_idempotency_key, v_request_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  PERFORM fgis_commodity.lock_key(
    current_setting('app.current_tenant_id', true) || ':connection:' || p_provider_configuration_id
  );
  SELECT * INTO v_config
  FROM public."fgis_grain_provider_configurations"
  WHERE "id" = p_provider_configuration_id
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN fgis_commodity.deny_command(
      'BIND_CONNECTION', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_CONNECTION', p_provider_configuration_id,
      'FGIS_PROVIDER_CONFIGURATION_NOT_FOUND', p_correlation_id, '{}'::jsonb
    );
  END IF;
  IF v_config."status" <> 'TEST_APPROVED' THEN
    RETURN fgis_commodity.deny_command(
      'BIND_CONNECTION', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_CONNECTION', p_provider_configuration_id,
      'FGIS_PROVIDER_NOT_ATTESTED', p_correlation_id,
      jsonb_build_object('configurationStatus', v_config."status")
    );
  END IF;

  WITH latest AS (
    SELECT DISTINCT ON (a."gate")
      a."gate", a."id", a."hash"
    FROM public."fgis_grain_provider_attestations" a
    WHERE a."configurationId" = v_config."id"
      AND a."configurationVersion" = v_config."version"
      AND a."decision" = 'APPROVED'
      AND a."validUntil" > v_now
    ORDER BY a."gate", a."createdAt" DESC, a."id" DESC
  )
  SELECT count(*),
         encode(digest(convert_to(string_agg(
           latest."gate" || ':' || latest."id" || ':' || latest."hash",
           '|' ORDER BY latest."gate"
         ), 'UTF8'), 'sha256'), 'hex')
  INTO v_gate_count, v_attestation_fingerprint
  FROM latest;

  IF v_gate_count <> 4 OR v_attestation_fingerprint IS NULL THEN
    RETURN fgis_commodity.deny_command(
      'BIND_CONNECTION', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_CONNECTION', p_provider_configuration_id,
      'FGIS_PROVIDER_ATTESTATION_SET_INCOMPLETE', p_correlation_id,
      jsonb_build_object('approvedGateCount', v_gate_count)
    );
  END IF;

  SELECT * INTO v_connection
  FROM public."fgis_grain_organization_connections"
  WHERE "providerConfigurationId" = v_config."id"
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_expected_version <> 0 THEN
      RETURN fgis_commodity.deny_command(
        'BIND_CONNECTION', p_command_id, p_idempotency_key, v_request_hash,
        'FGIS_CONNECTION', p_provider_configuration_id,
        'FGIS_CONNECTION_STALE_VERSION', p_correlation_id,
        jsonb_build_object('actualVersion', '0', 'expectedVersion', p_expected_version::text)
      );
    END IF;
    INSERT INTO public."fgis_grain_organization_connections" (
      "id", "tenantId", "organizationId", "providerConfigurationId",
      "providerConfigurationVersion", "providerAttestationFingerprint",
      "status", "authMode", "apiVersion", "adapterVersion", "version",
      "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
    ) VALUES (
      'fgis-connection-' || gen_random_uuid()::text,
      current_setting('app.current_tenant_id', true),
      current_setting('app.current_org_id', true),
      v_config."id", v_config."version", v_attestation_fingerprint,
      'BOUND', 'REFERENCE_ONLY', v_config."apiVersion", v_config."mappingVersion",
      1, current_setting('app.current_user_id', true),
      current_setting('app.current_user_id', true), v_now, v_now
    ) RETURNING * INTO v_connection;
  ELSE
    IF v_connection."version" <> p_expected_version THEN
      RETURN fgis_commodity.deny_command(
        'BIND_CONNECTION', p_command_id, p_idempotency_key, v_request_hash,
        'FGIS_CONNECTION', v_connection."id",
        'FGIS_CONNECTION_STALE_VERSION', p_correlation_id,
        jsonb_build_object(
          'actualVersion', v_connection."version"::text,
          'expectedVersion', p_expected_version::text
        )
      );
    END IF;
    IF v_connection."status" = 'REVOKED' THEN
      RETURN fgis_commodity.deny_command(
        'BIND_CONNECTION', p_command_id, p_idempotency_key, v_request_hash,
        'FGIS_CONNECTION', v_connection."id",
        'FGIS_CONNECTION_REVOKED', p_correlation_id, '{}'::jsonb
      );
    END IF;
    UPDATE public."fgis_grain_organization_connections"
    SET "providerConfigurationVersion" = v_config."version",
        "providerAttestationFingerprint" = v_attestation_fingerprint,
        "status" = 'BOUND',
        "apiVersion" = v_config."apiVersion",
        "adapterVersion" = v_config."mappingVersion",
        "version" = "version" + 1,
        "updatedByUserId" = current_setting('app.current_user_id', true),
        "updatedAt" = v_now,
        "disabledAt" = NULL
    WHERE "id" = v_connection."id"
    RETURNING * INTO v_connection;
  END IF;

  v_audit_id := fgis_commodity.append_audit(
    'fgis.commodity.connection.bound', 'FGIS_CONNECTION', v_connection."id",
    NULL,
    jsonb_build_object(
      'status', v_connection."status",
      'version', v_connection."version"::text,
      'providerConfigurationId', v_connection."providerConfigurationId",
      'providerConfigurationVersion', v_connection."providerConfigurationVersion"::text,
      'providerAttestationFingerprint', v_connection."providerAttestationFingerprint"
    ),
    'ACCEPTED', NULL,
    jsonb_build_object('commandId', p_command_id, 'requestFingerprint', v_request_hash),
    p_correlation_id
  );
  v_outbox_id := fgis_commodity.append_outbox(
    'fgis.commodity.connection.bound',
    jsonb_build_object(
      'connectionId', v_connection."id",
      'tenantId', v_connection."tenantId",
      'organizationId', v_connection."organizationId",
      'status', v_connection."status",
      'version', v_connection."version"::text
    ),
    'fgis-commodity-connection:' || current_setting('app.current_tenant_id', true)
      || ':' || p_idempotency_key,
    p_correlation_id, v_audit_id
  );
  v_result := jsonb_build_object(
    'ok', true,
    'connectionId', v_connection."id",
    'status', v_connection."status",
    'version', v_connection."version"::text,
    'auditId', v_audit_id,
    'outboxId', v_outbox_id,
    'duplicate', false
  );
  PERFORM fgis_commodity.save_command(
    'BIND_CONNECTION', p_command_id, p_idempotency_key, v_request_hash,
    'ACCEPTED', 'FGIS_CONNECTION', v_connection."id", v_result,
    v_audit_id, v_outbox_id
  );
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION fgis_commodity.start_sync_run(
  p_connection_id text,
  p_operation_code text,
  p_records_modified_from timestamptz,
  p_page_cursor text,
  p_expected_connection_version bigint,
  p_command_id text,
  p_idempotency_key text,
  p_correlation_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
DECLARE
  v_request_hash text;
  v_replay jsonb;
  v_connection public."fgis_grain_organization_connections"%ROWTYPE;
  v_run public."fgis_grain_sync_runs"%ROWTYPE;
  v_audit_id text;
  v_outbox_id text;
  v_result jsonb;
  v_now timestamptz := clock_timestamp();
BEGIN
  PERFORM fgis_commodity.assert_actor(ARRAY['ADMIN', 'FARMER']);
  v_request_hash := encode(digest(convert_to(concat_ws('|',
    p_connection_id, p_operation_code, COALESCE(p_records_modified_from::text, ''),
    COALESCE(p_page_cursor, ''), p_expected_connection_version::text
  ), 'UTF8'), 'sha256'), 'hex');
  v_replay := fgis_commodity.replay_command('START_SYNC_RUN', p_idempotency_key, v_request_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  IF p_operation_code NOT IN ('GET_LIST_LOT', 'GET_LIST_SDIZ')
     OR length(COALESCE(p_page_cursor, '')) > 2048
  THEN
    RETURN fgis_commodity.deny_command(
      'START_SYNC_RUN', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_SYNC_RUN', NULL, 'FGIS_SYNC_REQUEST_INVALID', p_correlation_id, '{}'::jsonb
    );
  END IF;

  PERFORM fgis_commodity.lock_key(
    current_setting('app.current_tenant_id', true) || ':sync:' || p_connection_id
  );
  SELECT * INTO v_connection
  FROM public."fgis_grain_organization_connections"
  WHERE "id" = p_connection_id
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN fgis_commodity.deny_command(
      'START_SYNC_RUN', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_CONNECTION', p_connection_id, 'FGIS_CONNECTION_NOT_FOUND', p_correlation_id, '{}'::jsonb
    );
  END IF;
  IF v_connection."version" <> p_expected_connection_version THEN
    RETURN fgis_commodity.deny_command(
      'START_SYNC_RUN', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_CONNECTION', p_connection_id, 'FGIS_CONNECTION_STALE_VERSION', p_correlation_id,
      jsonb_build_object(
        'actualVersion', v_connection."version"::text,
        'expectedVersion', p_expected_connection_version::text
      )
    );
  END IF;
  IF v_connection."status" <> 'BOUND' THEN
    RETURN fgis_commodity.deny_command(
      'START_SYNC_RUN', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_CONNECTION', p_connection_id, 'FGIS_CONNECTION_NOT_BOUND', p_correlation_id,
      jsonb_build_object('status', v_connection."status")
    );
  END IF;
  IF EXISTS (
    SELECT 1 FROM public."fgis_grain_sync_runs" r
    WHERE r."connectionId" = v_connection."id"
      AND r."tenantId" = v_connection."tenantId"
      AND r."organizationId" = v_connection."organizationId"
      AND r."status" IN ('REQUESTED', 'DISPATCHED', 'WAITING_RESPONSE', 'PROCESSING')
  ) THEN
    RETURN fgis_commodity.deny_command(
      'START_SYNC_RUN', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_CONNECTION', p_connection_id, 'FGIS_SYNC_ALREADY_RUNNING', p_correlation_id, '{}'::jsonb
    );
  END IF;

  INSERT INTO public."fgis_grain_sync_runs" (
    "id", "tenantId", "organizationId", "connectionId", "operationCode",
    "status", "startedAt", "pageCursor", "recordsModifiedFrom",
    "correlationId", "initiatedByUserId", "idempotencyKey",
    "requestFingerprint", "version", "createdAt", "updatedAt"
  ) VALUES (
    'fgis-sync-' || gen_random_uuid()::text,
    current_setting('app.current_tenant_id', true),
    current_setting('app.current_org_id', true),
    v_connection."id", p_operation_code, 'REQUESTED', v_now,
    NULLIF(btrim(p_page_cursor), ''), p_records_modified_from,
    p_correlation_id, current_setting('app.current_user_id', true),
    p_idempotency_key, v_request_hash, 1, v_now, v_now
  ) RETURNING * INTO v_run;

  UPDATE public."fgis_grain_organization_connections"
  SET "lastAttemptAt" = v_now,
      "version" = "version" + 1,
      "updatedByUserId" = current_setting('app.current_user_id', true),
      "updatedAt" = v_now
  WHERE "id" = v_connection."id";

  v_audit_id := fgis_commodity.append_audit(
    'fgis.commodity.sync.requested', 'FGIS_SYNC_RUN', v_run."id", NULL,
    jsonb_build_object(
      'status', v_run."status",
      'operationCode', v_run."operationCode",
      'connectionId', v_run."connectionId",
      'version', v_run."version"::text
    ), 'ACCEPTED', NULL,
    jsonb_build_object('commandId', p_command_id, 'requestFingerprint', v_request_hash),
    p_correlation_id
  );
  v_outbox_id := fgis_commodity.append_outbox(
    'fgis.commodity.sync.requested',
    jsonb_build_object(
      'syncRunId', v_run."id", 'connectionId', v_run."connectionId",
      'operationCode', v_run."operationCode", 'status', v_run."status"
    ),
    'fgis-commodity-sync:' || current_setting('app.current_tenant_id', true)
      || ':' || p_idempotency_key,
    p_correlation_id, v_audit_id
  );
  v_result := jsonb_build_object(
    'ok', true, 'syncRunId', v_run."id", 'status', v_run."status",
    'version', v_run."version"::text, 'auditId', v_audit_id,
    'outboxId', v_outbox_id, 'duplicate', false
  );
  PERFORM fgis_commodity.save_command(
    'START_SYNC_RUN', p_command_id, p_idempotency_key, v_request_hash,
    'ACCEPTED', 'FGIS_SYNC_RUN', v_run."id", v_result,
    v_audit_id, v_outbox_id
  );
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION fgis_commodity.accept_party_snapshot(
  p_connection_id text,
  p_sync_run_id text,
  p_snapshot jsonb,
  p_expected_current_version bigint,
  p_command_id text,
  p_idempotency_key text,
  p_correlation_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
DECLARE
  v_request_hash text;
  v_replay jsonb;
  v_connection public."fgis_grain_organization_connections"%ROWTYPE;
  v_run public."fgis_grain_sync_runs"%ROWTYPE;
  v_existing_snapshot public."fgis_grain_party_snapshots"%ROWTYPE;
  v_snapshot public."fgis_grain_party_snapshots"%ROWTYPE;
  v_current public."fgis_grain_party_current"%ROWTYPE;
  v_external_party_id text;
  v_amount_original numeric(20,6);
  v_amount_available numeric(20,6);
  v_unit_authority text;
  v_normalized_unit text;
  v_external_status text;
  v_normalized_status text;
  v_source_updated_at timestamptz;
  v_source_registered_at timestamptz;
  v_audit_id text;
  v_outbox_id text;
  v_result jsonb;
  v_now timestamptz := clock_timestamp();
BEGIN
  PERFORM fgis_commodity.assert_actor(ARRAY['SYSTEM', 'SERVICE', 'ADMIN']);
  v_request_hash := encode(digest(convert_to(concat_ws('|',
    p_connection_id, p_sync_run_id, p_snapshot::text,
    p_expected_current_version::text
  ), 'UTF8'), 'sha256'), 'hex');
  v_replay := fgis_commodity.replay_command('ACCEPT_PARTY_SNAPSHOT', p_idempotency_key, v_request_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object'
     OR octet_length(p_snapshot::text) > 262144
     OR p_snapshot ?| ARRAY[
       'tenantId', 'organizationId', 'rawXml', 'xml', 'body', 'headers',
       'credential', 'credentials', 'token', 'certificate', 'privateKey', 'secret'
     ]
  THEN
    RETURN fgis_commodity.deny_command(
      'ACCEPT_PARTY_SNAPSHOT', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_PARTY', NULL, 'FGIS_PARTY_SNAPSHOT_PAYLOAD_INVALID', p_correlation_id, '{}'::jsonb
    );
  END IF;

  v_external_party_id := NULLIF(btrim(p_snapshot->>'externalPartyId'), '');
  v_unit_authority := COALESCE(NULLIF(btrim(p_snapshot->>'unitAuthority'), ''), 'UNCONFIRMED');
  v_normalized_unit := NULLIF(btrim(p_snapshot->>'normalizedUnitCode'), '');
  v_external_status := NULLIF(btrim(p_snapshot->>'externalStatus'), '');

  IF v_external_party_id IS NULL OR length(v_external_party_id) > 256
     OR v_external_status IS NULL OR length(v_external_status) > 64
     OR COALESCE(p_snapshot->>'payloadHash', '') !~ '^[a-f0-9]{64}$'
     OR COALESCE(p_snapshot->>'criticalHash', '') !~ '^[a-f0-9]{64}$'
     OR COALESCE(p_snapshot->>'amountAvailable', '') !~ '^(0|[1-9][0-9]{0,19})(\.[0-9]{1,6})?$'
     OR (p_snapshot ? 'amountOriginal' AND p_snapshot->>'amountOriginal' IS NOT NULL
         AND p_snapshot->>'amountOriginal' !~ '^(0|[1-9][0-9]{0,19})(\.[0-9]{1,6})?$')
     OR v_unit_authority NOT IN ('UNCONFIRMED', 'CONTRACT', 'PROVIDER')
     OR (v_unit_authority = 'UNCONFIRMED' AND v_normalized_unit IS NOT NULL)
     OR (v_unit_authority IN ('CONTRACT', 'PROVIDER') AND v_normalized_unit IS NULL)
     OR NOT pg_input_is_valid(p_snapshot->>'sourceUpdatedAt', 'timestamp with time zone')
     OR (p_snapshot ? 'sourceRegisteredAt' AND p_snapshot->>'sourceRegisteredAt' IS NOT NULL
         AND NOT pg_input_is_valid(p_snapshot->>'sourceRegisteredAt', 'timestamp with time zone'))
     OR jsonb_typeof(COALESCE(p_snapshot->'storagePlace', '{}'::jsonb)) <> 'object'
     OR jsonb_typeof(COALESCE(p_snapshot->'qualityValues', '{}'::jsonb)) <> 'object'
  THEN
    RETURN fgis_commodity.deny_command(
      'ACCEPT_PARTY_SNAPSHOT', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_PARTY', v_external_party_id, 'FGIS_PARTY_SNAPSHOT_FIELDS_INVALID',
      p_correlation_id, '{}'::jsonb
    );
  END IF;

  v_amount_available := (p_snapshot->>'amountAvailable')::numeric(20,6);
  v_amount_original := CASE
    WHEN NULLIF(p_snapshot->>'amountOriginal', '') IS NULL THEN NULL
    ELSE (p_snapshot->>'amountOriginal')::numeric(20,6)
  END;
  v_source_updated_at := (p_snapshot->>'sourceUpdatedAt')::timestamptz;
  v_source_registered_at := CASE
    WHEN NULLIF(p_snapshot->>'sourceRegisteredAt', '') IS NULL THEN NULL
    ELSE (p_snapshot->>'sourceRegisteredAt')::timestamptz
  END;

  PERFORM fgis_commodity.lock_key(
    current_setting('app.current_tenant_id', true) || ':party:' || v_external_party_id
  );
  SELECT * INTO v_connection
  FROM public."fgis_grain_organization_connections"
  WHERE "id" = p_connection_id
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
  FOR UPDATE;
  IF NOT FOUND OR v_connection."status" <> 'BOUND' THEN
    RETURN fgis_commodity.deny_command(
      'ACCEPT_PARTY_SNAPSHOT', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_CONNECTION', p_connection_id, 'FGIS_CONNECTION_NOT_BOUND',
      p_correlation_id, '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_run
  FROM public."fgis_grain_sync_runs"
  WHERE "id" = p_sync_run_id
    AND "connectionId" = v_connection."id"
    AND "tenantId" = v_connection."tenantId"
    AND "organizationId" = v_connection."organizationId"
  FOR UPDATE;
  IF NOT FOUND OR v_run."status" NOT IN ('REQUESTED', 'DISPATCHED', 'WAITING_RESPONSE', 'PROCESSING') THEN
    RETURN fgis_commodity.deny_command(
      'ACCEPT_PARTY_SNAPSHOT', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_SYNC_RUN', p_sync_run_id, 'FGIS_SYNC_RUN_NOT_PROCESSABLE',
      p_correlation_id, '{}'::jsonb
    );
  END IF;

  IF v_connection."externalOrganizationId" IS NOT NULL
     AND NULLIF(btrim(p_snapshot->>'ownerReference'), '') IS DISTINCT FROM v_connection."externalOrganizationId"
  THEN
    RETURN fgis_commodity.deny_command(
      'ACCEPT_PARTY_SNAPSHOT', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_PARTY', v_external_party_id, 'FGIS_PARTY_OWNER_MISMATCH',
      p_correlation_id, '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_existing_snapshot
  FROM public."fgis_grain_party_snapshots"
  WHERE "tenantId" = v_connection."tenantId"
    AND "organizationId" = v_connection."organizationId"
    AND "externalPartyId" = v_external_party_id
    AND "payloadHash" = p_snapshot->>'payloadHash';

  IF FOUND THEN
    v_snapshot := v_existing_snapshot;
  ELSE
    INSERT INTO public."fgis_grain_party_snapshots" (
      "id", "tenantId", "organizationId", "connectionId", "syncRunId",
      "externalPartyId", "externalPartyNumber", "externalRecordId",
      "adapterVersion", "contractVersion", "ownerReference", "agentReference",
      "repositoryReference", "productCode", "productName", "okpd2Code",
      "tnvedCode", "targetCode", "purposeCode", "harvestYear",
      "storagePlace", "amountOriginal", "amountAvailable", "sourceUnitCode",
      "normalizedUnitCode", "unitAuthority", "qualityValues", "externalStatus",
      "sourceRegisteredAt", "sourceUpdatedAt", "fetchedAt", "organicFlag",
      "quarantineZoneFlag", "payloadHash", "criticalHash",
      "protectedRawReference", "createdAt"
    ) VALUES (
      'fgis-party-snapshot-' || gen_random_uuid()::text,
      v_connection."tenantId", v_connection."organizationId",
      v_connection."id", v_run."id", v_external_party_id,
      NULLIF(btrim(p_snapshot->>'externalPartyNumber'), ''),
      NULLIF(btrim(p_snapshot->>'externalRecordId'), ''),
      COALESCE(NULLIF(btrim(p_snapshot->>'adapterVersion'), ''), v_connection."adapterVersion"),
      COALESCE(NULLIF(btrim(p_snapshot->>'contractVersion'), ''), v_connection."apiVersion"),
      NULLIF(btrim(p_snapshot->>'ownerReference'), ''),
      NULLIF(btrim(p_snapshot->>'agentReference'), ''),
      NULLIF(btrim(p_snapshot->>'repositoryReference'), ''),
      NULLIF(btrim(p_snapshot->>'productCode'), ''),
      NULLIF(btrim(p_snapshot->>'productName'), ''),
      NULLIF(btrim(p_snapshot->>'okpd2Code'), ''),
      NULLIF(btrim(p_snapshot->>'tnvedCode'), ''),
      NULLIF(btrim(p_snapshot->>'targetCode'), ''),
      NULLIF(btrim(p_snapshot->>'purposeCode'), ''),
      CASE WHEN NULLIF(p_snapshot->>'harvestYear', '') IS NULL THEN NULL
           WHEN p_snapshot->>'harvestYear' ~ '^[0-9]{4}$' THEN (p_snapshot->>'harvestYear')::integer
           ELSE NULL END,
      COALESCE(p_snapshot->'storagePlace', '{}'::jsonb),
      v_amount_original, v_amount_available,
      NULLIF(btrim(p_snapshot->>'sourceUnitCode'), ''),
      v_normalized_unit, v_unit_authority,
      COALESCE(p_snapshot->'qualityValues', '{}'::jsonb),
      v_external_status, v_source_registered_at, v_source_updated_at,
      v_now,
      CASE WHEN p_snapshot ? 'organicFlag' THEN (p_snapshot->>'organicFlag')::boolean ELSE NULL END,
      CASE WHEN p_snapshot ? 'quarantineZoneFlag' THEN (p_snapshot->>'quarantineZoneFlag')::boolean ELSE NULL END,
      p_snapshot->>'payloadHash', p_snapshot->>'criticalHash',
      COALESCE(NULLIF(btrim(p_snapshot->>'protectedRawReference'), ''),
        'evidence://fgis-grain/' || (p_snapshot->>'payloadHash')),
      v_now
    ) RETURNING * INTO v_snapshot;
  END IF;

  v_normalized_status := CASE
    WHEN v_external_status = 'SUBSCRIBED' AND v_unit_authority <> 'UNCONFIRMED'
         AND v_amount_available > 0 THEN 'AVAILABLE'
    WHEN v_external_status = 'SUBSCRIBED' THEN 'REFRESH_REQUIRED'
    WHEN v_external_status IN ('BLOCKED', 'CANCELED') THEN 'RESTRICTED'
    WHEN v_external_status = 'IN_ARCHIVE' THEN 'UNAVAILABLE'
    ELSE 'RECONCILIATION_REQUIRED'
  END;

  SELECT * INTO v_current
  FROM public."fgis_grain_party_current"
  WHERE "tenantId" = v_connection."tenantId"
    AND "organizationId" = v_connection."organizationId"
    AND "externalPartyId" = v_external_party_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_expected_current_version <> 0 THEN
      RETURN fgis_commodity.deny_command(
        'ACCEPT_PARTY_SNAPSHOT', p_command_id, p_idempotency_key, v_request_hash,
        'FGIS_PARTY', v_external_party_id, 'FGIS_PARTY_CURRENT_STALE_VERSION',
        p_correlation_id,
        jsonb_build_object('actualVersion', '0', 'expectedVersion', p_expected_current_version::text)
      );
    END IF;
    INSERT INTO public."fgis_grain_party_current" (
      "id", "tenantId", "organizationId", "connectionId", "externalPartyId",
      "currentSnapshotId", "normalizedStatus", "freshnessStatus",
      "sourceUpdatedAt", "fetchedAt", "availableSourceAmount",
      "normalizedUnitCode", "criticalHash", "version", "createdAt", "updatedAt"
    ) VALUES (
      'fgis-party-current-' || gen_random_uuid()::text,
      v_connection."tenantId", v_connection."organizationId", v_connection."id",
      v_external_party_id, v_snapshot."id", v_normalized_status, 'FRESH',
      v_snapshot."sourceUpdatedAt", v_snapshot."fetchedAt",
      v_snapshot."amountAvailable", v_snapshot."normalizedUnitCode",
      v_snapshot."criticalHash", 1, v_now, v_now
    ) RETURNING * INTO v_current;
  ELSE
    IF v_current."version" <> p_expected_current_version THEN
      RETURN fgis_commodity.deny_command(
        'ACCEPT_PARTY_SNAPSHOT', p_command_id, p_idempotency_key, v_request_hash,
        'FGIS_PARTY', v_current."id", 'FGIS_PARTY_CURRENT_STALE_VERSION',
        p_correlation_id,
        jsonb_build_object(
          'actualVersion', v_current."version"::text,
          'expectedVersion', p_expected_current_version::text
        )
      );
    END IF;
    UPDATE public."fgis_grain_party_current"
    SET "currentSnapshotId" = v_snapshot."id",
        "normalizedStatus" = v_normalized_status,
        "freshnessStatus" = 'FRESH',
        "sourceUpdatedAt" = v_snapshot."sourceUpdatedAt",
        "fetchedAt" = v_snapshot."fetchedAt",
        "availableSourceAmount" = v_snapshot."amountAvailable",
        "normalizedUnitCode" = v_snapshot."normalizedUnitCode",
        "criticalHash" = v_snapshot."criticalHash",
        "version" = "version" + 1,
        "updatedAt" = v_now
    WHERE "id" = v_current."id"
    RETURNING * INTO v_current;
  END IF;

  UPDATE public."fgis_grain_sync_runs"
  SET "status" = 'PROCESSING',
      "recordsReceived" = "recordsReceived" + 1,
      "recordsCreated" = "recordsCreated" + CASE WHEN v_existing_snapshot."id" IS NULL THEN 1 ELSE 0 END,
      "recordsUnchanged" = "recordsUnchanged" + CASE WHEN v_existing_snapshot."id" IS NOT NULL THEN 1 ELSE 0 END,
      "version" = "version" + 1,
      "updatedAt" = v_now
  WHERE "id" = v_run."id";

  v_audit_id := fgis_commodity.append_audit(
    'fgis.commodity.party.snapshot.accepted', 'FGIS_PARTY', v_current."id", NULL,
    jsonb_build_object(
      'externalPartyId', v_external_party_id,
      'snapshotId', v_snapshot."id",
      'currentVersion', v_current."version"::text,
      'normalizedStatus', v_current."normalizedStatus",
      'freshnessStatus', v_current."freshnessStatus",
      'payloadHash', v_snapshot."payloadHash",
      'criticalHash', v_snapshot."criticalHash"
    ), 'ACCEPTED', NULL,
    jsonb_build_object(
      'commandId', p_command_id,
      'requestFingerprint', v_request_hash,
      'snapshotReused', v_existing_snapshot."id" IS NOT NULL
    ), p_correlation_id
  );
  v_outbox_id := fgis_commodity.append_outbox(
    'fgis.commodity.party.snapshot.accepted',
    jsonb_build_object(
      'partyCurrentId', v_current."id",
      'snapshotId', v_snapshot."id",
      'externalPartyId', v_external_party_id,
      'normalizedStatus', v_current."normalizedStatus",
      'version', v_current."version"::text
    ),
    'fgis-commodity-party:' || current_setting('app.current_tenant_id', true)
      || ':' || p_idempotency_key,
    p_correlation_id, v_audit_id
  );
  v_result := jsonb_build_object(
    'ok', true,
    'partyCurrentId', v_current."id",
    'snapshotId', v_snapshot."id",
    'snapshotReused', v_existing_snapshot."id" IS NOT NULL,
    'normalizedStatus', v_current."normalizedStatus",
    'freshnessStatus', v_current."freshnessStatus",
    'version', v_current."version"::text,
    'auditId', v_audit_id,
    'outboxId', v_outbox_id,
    'duplicate', false
  );
  PERFORM fgis_commodity.save_command(
    'ACCEPT_PARTY_SNAPSHOT', p_command_id, p_idempotency_key, v_request_hash,
    'ACCEPTED', 'FGIS_PARTY', v_current."id", v_result,
    v_audit_id, v_outbox_id
  );
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION fgis_commodity.reserve_volume(
  p_party_current_id text,
  p_source_snapshot_id text,
  p_volume numeric,
  p_unit text,
  p_reason text,
  p_expires_at timestamptz,
  p_expected_party_version bigint,
  p_command_id text,
  p_idempotency_key text,
  p_correlation_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
DECLARE
  v_request_hash text;
  v_replay jsonb;
  v_current public."fgis_grain_party_current"%ROWTYPE;
  v_snapshot public."fgis_grain_party_snapshots"%ROWTYPE;
  v_consumed numeric(20,6);
  v_available numeric(20,6);
  v_reservation public."commodity_reservations"%ROWTYPE;
  v_audit_id text;
  v_outbox_id text;
  v_result jsonb;
  v_now timestamptz := clock_timestamp();
BEGIN
  PERFORM fgis_commodity.assert_actor(ARRAY['FARMER']);
  v_request_hash := encode(digest(convert_to(concat_ws('|',
    p_party_current_id, p_source_snapshot_id, p_volume::text, p_unit,
    p_reason, p_expires_at::text, p_expected_party_version::text
  ), 'UTF8'), 'sha256'), 'hex');
  v_replay := fgis_commodity.replay_command('RESERVE_VOLUME', p_idempotency_key, v_request_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  IF p_volume IS NULL OR p_volume <= 0
     OR NULLIF(btrim(p_unit), '') IS NULL OR length(p_unit) > 64
     OR NULLIF(btrim(p_reason), '') IS NULL OR length(p_reason) > 1000
     OR p_expires_at <= v_now
  THEN
    RETURN fgis_commodity.deny_command(
      'RESERVE_VOLUME', p_command_id, p_idempotency_key, v_request_hash,
      'COMMODITY_RESERVATION', NULL, 'FGIS_RESERVATION_INPUT_INVALID',
      p_correlation_id, '{}'::jsonb
    );
  END IF;

  PERFORM fgis_commodity.lock_key(
    current_setting('app.current_tenant_id', true) || ':reservation:' || p_party_current_id
  );
  SELECT * INTO v_current
  FROM public."fgis_grain_party_current"
  WHERE "id" = p_party_current_id
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN fgis_commodity.deny_command(
      'RESERVE_VOLUME', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_PARTY', p_party_current_id, 'FGIS_PARTY_NOT_FOUND', p_correlation_id, '{}'::jsonb
    );
  END IF;
  IF v_current."version" <> p_expected_party_version THEN
    RETURN fgis_commodity.deny_command(
      'RESERVE_VOLUME', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_PARTY', p_party_current_id, 'FGIS_PARTY_STALE_VERSION', p_correlation_id,
      jsonb_build_object(
        'actualVersion', v_current."version"::text,
        'expectedVersion', p_expected_party_version::text
      )
    );
  END IF;
  IF v_current."currentSnapshotId" <> p_source_snapshot_id THEN
    RETURN fgis_commodity.deny_command(
      'RESERVE_VOLUME', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_PARTY', p_party_current_id, 'FGIS_PARTY_SOURCE_CHANGED', p_correlation_id,
      jsonb_build_object('currentSnapshotId', v_current."currentSnapshotId")
    );
  END IF;
  IF v_current."freshnessStatus" NOT IN ('FRESH', 'ACCEPTABLE')
     OR v_current."normalizedStatus" IN (
       'REFRESH_REQUIRED', 'RECONCILIATION_REQUIRED', 'RESTRICTED',
       'UNAVAILABLE', 'SYNC_ERROR'
     )
  THEN
    RETURN fgis_commodity.deny_command(
      'RESERVE_VOLUME', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_PARTY', p_party_current_id, 'FGIS_PARTY_NOT_RESERVABLE', p_correlation_id,
      jsonb_build_object(
        'normalizedStatus', v_current."normalizedStatus",
        'freshnessStatus', v_current."freshnessStatus"
      )
    );
  END IF;
  IF v_current."normalizedUnitCode" IS NULL THEN
    RETURN fgis_commodity.deny_command(
      'RESERVE_VOLUME', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_PARTY', p_party_current_id, 'FGIS_PARTY_UNIT_UNCONFIRMED', p_correlation_id, '{}'::jsonb
    );
  END IF;
  IF v_current."normalizedUnitCode" <> p_unit THEN
    RETURN fgis_commodity.deny_command(
      'RESERVE_VOLUME', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_PARTY', p_party_current_id, 'FGIS_RESERVATION_UNIT_MISMATCH', p_correlation_id,
      jsonb_build_object('authoritativeUnit', v_current."normalizedUnitCode")
    );
  END IF;
  IF EXISTS (
    SELECT 1 FROM public."fgis_grain_reconciliation_cases" c
    WHERE c."partyCurrentId" = v_current."id"
      AND c."tenantId" = v_current."tenantId"
      AND c."organizationId" = v_current."organizationId"
      AND c."severity" = 'CRITICAL'
      AND c."status" IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING')
  ) THEN
    RETURN fgis_commodity.deny_command(
      'RESERVE_VOLUME', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_PARTY', p_party_current_id, 'FGIS_PARTY_RECONCILIATION_REQUIRED',
      p_correlation_id, '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_snapshot
  FROM public."fgis_grain_party_snapshots"
  WHERE "id" = p_source_snapshot_id
    AND "tenantId" = v_current."tenantId"
    AND "organizationId" = v_current."organizationId"
    AND "externalPartyId" = v_current."externalPartyId";
  IF NOT FOUND THEN
    RETURN fgis_commodity.deny_command(
      'RESERVE_VOLUME', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_PARTY', p_party_current_id, 'FGIS_PARTY_SNAPSHOT_NOT_FOUND', p_correlation_id, '{}'::jsonb
    );
  END IF;

  SELECT COALESCE(sum(r."volume"), 0)::numeric(20,6)
  INTO v_consumed
  FROM public."commodity_reservations" r
  WHERE r."partyCurrentId" = v_current."id"
    AND r."tenantId" = v_current."tenantId"
    AND r."organizationId" = v_current."organizationId"
    AND r."status" IN ('PENDING', 'ACTIVE', 'CONVERTED_TO_DEAL', 'FROZEN');
  v_available := v_current."availableSourceAmount" - v_consumed;
  IF p_volume > v_available THEN
    RETURN fgis_commodity.deny_command(
      'RESERVE_VOLUME', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_PARTY', p_party_current_id, 'FGIS_RESERVATION_EXCEEDS_AVAILABLE',
      p_correlation_id,
      jsonb_build_object(
        'requested', p_volume::text,
        'available', GREATEST(v_available, 0)::text,
        'consumed', v_consumed::text
      )
    );
  END IF;

  INSERT INTO public."commodity_reservations" (
    "id", "tenantId", "organizationId", "partyCurrentId", "sourceSnapshotId",
    "volume", "unit", "status", "reason", "idempotencyKey",
    "requestFingerprint", "version", "createdByUserId", "createdAt",
    "expiresAt", "activatedAt"
  ) VALUES (
    'commodity-reservation-' || gen_random_uuid()::text,
    v_current."tenantId", v_current."organizationId", v_current."id",
    v_snapshot."id", p_volume, p_unit, 'ACTIVE', p_reason,
    p_idempotency_key, v_request_hash, 1,
    current_setting('app.current_user_id', true), v_now, p_expires_at, v_now
  ) RETURNING * INTO v_reservation;

  PERFORM fgis_commodity.refresh_party_reservation_status(v_current."id");
  SELECT * INTO v_current FROM public."fgis_grain_party_current" WHERE "id" = v_current."id";

  v_audit_id := fgis_commodity.append_audit(
    'fgis.commodity.reservation.created', 'COMMODITY_RESERVATION', v_reservation."id",
    NULL,
    jsonb_build_object(
      'partyCurrentId', v_reservation."partyCurrentId",
      'sourceSnapshotId', v_reservation."sourceSnapshotId",
      'volume', v_reservation."volume"::text,
      'unit', v_reservation."unit",
      'status', v_reservation."status",
      'expiresAt', v_reservation."expiresAt",
      'partyVersion', v_current."version"::text
    ), 'ACCEPTED', NULL,
    jsonb_build_object('commandId', p_command_id, 'requestFingerprint', v_request_hash),
    p_correlation_id
  );
  UPDATE public."commodity_reservations"
  SET "auditReference" = v_audit_id
  WHERE "id" = v_reservation."id";
  v_outbox_id := fgis_commodity.append_outbox(
    'fgis.commodity.reservation.created',
    jsonb_build_object(
      'reservationId', v_reservation."id",
      'partyCurrentId', v_reservation."partyCurrentId",
      'volume', v_reservation."volume"::text,
      'unit', v_reservation."unit",
      'status', v_reservation."status"
    ),
    'fgis-commodity-reservation:' || current_setting('app.current_tenant_id', true)
      || ':' || p_idempotency_key,
    p_correlation_id, v_audit_id
  );
  v_result := jsonb_build_object(
    'ok', true,
    'reservationId', v_reservation."id",
    'status', v_reservation."status",
    'volume', v_reservation."volume"::text,
    'unit', v_reservation."unit",
    'partyVersion', v_current."version"::text,
    'remainingAvailable', (v_available - p_volume)::text,
    'auditId', v_audit_id,
    'outboxId', v_outbox_id,
    'duplicate', false
  );
  PERFORM fgis_commodity.save_command(
    'RESERVE_VOLUME', p_command_id, p_idempotency_key, v_request_hash,
    'ACCEPTED', 'COMMODITY_RESERVATION', v_reservation."id", v_result,
    v_audit_id, v_outbox_id
  );
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION fgis_commodity.transition_reservation(
  p_reservation_id text,
  p_target_status text,
  p_reason text,
  p_deal_id text,
  p_expected_version bigint,
  p_command_id text,
  p_idempotency_key text,
  p_correlation_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
DECLARE
  v_request_hash text;
  v_replay jsonb;
  v_reservation public."commodity_reservations"%ROWTYPE;
  v_before jsonb;
  v_audit_id text;
  v_outbox_id text;
  v_result jsonb;
  v_now timestamptz := clock_timestamp();
BEGIN
  PERFORM fgis_commodity.assert_actor(ARRAY['FARMER', 'ADMIN']);
  v_request_hash := encode(digest(convert_to(concat_ws('|',
    p_reservation_id, p_target_status, p_reason, COALESCE(p_deal_id, ''),
    p_expected_version::text
  ), 'UTF8'), 'sha256'), 'hex');
  v_replay := fgis_commodity.replay_command('TRANSITION_RESERVATION', p_idempotency_key, v_request_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  SELECT * INTO v_reservation
  FROM public."commodity_reservations"
  WHERE "id" = p_reservation_id
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true);
  IF NOT FOUND THEN
    RETURN fgis_commodity.deny_command(
      'TRANSITION_RESERVATION', p_command_id, p_idempotency_key, v_request_hash,
      'COMMODITY_RESERVATION', p_reservation_id,
      'FGIS_RESERVATION_NOT_FOUND', p_correlation_id, '{}'::jsonb
    );
  END IF;

  PERFORM fgis_commodity.lock_key(
    current_setting('app.current_tenant_id', true) || ':reservation:' || v_reservation."partyCurrentId"
  );
  SELECT * INTO v_reservation
  FROM public."commodity_reservations"
  WHERE "id" = p_reservation_id
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
  FOR UPDATE;

  IF v_reservation."version" <> p_expected_version THEN
    RETURN fgis_commodity.deny_command(
      'TRANSITION_RESERVATION', p_command_id, p_idempotency_key, v_request_hash,
      'COMMODITY_RESERVATION', p_reservation_id,
      'FGIS_RESERVATION_STALE_VERSION', p_correlation_id,
      jsonb_build_object(
        'actualVersion', v_reservation."version"::text,
        'expectedVersion', p_expected_version::text
      )
    );
  END IF;
  IF NULLIF(btrim(p_reason), '') IS NULL OR length(p_reason) > 1000
     OR p_target_status NOT IN (
       'ACTIVE', 'CONVERTED_TO_DEAL', 'RELEASED', 'EXPIRED', 'FROZEN', 'CANCELLED'
     )
  THEN
    RETURN fgis_commodity.deny_command(
      'TRANSITION_RESERVATION', p_command_id, p_idempotency_key, v_request_hash,
      'COMMODITY_RESERVATION', p_reservation_id,
      'FGIS_RESERVATION_TRANSITION_INVALID', p_correlation_id, '{}'::jsonb
    );
  END IF;
  IF NOT (
    (v_reservation."status" = 'PENDING' AND p_target_status IN ('ACTIVE', 'CANCELLED', 'EXPIRED', 'FROZEN'))
    OR (v_reservation."status" = 'ACTIVE' AND p_target_status IN ('CONVERTED_TO_DEAL', 'RELEASED', 'EXPIRED', 'FROZEN', 'CANCELLED'))
    OR (v_reservation."status" = 'FROZEN' AND p_target_status IN ('ACTIVE', 'RELEASED', 'CANCELLED'))
  ) THEN
    RETURN fgis_commodity.deny_command(
      'TRANSITION_RESERVATION', p_command_id, p_idempotency_key, v_request_hash,
      'COMMODITY_RESERVATION', p_reservation_id,
      'FGIS_RESERVATION_TRANSITION_INVALID', p_correlation_id,
      jsonb_build_object('from', v_reservation."status", 'to', p_target_status)
    );
  END IF;
  IF p_target_status = 'CONVERTED_TO_DEAL' AND NULLIF(btrim(p_deal_id), '') IS NULL THEN
    RETURN fgis_commodity.deny_command(
      'TRANSITION_RESERVATION', p_command_id, p_idempotency_key, v_request_hash,
      'COMMODITY_RESERVATION', p_reservation_id,
      'FGIS_RESERVATION_DEAL_REQUIRED', p_correlation_id, '{}'::jsonb
    );
  END IF;

  v_before := jsonb_build_object(
    'status', v_reservation."status",
    'version', v_reservation."version"::text,
    'dealId', v_reservation."dealId"
  );
  UPDATE public."commodity_reservations"
  SET "status" = p_target_status,
      "dealId" = CASE WHEN p_target_status = 'CONVERTED_TO_DEAL' THEN p_deal_id ELSE "dealId" END,
      "activatedAt" = CASE WHEN p_target_status = 'ACTIVE' THEN v_now ELSE "activatedAt" END,
      "releasedAt" = CASE WHEN p_target_status IN ('RELEASED', 'EXPIRED', 'CANCELLED') THEN v_now ELSE "releasedAt" END,
      "releaseReason" = CASE WHEN p_target_status IN ('RELEASED', 'EXPIRED', 'CANCELLED') THEN p_reason ELSE "releaseReason" END,
      "version" = "version" + 1
  WHERE "id" = v_reservation."id"
  RETURNING * INTO v_reservation;

  PERFORM fgis_commodity.refresh_party_reservation_status(v_reservation."partyCurrentId");

  v_audit_id := fgis_commodity.append_audit(
    'fgis.commodity.reservation.transitioned', 'COMMODITY_RESERVATION', v_reservation."id",
    v_before,
    jsonb_build_object(
      'status', v_reservation."status",
      'version', v_reservation."version"::text,
      'dealId', v_reservation."dealId",
      'reason', p_reason
    ), 'ACCEPTED', NULL,
    jsonb_build_object('commandId', p_command_id, 'requestFingerprint', v_request_hash),
    p_correlation_id
  );
  v_outbox_id := fgis_commodity.append_outbox(
    'fgis.commodity.reservation.transitioned',
    jsonb_build_object(
      'reservationId', v_reservation."id",
      'partyCurrentId', v_reservation."partyCurrentId",
      'status', v_reservation."status",
      'version', v_reservation."version"::text
    ),
    'fgis-commodity-reservation-transition:'
      || current_setting('app.current_tenant_id', true) || ':' || p_idempotency_key,
    p_correlation_id, v_audit_id
  );
  v_result := jsonb_build_object(
    'ok', true, 'reservationId', v_reservation."id",
    'status', v_reservation."status", 'version', v_reservation."version"::text,
    'auditId', v_audit_id, 'outboxId', v_outbox_id, 'duplicate', false
  );
  PERFORM fgis_commodity.save_command(
    'TRANSITION_RESERVATION', p_command_id, p_idempotency_key, v_request_hash,
    'ACCEPTED', 'COMMODITY_RESERVATION', v_reservation."id", v_result,
    v_audit_id, v_outbox_id
  );
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION fgis_commodity.create_lot_passport(
  p_reservation_id text,
  p_command_id text,
  p_idempotency_key text,
  p_correlation_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
DECLARE
  v_request_hash text;
  v_replay jsonb;
  v_reservation public."commodity_reservations"%ROWTYPE;
  v_current public."fgis_grain_party_current"%ROWTYPE;
  v_snapshot public."fgis_grain_party_snapshots"%ROWTYPE;
  v_passport public."fgis_grain_lot_passports"%ROWTYPE;
  v_audit_id text;
  v_outbox_id text;
  v_result jsonb;
  v_now timestamptz := clock_timestamp();
BEGIN
  PERFORM fgis_commodity.assert_actor(ARRAY['FARMER']);
  v_request_hash := encode(digest(convert_to(p_reservation_id, 'UTF8'), 'sha256'), 'hex');
  v_replay := fgis_commodity.replay_command('CREATE_LOT_PASSPORT', p_idempotency_key, v_request_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  SELECT * INTO v_reservation
  FROM public."commodity_reservations"
  WHERE "id" = p_reservation_id
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
  FOR UPDATE;
  IF NOT FOUND OR v_reservation."status" <> 'ACTIVE' OR v_reservation."expiresAt" <= v_now THEN
    RETURN fgis_commodity.deny_command(
      'CREATE_LOT_PASSPORT', p_command_id, p_idempotency_key, v_request_hash,
      'COMMODITY_RESERVATION', p_reservation_id,
      'FGIS_RESERVATION_NOT_ACTIVE', p_correlation_id, '{}'::jsonb
    );
  END IF;
  IF EXISTS (
    SELECT 1 FROM public."fgis_grain_lot_passports" p
    WHERE p."reservationId" = v_reservation."id"
  ) THEN
    RETURN fgis_commodity.deny_command(
      'CREATE_LOT_PASSPORT', p_command_id, p_idempotency_key, v_request_hash,
      'COMMODITY_RESERVATION', p_reservation_id,
      'FGIS_LOT_PASSPORT_ALREADY_EXISTS', p_correlation_id, '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_current
  FROM public."fgis_grain_party_current"
  WHERE "id" = v_reservation."partyCurrentId"
    AND "tenantId" = v_reservation."tenantId"
    AND "organizationId" = v_reservation."organizationId"
  FOR UPDATE;
  SELECT * INTO v_snapshot
  FROM public."fgis_grain_party_snapshots"
  WHERE "id" = v_reservation."sourceSnapshotId"
    AND "tenantId" = v_reservation."tenantId"
    AND "organizationId" = v_reservation."organizationId";
  IF NOT FOUND OR v_current."currentSnapshotId" <> v_snapshot."id" THEN
    RETURN fgis_commodity.deny_command(
      'CREATE_LOT_PASSPORT', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_PARTY', v_reservation."partyCurrentId",
      'FGIS_PARTY_SOURCE_CHANGED', p_correlation_id, '{}'::jsonb
    );
  END IF;

  INSERT INTO public."fgis_grain_lot_passports" (
    "id", "tenantId", "organizationId", "sourceType", "partyCurrentId",
    "sourceSnapshotId", "reservationId", "product", "harvestYear",
    "storagePlace", "quality", "volume", "unit", "sourceHash",
    "criticalHash", "status", "version", "createdByUserId", "createdAt"
  ) VALUES (
    'fgis-lot-passport-' || gen_random_uuid()::text,
    v_reservation."tenantId", v_reservation."organizationId", 'FGIS_GRAIN',
    v_current."id", v_snapshot."id", v_reservation."id",
    jsonb_build_object(
      'code', v_snapshot."productCode",
      'name', v_snapshot."productName",
      'okpd2', v_snapshot."okpd2Code",
      'tnved', v_snapshot."tnvedCode",
      'target', v_snapshot."targetCode",
      'purpose', v_snapshot."purposeCode"
    ),
    v_snapshot."harvestYear", v_snapshot."storagePlace",
    jsonb_build_object(
      'provider', v_snapshot."qualityValues",
      'manual', '{}'::jsonb,
      'provenance', 'FGIS'
    ),
    v_reservation."volume", v_reservation."unit",
    v_snapshot."payloadHash", v_snapshot."criticalHash",
    'DRAFT', 1, current_setting('app.current_user_id', true), v_now
  ) RETURNING * INTO v_passport;

  v_audit_id := fgis_commodity.append_audit(
    'fgis.commodity.lot_passport.created', 'FGIS_LOT_PASSPORT', v_passport."id",
    NULL,
    jsonb_build_object(
      'status', v_passport."status",
      'reservationId', v_passport."reservationId",
      'partyCurrentId', v_passport."partyCurrentId",
      'sourceSnapshotId', v_passport."sourceSnapshotId",
      'volume', v_passport."volume"::text,
      'unit', v_passport."unit",
      'sourceHash', v_passport."sourceHash",
      'criticalHash', v_passport."criticalHash"
    ), 'ACCEPTED', NULL,
    jsonb_build_object('commandId', p_command_id, 'requestFingerprint', v_request_hash),
    p_correlation_id
  );
  v_outbox_id := fgis_commodity.append_outbox(
    'fgis.commodity.lot_passport.created',
    jsonb_build_object(
      'passportId', v_passport."id",
      'reservationId', v_passport."reservationId",
      'status', v_passport."status",
      'version', v_passport."version"::text
    ),
    'fgis-commodity-passport:' || current_setting('app.current_tenant_id', true)
      || ':' || p_idempotency_key,
    p_correlation_id, v_audit_id
  );
  v_result := jsonb_build_object(
    'ok', true, 'passportId', v_passport."id",
    'status', v_passport."status", 'version', v_passport."version"::text,
    'auditId', v_audit_id, 'outboxId', v_outbox_id, 'duplicate', false
  );
  PERFORM fgis_commodity.save_command(
    'CREATE_LOT_PASSPORT', p_command_id, p_idempotency_key, v_request_hash,
    'ACCEPTED', 'FGIS_LOT_PASSPORT', v_passport."id", v_result,
    v_audit_id, v_outbox_id
  );
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION fgis_commodity.seal_lot_passport(
  p_passport_id text,
  p_expected_version bigint,
  p_command_id text,
  p_idempotency_key text,
  p_correlation_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
DECLARE
  v_request_hash text;
  v_replay jsonb;
  v_passport public."fgis_grain_lot_passports"%ROWTYPE;
  v_audit_id text;
  v_outbox_id text;
  v_result jsonb;
  v_now timestamptz := clock_timestamp();
BEGIN
  PERFORM fgis_commodity.assert_actor(ARRAY['FARMER']);
  v_request_hash := encode(digest(convert_to(concat_ws('|',
    p_passport_id, p_expected_version::text
  ), 'UTF8'), 'sha256'), 'hex');
  v_replay := fgis_commodity.replay_command('SEAL_LOT_PASSPORT', p_idempotency_key, v_request_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  SELECT * INTO v_passport
  FROM public."fgis_grain_lot_passports"
  WHERE "id" = p_passport_id
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN fgis_commodity.deny_command(
      'SEAL_LOT_PASSPORT', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_LOT_PASSPORT', p_passport_id,
      'FGIS_LOT_PASSPORT_NOT_FOUND', p_correlation_id, '{}'::jsonb
    );
  END IF;
  IF v_passport."version" <> p_expected_version OR v_passport."status" <> 'DRAFT' THEN
    RETURN fgis_commodity.deny_command(
      'SEAL_LOT_PASSPORT', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_LOT_PASSPORT', p_passport_id,
      'FGIS_LOT_PASSPORT_NOT_SEALABLE', p_correlation_id,
      jsonb_build_object(
        'status', v_passport."status",
        'actualVersion', v_passport."version"::text,
        'expectedVersion', p_expected_version::text
      )
    );
  END IF;

  UPDATE public."fgis_grain_lot_passports"
  SET "status" = 'SEALED', "version" = "version" + 1, "sealedAt" = v_now
  WHERE "id" = v_passport."id"
  RETURNING * INTO v_passport;

  v_audit_id := fgis_commodity.append_audit(
    'fgis.commodity.lot_passport.sealed', 'FGIS_LOT_PASSPORT', v_passport."id",
    jsonb_build_object('status', 'DRAFT', 'version', p_expected_version::text),
    jsonb_build_object('status', v_passport."status", 'version', v_passport."version"::text),
    'ACCEPTED', NULL,
    jsonb_build_object('commandId', p_command_id, 'requestFingerprint', v_request_hash),
    p_correlation_id
  );
  v_outbox_id := fgis_commodity.append_outbox(
    'fgis.commodity.lot_passport.sealed',
    jsonb_build_object(
      'passportId', v_passport."id", 'status', v_passport."status",
      'version', v_passport."version"::text
    ),
    'fgis-commodity-passport-sealed:'
      || current_setting('app.current_tenant_id', true) || ':' || p_idempotency_key,
    p_correlation_id, v_audit_id
  );
  v_result := jsonb_build_object(
    'ok', true, 'passportId', v_passport."id",
    'status', v_passport."status", 'version', v_passport."version"::text,
    'auditId', v_audit_id, 'outboxId', v_outbox_id, 'duplicate', false
  );
  PERFORM fgis_commodity.save_command(
    'SEAL_LOT_PASSPORT', p_command_id, p_idempotency_key, v_request_hash,
    'ACCEPTED', 'FGIS_LOT_PASSPORT', v_passport."id", v_result,
    v_audit_id, v_outbox_id
  );
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION fgis_commodity.open_reconciliation_case(
  p_party_current_id text,
  p_previous_snapshot_id text,
  p_actual_snapshot_id text,
  p_reservation_id text,
  p_lot_id text,
  p_severity text,
  p_reason_code text,
  p_expected_state jsonb,
  p_actual_state jsonb,
  p_owner_user_id text,
  p_command_id text,
  p_idempotency_key text,
  p_correlation_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, fgis_commodity
AS $function$
DECLARE
  v_request_hash text;
  v_replay jsonb;
  v_current public."fgis_grain_party_current"%ROWTYPE;
  v_actual public."fgis_grain_party_snapshots"%ROWTYPE;
  v_case public."fgis_grain_reconciliation_cases"%ROWTYPE;
  v_difference_hash text;
  v_audit_id text;
  v_outbox_id text;
  v_result jsonb;
  v_now timestamptz := clock_timestamp();
BEGIN
  PERFORM fgis_commodity.assert_actor(ARRAY['ADMIN', 'COMPLIANCE_OFFICER', 'SYSTEM', 'SERVICE']);
  v_request_hash := encode(digest(convert_to(concat_ws('|',
    p_party_current_id, COALESCE(p_previous_snapshot_id, ''),
    p_actual_snapshot_id, COALESCE(p_reservation_id, ''), COALESCE(p_lot_id, ''),
    p_severity, p_reason_code, p_expected_state::text, p_actual_state::text,
    COALESCE(p_owner_user_id, '')
  ), 'UTF8'), 'sha256'), 'hex');
  v_replay := fgis_commodity.replay_command('OPEN_RECONCILIATION_CASE', p_idempotency_key, v_request_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  IF p_severity NOT IN ('INFO', 'WARNING', 'HIGH', 'CRITICAL')
     OR NULLIF(btrim(p_reason_code), '') IS NULL OR length(p_reason_code) > 128
     OR p_expected_state IS NULL OR jsonb_typeof(p_expected_state) <> 'object'
     OR p_actual_state IS NULL OR jsonb_typeof(p_actual_state) <> 'object'
     OR octet_length(p_expected_state::text) > 131072
     OR octet_length(p_actual_state::text) > 131072
  THEN
    RETURN fgis_commodity.deny_command(
      'OPEN_RECONCILIATION_CASE', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_RECONCILIATION_CASE', NULL,
      'FGIS_RECONCILIATION_INPUT_INVALID', p_correlation_id, '{}'::jsonb
    );
  END IF;

  PERFORM fgis_commodity.lock_key(
    current_setting('app.current_tenant_id', true) || ':reconciliation:' || p_party_current_id
  );
  SELECT * INTO v_current
  FROM public."fgis_grain_party_current"
  WHERE "id" = p_party_current_id
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
  FOR UPDATE;
  SELECT * INTO v_actual
  FROM public."fgis_grain_party_snapshots"
  WHERE "id" = p_actual_snapshot_id
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true);
  IF v_current."id" IS NULL OR v_actual."id" IS NULL
     OR v_actual."externalPartyId" <> v_current."externalPartyId"
  THEN
    RETURN fgis_commodity.deny_command(
      'OPEN_RECONCILIATION_CASE', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_PARTY', p_party_current_id,
      'FGIS_RECONCILIATION_SOURCE_INVALID', p_correlation_id, '{}'::jsonb
    );
  END IF;

  v_difference_hash := encode(digest(convert_to(jsonb_build_object(
    'partyCurrentId', p_party_current_id,
    'reasonCode', p_reason_code,
    'expectedState', p_expected_state,
    'actualState', p_actual_state,
    'previousSnapshotId', p_previous_snapshot_id,
    'actualSnapshotId', p_actual_snapshot_id,
    'reservationId', p_reservation_id,
    'lotId', p_lot_id
  )::text, 'UTF8'), 'sha256'), 'hex');

  SELECT * INTO v_case
  FROM public."fgis_grain_reconciliation_cases" c
  WHERE c."tenantId" = v_current."tenantId"
    AND c."organizationId" = v_current."organizationId"
    AND c."partyCurrentId" = v_current."id"
    AND c."reasonCode" = p_reason_code
    AND c."differenceHash" = v_difference_hash
    AND c."status" IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING')
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public."fgis_grain_reconciliation_cases" (
      "id", "tenantId", "organizationId", "partyCurrentId",
      "previousSnapshotId", "actualSnapshotId", "lotId", "reservationId",
      "severity", "status", "reasonCode", "expectedState", "actualState",
      "differenceHash", "ownerUserId", "version", "idempotencyKey",
      "requestFingerprint", "openedAt", "createdAt", "updatedAt"
    ) VALUES (
      'fgis-reconciliation-' || gen_random_uuid()::text,
      v_current."tenantId", v_current."organizationId", v_current."id",
      NULLIF(btrim(p_previous_snapshot_id), ''), v_actual."id",
      NULLIF(btrim(p_lot_id), ''), NULLIF(btrim(p_reservation_id), ''),
      p_severity, 'OPEN', p_reason_code, p_expected_state, p_actual_state,
      v_difference_hash, NULLIF(btrim(p_owner_user_id), ''), 1,
      p_idempotency_key, v_request_hash, v_now, v_now, v_now
    ) RETURNING * INTO v_case;
  END IF;

  IF p_severity = 'CRITICAL' THEN
    UPDATE public."fgis_grain_party_current"
    SET "normalizedStatus" = 'RECONCILIATION_REQUIRED',
        "lastReconciledAt" = v_now,
        "version" = "version" + 1,
        "updatedAt" = v_now
    WHERE "id" = v_current."id";
  ELSE
    UPDATE public."fgis_grain_party_current"
    SET "lastReconciledAt" = v_now,
        "version" = "version" + 1,
        "updatedAt" = v_now
    WHERE "id" = v_current."id";
  END IF;

  v_audit_id := fgis_commodity.append_audit(
    'fgis.commodity.reconciliation.opened', 'FGIS_RECONCILIATION_CASE', v_case."id",
    NULL,
    jsonb_build_object(
      'partyCurrentId', v_case."partyCurrentId",
      'severity', v_case."severity",
      'status', v_case."status",
      'reasonCode', v_case."reasonCode",
      'differenceHash', v_case."differenceHash",
      'actualSnapshotId', v_case."actualSnapshotId",
      'previousSnapshotId', v_case."previousSnapshotId"
    ), 'ACCEPTED', NULL,
    jsonb_build_object('commandId', p_command_id, 'requestFingerprint', v_request_hash),
    p_correlation_id
  );
  v_outbox_id := fgis_commodity.append_outbox(
    'fgis.commodity.reconciliation.opened',
    jsonb_build_object(
      'caseId', v_case."id", 'partyCurrentId', v_case."partyCurrentId",
      'severity', v_case."severity", 'status', v_case."status",
      'reasonCode', v_case."reasonCode"
    ),
    'fgis-commodity-reconciliation:'
      || current_setting('app.current_tenant_id', true) || ':' || p_idempotency_key,
    p_correlation_id, v_audit_id
  );
  v_result := jsonb_build_object(
    'ok', true, 'caseId', v_case."id", 'status', v_case."status",
    'severity', v_case."severity", 'differenceHash', v_case."differenceHash",
    'auditId', v_audit_id, 'outboxId', v_outbox_id, 'duplicate', false
  );
  PERFORM fgis_commodity.save_command(
    'OPEN_RECONCILIATION_CASE', p_command_id, p_idempotency_key, v_request_hash,
    'ACCEPTED', 'FGIS_RECONCILIATION_CASE', v_case."id", v_result,
    v_audit_id, v_outbox_id
  );
  RETURN v_result;
END;
$function$;

-- ── Privileges ────────────────────────────────────────────────────────────────

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA fgis_commodity FROM PUBLIC;

DO $do$
DECLARE
  target_role text;
  table_name text;
BEGIN
  FOREACH target_role IN ARRAY ARRAY['app_deal', 'app_service', 'app_runtime'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA fgis_commodity TO %I', target_role);
      FOREACH table_name IN ARRAY ARRAY[
        'fgis_grain_organization_connections',
        'fgis_grain_sync_runs',
        'fgis_grain_party_snapshots',
        'fgis_grain_party_current',
        'commodity_reservations',
        'fgis_grain_lot_passports',
        'fgis_grain_reconciliation_cases',
        'fgis_grain_commodity_commands'
      ] LOOP
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, target_role);
        EXECUTE format('GRANT SELECT ON TABLE public.%I TO %I', table_name, target_role);
      END LOOP;
      EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA fgis_commodity TO %I', target_role);
    END IF;
  END LOOP;
END
$do$;
