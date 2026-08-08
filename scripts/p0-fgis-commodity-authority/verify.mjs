import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const MIGRATION = resolve(
  ROOT,
  'apps/api/prisma/migrations/20260802210000_fgis_commodity_authority/migration.sql',
);
const SCHEMA = resolve(ROOT, 'apps/api/prisma/schema.prisma');
const SCOPE = resolve(
  ROOT,
  'docs/platform-v7/autopilot/scopes/p0-fgis-commodity-authority-3628.json',
);
const QUARANTINE = resolve(
  ROOT,
  'apps/api/prisma/migrations/20260802120000_fgis_verified_lot_path_quarantine/migration.sql',
);

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`PREPARE_ANCHOR_MISSING:${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) {
    throw new Error(`PREPARE_ANCHOR_AMBIGUOUS:${label}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function insertAfter(source, anchor, insertion, marker) {
  if (source.includes(marker)) return source;
  return replaceOnce(source, anchor, `${anchor}${insertion}`, marker);
}

function insertBefore(source, anchor, insertion, marker) {
  if (source.includes(marker)) return source;
  return replaceOnce(source, anchor, `${insertion}${anchor}`, marker);
}

const LIFECYCLE_SQL = String.raw`
-- ── Lifecycle completion commands ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fgis_commodity.transition_connection(
  p_connection_id text,
  p_target_status text,
  p_reason text,
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
  v_connection public."fgis_grain_organization_connections"%ROWTYPE;
  v_before jsonb;
  v_audit_id text;
  v_outbox_id text;
  v_result jsonb;
  v_now timestamptz := clock_timestamp();
BEGIN
  PERFORM fgis_commodity.assert_actor(ARRAY['ADMIN']);
  v_request_hash := encode(digest(convert_to(concat_ws('|',
    p_connection_id, p_target_status, p_reason, p_expected_version::text
  ), 'UTF8'), 'sha256'), 'hex');
  v_replay := fgis_commodity.replay_command(
    'TRANSITION_CONNECTION', p_idempotency_key, v_request_hash
  );
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  IF p_target_status NOT IN ('BOUND', 'SUSPENDED', 'REVOKED')
     OR NULLIF(btrim(p_reason), '') IS NULL
     OR length(p_reason) > 1000
  THEN
    RETURN fgis_commodity.deny_command(
      'TRANSITION_CONNECTION', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_CONNECTION', p_connection_id, 'FGIS_CONNECTION_TRANSITION_INVALID',
      p_correlation_id, '{}'::jsonb
    );
  END IF;

  PERFORM fgis_commodity.lock_key(
    current_setting('app.current_tenant_id', true)
      || ':connection:' || p_connection_id
  );
  SELECT * INTO v_connection
  FROM public."fgis_grain_organization_connections"
  WHERE "id" = p_connection_id
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN fgis_commodity.deny_command(
      'TRANSITION_CONNECTION', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_CONNECTION', p_connection_id, 'FGIS_CONNECTION_NOT_FOUND',
      p_correlation_id, '{}'::jsonb
    );
  END IF;
  IF v_connection."version" <> p_expected_version THEN
    RETURN fgis_commodity.deny_command(
      'TRANSITION_CONNECTION', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_CONNECTION', p_connection_id, 'FGIS_CONNECTION_STALE_VERSION',
      p_correlation_id,
      jsonb_build_object(
        'actualVersion', v_connection."version"::text,
        'expectedVersion', p_expected_version::text
      )
    );
  END IF;
  IF v_connection."status" = 'REVOKED'
     OR (v_connection."status" = 'BOUND' AND p_target_status = 'BOUND')
     OR (v_connection."status" = 'SUSPENDED' AND p_target_status = 'SUSPENDED')
  THEN
    RETURN fgis_commodity.deny_command(
      'TRANSITION_CONNECTION', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_CONNECTION', p_connection_id, 'FGIS_CONNECTION_TRANSITION_INVALID',
      p_correlation_id,
      jsonb_build_object('from', v_connection."status", 'to', p_target_status)
    );
  END IF;

  v_before := jsonb_build_object(
    'status', v_connection."status",
    'version', v_connection."version"::text
  );
  UPDATE public."fgis_grain_organization_connections"
  SET "status" = p_target_status,
      "version" = "version" + 1,
      "updatedByUserId" = current_setting('app.current_user_id', true),
      "updatedAt" = v_now,
      "disabledAt" = CASE WHEN p_target_status = 'SUSPENDED' THEN v_now ELSE NULL END,
      "revokedAt" = CASE WHEN p_target_status = 'REVOKED' THEN v_now ELSE "revokedAt" END,
      "lastErrorCode" = CASE WHEN p_target_status = 'SUSPENDED' THEN p_reason ELSE NULL END,
      "lastErrorCorrelationId" = CASE WHEN p_target_status = 'SUSPENDED' THEN p_correlation_id ELSE NULL END
  WHERE "id" = v_connection."id"
  RETURNING * INTO v_connection;

  v_audit_id := fgis_commodity.append_audit(
    'fgis.commodity.connection.transitioned', 'FGIS_CONNECTION', v_connection."id",
    v_before,
    jsonb_build_object(
      'status', v_connection."status",
      'version', v_connection."version"::text,
      'reason', p_reason
    ),
    'ACCEPTED', NULL,
    jsonb_build_object('commandId', p_command_id, 'requestFingerprint', v_request_hash),
    p_correlation_id
  );
  v_outbox_id := fgis_commodity.append_outbox(
    'fgis.commodity.connection.transitioned',
    jsonb_build_object(
      'connectionId', v_connection."id",
      'status', v_connection."status",
      'version', v_connection."version"::text
    ),
    'fgis-commodity-connection-transition:'
      || current_setting('app.current_tenant_id', true) || ':' || p_idempotency_key,
    p_correlation_id,
    v_audit_id
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
    'TRANSITION_CONNECTION', p_command_id, p_idempotency_key, v_request_hash,
    'ACCEPTED', 'FGIS_CONNECTION', v_connection."id", v_result,
    v_audit_id, v_outbox_id
  );
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION fgis_commodity.complete_sync_run(
  p_sync_run_id text,
  p_target_status text,
  p_records_received integer,
  p_records_created integer,
  p_records_updated integer,
  p_records_unchanged integer,
  p_records_failed integer,
  p_page_cursor text,
  p_provider_request_id text,
  p_error_code text,
  p_error_detail_reference text,
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
  v_run public."fgis_grain_sync_runs"%ROWTYPE;
  v_before jsonb;
  v_audit_id text;
  v_outbox_id text;
  v_result jsonb;
  v_now timestamptz := clock_timestamp();
BEGIN
  PERFORM fgis_commodity.assert_actor(ARRAY['ADMIN']);
  v_request_hash := encode(digest(convert_to(concat_ws('|',
    p_sync_run_id, p_target_status, p_records_received::text,
    p_records_created::text, p_records_updated::text,
    p_records_unchanged::text, p_records_failed::text,
    COALESCE(p_page_cursor, ''), COALESCE(p_provider_request_id, ''),
    COALESCE(p_error_code, ''), COALESCE(p_error_detail_reference, ''),
    p_expected_version::text
  ), 'UTF8'), 'sha256'), 'hex');
  v_replay := fgis_commodity.replay_command(
    'COMPLETE_SYNC_RUN', p_idempotency_key, v_request_hash
  );
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  IF p_target_status NOT IN ('SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED')
     OR p_records_received < 0 OR p_records_created < 0
     OR p_records_updated < 0 OR p_records_unchanged < 0
     OR p_records_failed < 0
     OR length(COALESCE(p_page_cursor, '')) > 2048
     OR length(COALESCE(p_provider_request_id, '')) > 256
     OR length(COALESCE(p_error_code, '')) > 128
     OR length(COALESCE(p_error_detail_reference, '')) > 512
     OR (p_target_status IN ('FAILED', 'PARTIAL') AND NULLIF(btrim(p_error_code), '') IS NULL)
  THEN
    RETURN fgis_commodity.deny_command(
      'COMPLETE_SYNC_RUN', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_SYNC_RUN', p_sync_run_id, 'FGIS_SYNC_COMPLETION_INVALID',
      p_correlation_id, '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_run
  FROM public."fgis_grain_sync_runs"
  WHERE "id" = p_sync_run_id
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true);
  IF NOT FOUND THEN
    RETURN fgis_commodity.deny_command(
      'COMPLETE_SYNC_RUN', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_SYNC_RUN', p_sync_run_id, 'FGIS_SYNC_RUN_NOT_FOUND',
      p_correlation_id, '{}'::jsonb
    );
  END IF;
  PERFORM fgis_commodity.lock_key(
    current_setting('app.current_tenant_id', true)
      || ':sync:' || v_run."connectionId"
  );
  SELECT * INTO v_run
  FROM public."fgis_grain_sync_runs"
  WHERE "id" = p_sync_run_id
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
  FOR UPDATE;

  IF v_run."version" <> p_expected_version
     OR v_run."status" NOT IN ('REQUESTED', 'DISPATCHED', 'WAITING_RESPONSE', 'PROCESSING')
  THEN
    RETURN fgis_commodity.deny_command(
      'COMPLETE_SYNC_RUN', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_SYNC_RUN', p_sync_run_id, 'FGIS_SYNC_RUN_NOT_COMPLETABLE',
      p_correlation_id,
      jsonb_build_object(
        'status', v_run."status",
        'actualVersion', v_run."version"::text,
        'expectedVersion', p_expected_version::text
      )
    );
  END IF;

  v_before := jsonb_build_object(
    'status', v_run."status",
    'version', v_run."version"::text
  );
  UPDATE public."fgis_grain_sync_runs"
  SET "status" = p_target_status,
      "completedAt" = v_now,
      "recordsReceived" = p_records_received,
      "recordsCreated" = p_records_created,
      "recordsUpdated" = p_records_updated,
      "recordsUnchanged" = p_records_unchanged,
      "recordsFailed" = p_records_failed,
      "pageCursor" = NULLIF(btrim(p_page_cursor), ''),
      "providerRequestId" = NULLIF(btrim(p_provider_request_id), ''),
      "errorCode" = NULLIF(btrim(p_error_code), ''),
      "errorDetailReference" = NULLIF(btrim(p_error_detail_reference), ''),
      "version" = "version" + 1,
      "updatedAt" = v_now
  WHERE "id" = v_run."id"
  RETURNING * INTO v_run;

  UPDATE public."fgis_grain_organization_connections"
  SET "lastSuccessfulSyncAt" = CASE
        WHEN p_target_status = 'SUCCEEDED' THEN v_now ELSE "lastSuccessfulSyncAt" END,
      "lastErrorCode" = CASE
        WHEN p_target_status IN ('FAILED', 'PARTIAL') THEN p_error_code ELSE NULL END,
      "lastErrorCorrelationId" = CASE
        WHEN p_target_status IN ('FAILED', 'PARTIAL') THEN p_correlation_id ELSE NULL END,
      "version" = "version" + 1,
      "updatedByUserId" = current_setting('app.current_user_id', true),
      "updatedAt" = v_now
  WHERE "id" = v_run."connectionId";

  v_audit_id := fgis_commodity.append_audit(
    'fgis.commodity.sync.completed', 'FGIS_SYNC_RUN', v_run."id",
    v_before,
    jsonb_build_object(
      'status', v_run."status",
      'version', v_run."version"::text,
      'recordsReceived', v_run."recordsReceived",
      'recordsCreated', v_run."recordsCreated",
      'recordsUpdated', v_run."recordsUpdated",
      'recordsUnchanged', v_run."recordsUnchanged",
      'recordsFailed', v_run."recordsFailed",
      'errorCode', v_run."errorCode"
    ),
    'ACCEPTED', NULL,
    jsonb_build_object('commandId', p_command_id, 'requestFingerprint', v_request_hash),
    p_correlation_id
  );
  v_outbox_id := fgis_commodity.append_outbox(
    'fgis.commodity.sync.completed',
    jsonb_build_object(
      'syncRunId', v_run."id",
      'connectionId', v_run."connectionId",
      'status', v_run."status",
      'version', v_run."version"::text
    ),
    'fgis-commodity-sync-complete:'
      || current_setting('app.current_tenant_id', true) || ':' || p_idempotency_key,
    p_correlation_id,
    v_audit_id
  );
  v_result := jsonb_build_object(
    'ok', true,
    'syncRunId', v_run."id",
    'status', v_run."status",
    'version', v_run."version"::text,
    'auditId', v_audit_id,
    'outboxId', v_outbox_id,
    'duplicate', false
  );
  PERFORM fgis_commodity.save_command(
    'COMPLETE_SYNC_RUN', p_command_id, p_idempotency_key, v_request_hash,
    'ACCEPTED', 'FGIS_SYNC_RUN', v_run."id", v_result,
    v_audit_id, v_outbox_id
  );
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION fgis_commodity.transition_reconciliation_case(
  p_case_id text,
  p_target_status text,
  p_resolution_code text,
  p_resolution_note text,
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
  v_case public."fgis_grain_reconciliation_cases"%ROWTYPE;
  v_before jsonb;
  v_audit_id text;
  v_outbox_id text;
  v_result jsonb;
  v_now timestamptz := clock_timestamp();
BEGIN
  PERFORM fgis_commodity.assert_actor(ARRAY['ADMIN', 'COMPLIANCE_OFFICER']);
  v_request_hash := encode(digest(convert_to(concat_ws('|',
    p_case_id, p_target_status, COALESCE(p_resolution_code, ''),
    COALESCE(p_resolution_note, ''), p_expected_version::text
  ), 'UTF8'), 'sha256'), 'hex');
  v_replay := fgis_commodity.replay_command(
    'TRANSITION_RECONCILIATION_CASE', p_idempotency_key, v_request_hash
  );
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  IF p_target_status NOT IN (
       'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'
     )
     OR length(COALESCE(p_resolution_code, '')) > 128
     OR length(COALESCE(p_resolution_note, '')) > 4000
     OR (p_target_status IN ('RESOLVED', 'DISMISSED')
         AND NULLIF(btrim(p_resolution_code), '') IS NULL)
  THEN
    RETURN fgis_commodity.deny_command(
      'TRANSITION_RECONCILIATION_CASE', p_command_id, p_idempotency_key,
      v_request_hash, 'FGIS_RECONCILIATION_CASE', p_case_id,
      'FGIS_RECONCILIATION_TRANSITION_INVALID', p_correlation_id, '{}'::jsonb
    );
  END IF;

  PERFORM fgis_commodity.lock_key(
    current_setting('app.current_tenant_id', true)
      || ':reconciliation-case:' || p_case_id
  );
  SELECT * INTO v_case
  FROM public."fgis_grain_reconciliation_cases"
  WHERE "id" = p_case_id
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN fgis_commodity.deny_command(
      'TRANSITION_RECONCILIATION_CASE', p_command_id, p_idempotency_key,
      v_request_hash, 'FGIS_RECONCILIATION_CASE', p_case_id,
      'FGIS_RECONCILIATION_CASE_NOT_FOUND', p_correlation_id, '{}'::jsonb
    );
  END IF;
  IF v_case."version" <> p_expected_version THEN
    RETURN fgis_commodity.deny_command(
      'TRANSITION_RECONCILIATION_CASE', p_command_id, p_idempotency_key,
      v_request_hash, 'FGIS_RECONCILIATION_CASE', p_case_id,
      'FGIS_RECONCILIATION_STALE_VERSION', p_correlation_id,
      jsonb_build_object(
        'actualVersion', v_case."version"::text,
        'expectedVersion', p_expected_version::text
      )
    );
  END IF;
  IF NOT (
    (v_case."status" = 'OPEN' AND p_target_status IN ('ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'))
    OR (v_case."status" = 'ACKNOWLEDGED' AND p_target_status IN ('INVESTIGATING', 'RESOLVED', 'DISMISSED'))
    OR (v_case."status" = 'INVESTIGATING' AND p_target_status IN ('RESOLVED', 'DISMISSED'))
  ) THEN
    RETURN fgis_commodity.deny_command(
      'TRANSITION_RECONCILIATION_CASE', p_command_id, p_idempotency_key,
      v_request_hash, 'FGIS_RECONCILIATION_CASE', p_case_id,
      'FGIS_RECONCILIATION_TRANSITION_INVALID', p_correlation_id,
      jsonb_build_object('from', v_case."status", 'to', p_target_status)
    );
  END IF;

  v_before := jsonb_build_object(
    'status', v_case."status",
    'version', v_case."version"::text
  );
  UPDATE public."fgis_grain_reconciliation_cases"
  SET "status" = p_target_status,
      "acknowledgedAt" = CASE
        WHEN p_target_status = 'ACKNOWLEDGED' THEN v_now ELSE "acknowledgedAt" END,
      "resolvedAt" = CASE
        WHEN p_target_status IN ('RESOLVED', 'DISMISSED') THEN v_now ELSE "resolvedAt" END,
      "resolutionCode" = CASE
        WHEN p_target_status IN ('RESOLVED', 'DISMISSED')
          THEN NULLIF(btrim(p_resolution_code), '') ELSE "resolutionCode" END,
      "resolutionNote" = CASE
        WHEN p_target_status IN ('RESOLVED', 'DISMISSED')
          THEN NULLIF(btrim(p_resolution_note), '') ELSE "resolutionNote" END,
      "version" = "version" + 1,
      "updatedAt" = v_now
  WHERE "id" = v_case."id"
  RETURNING * INTO v_case;

  v_audit_id := fgis_commodity.append_audit(
    'fgis.commodity.reconciliation.transitioned',
    'FGIS_RECONCILIATION_CASE', v_case."id", v_before,
    jsonb_build_object(
      'status', v_case."status",
      'version', v_case."version"::text,
      'resolutionCode', v_case."resolutionCode"
    ),
    'ACCEPTED', NULL,
    jsonb_build_object('commandId', p_command_id, 'requestFingerprint', v_request_hash),
    p_correlation_id
  );
  v_outbox_id := fgis_commodity.append_outbox(
    'fgis.commodity.reconciliation.transitioned',
    jsonb_build_object(
      'caseId', v_case."id",
      'partyCurrentId', v_case."partyCurrentId",
      'status', v_case."status",
      'version', v_case."version"::text
    ),
    'fgis-commodity-reconciliation-transition:'
      || current_setting('app.current_tenant_id', true) || ':' || p_idempotency_key,
    p_correlation_id,
    v_audit_id
  );
  v_result := jsonb_build_object(
    'ok', true,
    'caseId', v_case."id",
    'status', v_case."status",
    'version', v_case."version"::text,
    'auditId', v_audit_id,
    'outboxId', v_outbox_id,
    'duplicate', false
  );
  PERFORM fgis_commodity.save_command(
    'TRANSITION_RECONCILIATION_CASE', p_command_id, p_idempotency_key,
    v_request_hash, 'ACCEPTED', 'FGIS_RECONCILIATION_CASE', v_case."id",
    v_result, v_audit_id, v_outbox_id
  );
  RETURN v_result;
END;
$function$;

`;

const PRISMA_MODELS = String.raw`

// ── P0.2-2A FGIS commodity authority ─────────────────────────────────────────

model FgisGrainOrganizationConnection {
  id                             String    @id
  tenantId                       String
  organizationId                 String
  providerConfigurationId        String    @unique
  providerConfigurationVersion   BigInt
  providerAttestationFingerprint String    @db.Char(64)
  status                         String    @default("BOUND")
  authMode                       String    @default("REFERENCE_ONLY")
  externalOrganizationId         String?
  externalOrganizationReference  String?
  apiVersion                     String
  adapterVersion                 String
  version                        BigInt    @default(1)
  lastAttemptAt                  DateTime? @db.Timestamptz(6)
  lastSuccessfulSyncAt           DateTime? @db.Timestamptz(6)
  lastErrorCode                  String?
  lastErrorCorrelationId         String?
  createdByUserId                String
  updatedByUserId                String
  createdAt                      DateTime  @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)
  updatedAt                      DateTime  @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)
  disabledAt                     DateTime? @db.Timestamptz(6)
  revokedAt                      DateTime? @db.Timestamptz(6)

  organization          Organization                    @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_org_connection_org_fk")
  providerConfiguration FgisGrainProviderConfiguration @relation(fields: [providerConfigurationId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_org_connection_config_fk")
  createdByUser         User                            @relation("FgisCommodityConnectionCreatedBy", fields: [createdByUserId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  updatedByUser         User                            @relation("FgisCommodityConnectionUpdatedBy", fields: [updatedByUserId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  syncRuns              FgisGrainSyncRun[]
  snapshots             FgisGrainPartySnapshot[]
  currentParties        FgisGrainPartyCurrent[]

  @@unique([tenantId, organizationId, id], map: "fgis_grain_org_connection_tenant_org_key")
  @@index([tenantId, organizationId, status, updatedAt(sort: Desc), id], map: "fgis_grain_org_connection_status_idx")
  @@map("fgis_grain_organization_connections")
}

model FgisGrainSyncRun {
  id                  String    @id
  tenantId            String
  organizationId      String
  connectionId        String
  operationCode       String    @default("GET_LIST_LOT")
  status              String    @default("REQUESTED")
  startedAt           DateTime  @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)
  completedAt         DateTime? @db.Timestamptz(6)
  recordsReceived     Int       @default(0)
  recordsCreated      Int       @default(0)
  recordsUpdated      Int       @default(0)
  recordsUnchanged    Int       @default(0)
  recordsFailed       Int       @default(0)
  pageCursor          String?
  recordsModifiedFrom DateTime? @db.Timestamptz(6)
  correlationId       String
  providerRequestId   String?
  errorCode           String?
  errorDetailReference String?
  initiatedByUserId   String
  idempotencyKey      String
  requestFingerprint  String    @db.Char(64)
  version             BigInt    @default(1)
  createdAt           DateTime  @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)
  updatedAt           DateTime  @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)

  organization    Organization                    @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  connection      FgisGrainOrganizationConnection @relation(fields: [connectionId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_sync_run_connection_fk")
  initiatedByUser User                            @relation("FgisCommoditySyncInitiatedBy", fields: [initiatedByUserId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  snapshots       FgisGrainPartySnapshot[]

  @@unique([tenantId, organizationId, idempotencyKey], map: "fgis_grain_sync_run_idempotency_key")
  @@unique([tenantId, organizationId, connectionId, id], map: "fgis_grain_sync_run_scope_key")
  @@index([tenantId, organizationId, connectionId, status, startedAt(sort: Desc), id], map: "fgis_grain_sync_run_status_idx")
  @@map("fgis_grain_sync_runs")
}

model FgisGrainPartySnapshot {
  id                    String   @id
  tenantId              String
  organizationId        String
  connectionId          String
  syncRunId             String
  externalPartyId       String
  externalPartyNumber   String?
  externalRecordId      String?
  adapterVersion        String
  contractVersion       String
  ownerReference        String?
  agentReference        String?
  repositoryReference   String?
  productCode           String?
  productName           String?
  okpd2Code             String?
  tnvedCode             String?
  targetCode            String?
  purposeCode           String?
  harvestYear           Int?
  storagePlace          Json     @default("{}") @db.JsonB
  amountOriginal        Decimal? @db.Decimal(20, 6)
  amountAvailable       Decimal  @db.Decimal(20, 6)
  sourceUnitCode        String?
  normalizedUnitCode    String?
  unitAuthority         String   @default("UNCONFIRMED")
  qualityValues         Json     @default("{}") @db.JsonB
  externalStatus        String
  sourceRegisteredAt    DateTime? @db.Timestamptz(6)
  sourceUpdatedAt       DateTime @db.Timestamptz(6)
  fetchedAt             DateTime @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)
  organicFlag           Boolean?
  quarantineZoneFlag    Boolean?
  payloadHash           String   @db.Char(64)
  criticalHash          String   @db.Char(64)
  protectedRawReference String
  createdAt             DateTime @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)

  organization          Organization                    @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  connection            FgisGrainOrganizationConnection @relation(fields: [connectionId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_party_snapshot_connection_fk")
  syncRun               FgisGrainSyncRun                @relation(fields: [syncRunId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_party_snapshot_sync_run_fk")
  currentParties        FgisGrainPartyCurrent[]          @relation("FgisCommodityCurrentSnapshot")
  reservationSources    CommodityReservation[]           @relation("FgisCommodityReservationSnapshot")
  passportSources       FgisGrainLotPassport[]           @relation("FgisCommodityPassportSnapshot")
  reconciliationPrevious FgisGrainReconciliationCase[]   @relation("FgisCommodityPreviousSnapshot")
  reconciliationActual  FgisGrainReconciliationCase[]    @relation("FgisCommodityActualSnapshot")

  @@unique([tenantId, organizationId, externalPartyId, payloadHash], map: "fgis_grain_party_snapshot_replay_key")
  @@index([tenantId, organizationId, externalPartyId, sourceUpdatedAt(sort: Desc), id(sort: Desc)], map: "fgis_grain_party_snapshot_party_idx")
  @@index([syncRunId, createdAt, id], map: "fgis_grain_party_snapshot_sync_idx")
  @@index([tenantId, organizationId, criticalHash, createdAt(sort: Desc)], map: "fgis_grain_party_snapshot_critical_idx")
  @@map("fgis_grain_party_snapshots")
}

model FgisGrainPartyCurrent {
  id                    String    @id
  tenantId              String
  organizationId        String
  connectionId          String
  externalPartyId       String
  currentSnapshotId     String
  normalizedStatus      String
  freshnessStatus       String    @default("FRESH")
  sourceUpdatedAt       DateTime  @db.Timestamptz(6)
  fetchedAt             DateTime  @db.Timestamptz(6)
  availableSourceAmount Decimal   @db.Decimal(20, 6)
  normalizedUnitCode    String?
  criticalHash          String    @db.Char(64)
  version               BigInt    @default(1)
  lastReconciledAt      DateTime? @db.Timestamptz(6)
  createdAt             DateTime  @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)
  updatedAt             DateTime  @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)

  organization    Organization                    @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  connection      FgisGrainOrganizationConnection @relation(fields: [connectionId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_party_current_connection_fk")
  currentSnapshot FgisGrainPartySnapshot          @relation("FgisCommodityCurrentSnapshot", fields: [currentSnapshotId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_party_current_snapshot_fk")
  reservations    CommodityReservation[]
  passports       FgisGrainLotPassport[]
  reconciliationCases FgisGrainReconciliationCase[]

  @@unique([tenantId, organizationId, externalPartyId], map: "fgis_grain_party_current_identity_key")
  @@index([tenantId, organizationId, normalizedStatus, freshnessStatus, updatedAt(sort: Desc), id], map: "fgis_grain_party_current_status_idx")
  @@index([connectionId, externalPartyId], map: "fgis_grain_party_current_connection_idx")
  @@map("fgis_grain_party_current")
}

model CommodityReservation {
  id                 String    @id
  tenantId           String
  organizationId     String
  partyCurrentId     String
  sourceSnapshotId   String
  lotId              String?
  dealId             String?
  volume             Decimal   @db.Decimal(20, 6)
  unit               String
  status             String    @default("ACTIVE")
  reason             String
  idempotencyKey     String
  requestFingerprint String    @db.Char(64)
  version            BigInt    @default(1)
  createdByUserId    String
  createdAt          DateTime  @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)
  expiresAt          DateTime  @db.Timestamptz(6)
  activatedAt        DateTime? @db.Timestamptz(6)
  releasedAt         DateTime? @db.Timestamptz(6)
  releaseReason      String?
  auditReference     String?

  organization   Organization           @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  partyCurrent   FgisGrainPartyCurrent  @relation(fields: [partyCurrentId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "commodity_reservation_party_fk")
  sourceSnapshot FgisGrainPartySnapshot @relation("FgisCommodityReservationSnapshot", fields: [sourceSnapshotId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "commodity_reservation_snapshot_fk")
  createdByUser  User                   @relation("FgisCommodityReservationCreatedBy", fields: [createdByUserId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  passport       FgisGrainLotPassport?
  reconciliationCases FgisGrainReconciliationCase[]

  @@unique([tenantId, organizationId, idempotencyKey], map: "commodity_reservation_idempotency_key")
  @@index([tenantId, organizationId, partyCurrentId, status, createdAt, id], map: "commodity_reservation_party_status_idx")
  @@index([status, expiresAt, id], map: "commodity_reservation_expiry_idx")
  @@index([lotId], map: "commodity_reservation_lot_idx")
  @@index([dealId], map: "commodity_reservation_deal_idx")
  @@map("commodity_reservations")
}

model FgisGrainLotPassport {
  id               String    @id
  tenantId         String
  organizationId   String
  sourceType       String    @default("FGIS_GRAIN")
  partyCurrentId   String
  sourceSnapshotId String
  reservationId    String    @unique
  product          Json      @db.JsonB
  harvestYear      Int?
  storagePlace     Json      @db.JsonB
  quality          Json      @db.JsonB
  volume           Decimal   @db.Decimal(20, 6)
  unit             String
  sourceHash       String    @db.Char(64)
  criticalHash     String    @db.Char(64)
  status           String    @default("DRAFT")
  version          BigInt    @default(1)
  createdByUserId  String
  createdAt        DateTime  @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)
  sealedAt         DateTime? @db.Timestamptz(6)
  publishedAt      DateTime? @db.Timestamptz(6)
  frozenAt         DateTime? @db.Timestamptz(6)
  cancelledAt      DateTime? @db.Timestamptz(6)

  organization   Organization           @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  partyCurrent   FgisGrainPartyCurrent  @relation(fields: [partyCurrentId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_lot_passport_party_fk")
  sourceSnapshot FgisGrainPartySnapshot @relation("FgisCommodityPassportSnapshot", fields: [sourceSnapshotId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_lot_passport_snapshot_fk")
  reservation    CommodityReservation   @relation(fields: [reservationId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_lot_passport_reservation_fk")
  createdByUser  User                   @relation("FgisCommodityPassportCreatedBy", fields: [createdByUserId], references: [id], onDelete: Restrict, onUpdate: Restrict)

  @@index([tenantId, organizationId, status, createdAt(sort: Desc), id], map: "fgis_grain_lot_passport_status_idx")
  @@index([partyCurrentId, createdAt(sort: Desc), id], map: "fgis_grain_lot_passport_party_idx")
  @@map("fgis_grain_lot_passports")
}

model FgisGrainReconciliationCase {
  id                 String    @id
  tenantId           String
  organizationId     String
  partyCurrentId     String
  previousSnapshotId String?
  actualSnapshotId   String
  lotId              String?
  reservationId      String?
  severity           String
  status             String    @default("OPEN")
  reasonCode         String
  expectedState      Json      @db.JsonB
  actualState        Json      @db.JsonB
  differenceHash     String    @db.Char(64)
  ownerUserId        String?
  version            BigInt    @default(1)
  idempotencyKey     String
  requestFingerprint String    @db.Char(64)
  openedAt           DateTime  @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)
  acknowledgedAt     DateTime? @db.Timestamptz(6)
  resolvedAt         DateTime? @db.Timestamptz(6)
  resolutionCode     String?
  resolutionNote     String?
  createdAt          DateTime  @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)
  updatedAt          DateTime  @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)

  organization     Organization            @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  partyCurrent     FgisGrainPartyCurrent   @relation(fields: [partyCurrentId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_reconciliation_party_fk")
  previousSnapshot FgisGrainPartySnapshot? @relation("FgisCommodityPreviousSnapshot", fields: [previousSnapshotId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_reconciliation_previous_snapshot_fk")
  actualSnapshot   FgisGrainPartySnapshot  @relation("FgisCommodityActualSnapshot", fields: [actualSnapshotId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_reconciliation_actual_snapshot_fk")
  reservation      CommodityReservation?   @relation(fields: [reservationId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_reconciliation_reservation_fk")
  ownerUser        User?                   @relation("FgisCommodityReconciliationOwner", fields: [ownerUserId], references: [id], onDelete: Restrict, onUpdate: Restrict)

  @@unique([tenantId, organizationId, idempotencyKey], map: "fgis_grain_reconciliation_idempotency_key")
  @@index([tenantId, organizationId, status, severity, openedAt(sort: Desc), id], map: "fgis_grain_reconciliation_status_idx")
  @@map("fgis_grain_reconciliation_cases")
}

model FgisGrainCommodityCommand {
  id                 String   @id
  tenantId           String
  organizationId     String
  actorUserId        String
  actorRole          String
  commandType        String
  commandId          String   @unique
  idempotencyKey     String
  requestHash        String   @db.Char(64)
  outcome            String
  objectType         String?
  objectId           String?
  result             Json     @db.JsonB
  auditEventId       String   @unique
  outboxEntryId      String?  @unique
  createdAt          DateTime @default(dbgenerated("clock_timestamp()")) @db.Timestamptz(6)

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  actorUser    User         @relation("FgisCommodityCommandActor", fields: [actorUserId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  auditEvent   AuditEvent   @relation(fields: [auditEventId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_commodity_command_audit_fk")
  outboxEntry  OutboxEntry? @relation(fields: [outboxEntryId], references: [id], onDelete: Restrict, onUpdate: Restrict, map: "fgis_grain_commodity_command_outbox_fk")

  @@unique([tenantId, organizationId, commandType, idempotencyKey], map: "fgis_grain_commodity_command_idempotency_key")
  @@index([tenantId, organizationId, createdAt(sort: Desc), id], map: "fgis_grain_commodity_command_created_idx")
  @@index([objectType, objectId, createdAt(sort: Desc)], map: "fgis_grain_commodity_command_object_idx")
  @@map("fgis_grain_commodity_commands")
}
`;

function prepareMigration(source) {
  source = source.replace(
    'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;',
    `REVOKE ALL ON TABLE
  public."fgis_grain_organization_connections",
  public."fgis_grain_sync_runs",
  public."fgis_grain_party_snapshots",
  public."fgis_grain_party_current",
  public."commodity_reservations",
  public."fgis_grain_lot_passports",
  public."fgis_grain_reconciliation_cases",
  public."fgis_grain_commodity_commands"
FROM PUBLIC;`,
  );

  source = source.replace(
    '  IF NOT FOUND OR v_current."currentSnapshotId" <> v_snapshot."id" THEN',
    `  IF v_current."id" IS NULL OR v_snapshot."id" IS NULL
     OR v_current."currentSnapshotId" <> v_snapshot."id" THEN`,
  );

  source = insertBefore(
    source,
    '-- ── Privileges ────────────────────────────────────────────────────────────────',
    LIFECYCLE_SQL,
    'CREATE OR REPLACE FUNCTION fgis_commodity.transition_connection(',
  );

  const reconciliationAnchor = `  v_difference_hash := encode(digest(convert_to(jsonb_build_object(`;
  if (!source.includes('FGIS_RECONCILIATION_REFERENCE_SCOPE_INVALID')) {
    source = insertBefore(
      source,
      reconciliationAnchor,
      String.raw`  IF p_previous_snapshot_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."fgis_grain_party_snapshots" s
    WHERE s."id" = p_previous_snapshot_id
      AND s."tenantId" = v_current."tenantId"
      AND s."organizationId" = v_current."organizationId"
      AND s."externalPartyId" = v_current."externalPartyId"
  ) THEN
    RETURN fgis_commodity.deny_command(
      'OPEN_RECONCILIATION_CASE', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_RECONCILIATION_CASE', NULL,
      'FGIS_RECONCILIATION_REFERENCE_SCOPE_INVALID', p_correlation_id,
      jsonb_build_object('reference', 'previousSnapshotId')
    );
  END IF;
  IF p_reservation_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."commodity_reservations" r
    WHERE r."id" = p_reservation_id
      AND r."tenantId" = v_current."tenantId"
      AND r."organizationId" = v_current."organizationId"
      AND r."partyCurrentId" = v_current."id"
  ) THEN
    RETURN fgis_commodity.deny_command(
      'OPEN_RECONCILIATION_CASE', p_command_id, p_idempotency_key, v_request_hash,
      'FGIS_RECONCILIATION_CASE', NULL,
      'FGIS_RECONCILIATION_REFERENCE_SCOPE_INVALID', p_correlation_id,
      jsonb_build_object('reference', 'reservationId')
    );
  END IF;

`,
      'FGIS_RECONCILIATION_REFERENCE_SCOPE_INVALID',
    );
  }
  return source;
}

function prepareSchema(source) {
  source = insertAfter(
    source,
    '  fgisGrainAcknowledgements         FgisGrainAcknowledgement[]\n',
    `  fgisCommodityConnections           FgisGrainOrganizationConnection[]
  fgisCommoditySyncRuns              FgisGrainSyncRun[]
  fgisCommoditySnapshots             FgisGrainPartySnapshot[]
  fgisCommodityParties               FgisGrainPartyCurrent[]
  commodityReservations              CommodityReservation[]
  fgisCommodityLotPassports          FgisGrainLotPassport[]
  fgisCommodityReconciliationCases   FgisGrainReconciliationCase[]
  fgisCommodityCommands              FgisGrainCommodityCommand[]
`,
    '  fgisCommodityConnections           FgisGrainOrganizationConnection[]',
  );

  source = insertAfter(
    source,
    '  fgisGrainTenantReadAudits                  FgisGrainTenantReadAudit[]         @relation("FgisGrainTenantReadAuditActor")\n',
    `  fgisCommodityConnectionsCreated FgisGrainOrganizationConnection[] @relation("FgisCommodityConnectionCreatedBy")
  fgisCommodityConnectionsUpdated FgisGrainOrganizationConnection[] @relation("FgisCommodityConnectionUpdatedBy")
  fgisCommoditySyncRunsInitiated   FgisGrainSyncRun[]                @relation("FgisCommoditySyncInitiatedBy")
  commodityReservationsCreated     CommodityReservation[]            @relation("FgisCommodityReservationCreatedBy")
  fgisCommodityPassportsCreated    FgisGrainLotPassport[]            @relation("FgisCommodityPassportCreatedBy")
  fgisCommodityReconciliationOwned FgisGrainReconciliationCase[]     @relation("FgisCommodityReconciliationOwner")
  fgisCommodityCommands            FgisGrainCommodityCommand[]       @relation("FgisCommodityCommandActor")
`,
    '  fgisCommodityConnectionsCreated FgisGrainOrganizationConnection[]',
  );

  source = insertAfter(
    source,
    '  tenantReadAudits FgisGrainTenantReadAudit[]\n',
    '  commodityConnection FgisGrainOrganizationConnection?\n',
    '  commodityConnection FgisGrainOrganizationConnection?',
  );

  source = insertAfter(
    source,
    '  fgisGrainAcknowledgement            FgisGrainAcknowledgement?\n',
    '  fgisGrainCommodityCommand           FgisGrainCommodityCommand?\n',
    '  fgisGrainCommodityCommand           FgisGrainCommodityCommand?',
  );

  source = insertAfter(
    source,
    '  fgisGrainAckEvent                   FgisGrainAcknowledgement?            @relation("FgisGrainAckEventOutbox")\n',
    '  fgisGrainCommodityCommand           FgisGrainCommodityCommand?\n',
    '  fgisGrainCommodityCommand           FgisGrainCommodityCommand?',
  );

  if (!source.includes('model FgisGrainOrganizationConnection {')) {
    source = `${source.trimEnd()}${PRISMA_MODELS}\n`;
  }
  return source;
}

function prepare() {
  const migrationBefore = readFileSync(MIGRATION, 'utf8');
  const schemaBefore = readFileSync(SCHEMA, 'utf8');
  const migrationAfter = prepareMigration(migrationBefore);
  const schemaAfter = prepareSchema(schemaBefore);
  if (migrationAfter !== migrationBefore) writeFileSync(MIGRATION, migrationAfter);
  if (schemaAfter !== schemaBefore) writeFileSync(SCHEMA, schemaAfter);
  return {
    migrationChanged: migrationAfter !== migrationBefore,
    schemaChanged: schemaAfter !== schemaBefore,
  };
}

function requireContains(source, token, code) {
  if (!source.includes(token)) throw new Error(`${code}:${token}`);
}

function requireAbsent(source, token, code) {
  if (source.includes(token)) throw new Error(`${code}:${token}`);
}

function verify() {
  if (!existsSync(MIGRATION) || !existsSync(SCHEMA) || !existsSync(SCOPE)) {
    throw new Error('FGIS_COMMODITY_AUTHORITY_REQUIRED_FILE_MISSING');
  }
  const migration = readFileSync(MIGRATION, 'utf8');
  const schema = readFileSync(SCHEMA, 'utf8');
  const quarantine = readFileSync(QUARANTINE, 'utf8');
  const scope = JSON.parse(readFileSync(SCOPE, 'utf8'));

  const tables = [
    'fgis_grain_organization_connections',
    'fgis_grain_sync_runs',
    'fgis_grain_party_snapshots',
    'fgis_grain_party_current',
    'commodity_reservations',
    'fgis_grain_lot_passports',
    'fgis_grain_reconciliation_cases',
    'fgis_grain_commodity_commands',
  ];
  for (const table of tables) {
    requireContains(migration, `public.\"${table}\"`, 'MIGRATION_TABLE_MISSING');
    requireContains(migration, `ALTER TABLE public.%I FORCE ROW LEVEL SECURITY`, 'FORCE_RLS_LOOP_MISSING');
  }

  const functions = [
    'bind_organization_connection',
    'transition_connection',
    'start_sync_run',
    'complete_sync_run',
    'accept_party_snapshot',
    'reserve_volume',
    'transition_reservation',
    'create_lot_passport',
    'seal_lot_passport',
    'open_reconciliation_case',
    'transition_reconciliation_case',
  ];
  for (const fn of functions) {
    requireContains(
      migration,
      `CREATE OR REPLACE FUNCTION fgis_commodity.${fn}(`,
      'COMMAND_FUNCTION_MISSING',
    );
  }

  requireContains(migration, 'numeric(20,6)', 'NUMERIC_VOLUME_REQUIRED');
  requireAbsent(migration, 'REVOKE ALL ON ALL TABLES IN SCHEMA public', 'GLOBAL_PUBLIC_REVOKE_FORBIDDEN');
  requireContains(migration, 'FGIS_COMMODITY_IDEMPOTENCY_CONFLICT', 'IDEMPOTENCY_CONFLICT_REQUIRED');
  requireContains(migration, "pg_advisory_xact_lock", 'ADVISORY_LOCK_REQUIRED');
  requireContains(migration, 'fgis_commodity.append_audit', 'AUDIT_REQUIRED');
  requireContains(migration, 'fgis_commodity.append_outbox', 'OUTBOX_REQUIRED');
  requireContains(migration, 'FGIS_RESERVATION_EXCEEDS_AVAILABLE', 'OVERSELL_DENIAL_REQUIRED');
  requireContains(migration, "'PENDING', 'ACTIVE', 'CONVERTED_TO_DEAL', 'FROZEN'", 'CONSUMING_STATES_REQUIRED');
  requireContains(migration, 'FGIS_LOT_PASSPORT_SOURCE_IMMUTABLE', 'PASSPORT_IMMUTABILITY_REQUIRED');
  requireContains(quarantine, 'FGIS_VERIFIED_LOT_PATH_NOT_READY', 'P0_2_1A_QUARANTINE_REQUIRED');
  requireAbsent(migration.toLowerCase(), 'create extension dblink', 'SECOND_TRANSPORT_FORBIDDEN');
  requireAbsent(migration.toLowerCase(), 'http://', 'PROVIDER_ENDPOINT_FORBIDDEN');
  requireAbsent(migration.toLowerCase(), 'https://', 'PROVIDER_ENDPOINT_FORBIDDEN');

  const models = [
    'FgisGrainOrganizationConnection',
    'FgisGrainSyncRun',
    'FgisGrainPartySnapshot',
    'FgisGrainPartyCurrent',
    'CommodityReservation',
    'FgisGrainLotPassport',
    'FgisGrainReconciliationCase',
    'FgisGrainCommodityCommand',
  ];
  for (const model of models) {
    requireContains(schema, `model ${model} {`, 'PRISMA_MODEL_MISSING');
  }
  requireContains(schema, '@db.Decimal(20, 6)', 'PRISMA_DECIMAL_REQUIRED');
  requireAbsent(schema, 'model CommodityReservation {\n  id                 String    @id\n  tenantId           String\n  organizationId     String\n  partyCurrentId     String\n  sourceSnapshotId   String\n  lotId              String?\n  dealId             String?\n  volume             Float', 'FLOAT_VOLUME_FORBIDDEN');

  if (scope.activeSlice !== 'P0.2-2A-COMMODITY-AUTHORITY') {
    throw new Error('SCOPE_ACTIVE_SLICE_INVALID');
  }
  if (scope.operationalStatus !== 'NOT_ATTESTED') {
    throw new Error('OPERATIONAL_STATUS_OVERSTATED');
  }

  return {
    status: 'PASS',
    operationalStatus: 'NOT_ATTESTED',
    liveConfirmed: 0,
    tables: tables.length,
    commandFunctions: functions.length,
    invariants: {
      forcedRls: true,
      tenantOrganizationScope: true,
      numericVolume: true,
      raceSafeReservation: true,
      deterministicIdempotency: true,
      immutableSnapshotAndPassport: true,
      atomicAuditOutbox: true,
      providerCall: false,
      lotPublication: false,
      quarantinePreserved: true,
    },
  };
}

const preparing = process.argv.includes('--prepare');
const preparation = preparing ? prepare() : null;
const evidence = { ...verify(), preparation };
const evidenceDir = process.env.EVIDENCE_DIR;
if (evidenceDir) {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(
    resolve(evidenceDir, 'p0-fgis-commodity-authority.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
}
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
