import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../../common/types/request-user';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import {
  deriveIntegrationControlTowerPrimaryAction,
  type IntegrationControlTowerPrimaryAction,
  type IntegrationHonestStatus,
} from './regulatory-integration.control-tower.policy';
import type { RegulatoryIntegrationState } from './regulatory-integration.types';

const MAX_AGGREGATES = 1_000;
const RECONCILIATION_EVENT_TYPE = 'REGULATORY_INTEGRATION_RECONCILIATION_REQUESTED';
const RECONCILIATION_AUDIT_ACTION = 'REGULATORY_INTEGRATION_RECONCILIATION_REQUESTED';
const RECONCILIATION_OBJECT_TYPE = 'REGULATORY_INTEGRATION_ADAPTER';

export type IntegrationControlTowerFilters = Readonly<{
  limit?: number;
  cursor?: string;
  adapterCode?: string;
  status?: IntegrationHonestStatus;
  environment?: string;
  state?: RegulatoryIntegrationState;
  provider?: string;
  hasJitAuthority: boolean;
}>;

export type IntegrationReconciliationState =
  | 'NOT_REQUESTED'
  | 'PENDING'
  | 'SENT'
  | 'FAILED'
  | 'DEAD_LETTER';

export type IntegrationControlTowerSummary = Readonly<{
  adapterCode: string;
  adapterVersion: string;
  provider: string;
  capabilities: string[];
  environment: string;
  honestStatus: IntegrationHonestStatus;
  schemaVersion: string;
  mappingVersion: string;
  freshnessAt: string;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  inboxDepth: number;
  oldestEventAt: string | null;
  retryCount: number;
  quarantineCount: number;
  deadCount: number;
  processingCount: number;
  conflictCount: number;
  providerAcknowledgedCount: number;
  businessAcceptedCount: number;
  reconciliationState: IntegrationReconciliationState;
  reconciliationUpdatedAt: string | null;
  credentialReferenceExpiresAt: null;
  credentialMetadataAvailable: false;
  aggregateVersion: string;
  primaryAction: IntegrationControlTowerPrimaryAction;
}>;

export type IntegrationControlTowerPage = Readonly<{
  items: IntegrationControlTowerSummary[];
  nextCursor: string | null;
}>;

export type IntegrationControlTowerEvent = Readonly<{
  id: string;
  provider: string;
  externalEventId: string;
  state: RegulatoryIntegrationState;
  schemaVersion: string;
  mappingVersion: string;
  receivedAt: string;
  occurredAt: string;
  attempts: number;
  nextAttemptAt: string | null;
  providerAcknowledgedAt: string | null;
  businessAcceptedAt: string | null;
  lastErrorCode: string | null;
  lastErrorCategory: string | null;
  correlationId: string;
  version: string;
}>;

export type IntegrationControlTowerDetail = IntegrationControlTowerSummary & Readonly<{
  recentEvents: IntegrationControlTowerEvent[];
}>;

export type IntegrationReconciliationCommand = Readonly<{
  adapterCode: string;
  expectedVersion: string;
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  reason: string;
}>;

export type IntegrationReconciliationReceipt = Readonly<{
  kind: 'APPLIED' | 'REPLAY';
  adapterCode: string;
  aggregateVersion: string;
  auditEventId: string;
  outboxEntryId: string;
  correlationId: string;
}>;

export type IntegrationControlTowerErrorCode =
  | 'QUERY_INVALID'
  | 'CURSOR_INVALID'
  | 'ADAPTER_NOT_FOUND'
  | 'STALE_VERSION'
  | 'IDEMPOTENCY_PAYLOAD_MISMATCH'
  | 'RECONCILIATION_EVIDENCE_INVALID';

export class IntegrationControlTowerRepositoryError extends Error {
  constructor(
    readonly code: IntegrationControlTowerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'IntegrationControlTowerRepositoryError';
  }
}

type AggregateRow = Readonly<{
  adapterCode: string;
  adapterVersion: string;
  provider: string;
  capabilities: unknown;
  environment: string;
  schemaVersion: string;
  mappingVersion: string;
  lastUpdatedAt: Date;
  freshnessAt: Date;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorCode: string | null;
  oldestEventAt: Date | null;
  inboxDepth: bigint;
  retryCount: bigint;
  quarantineCount: bigint;
  deadCount: bigint;
  processingCount: bigint;
  conflictCount: bigint;
  providerAcknowledgedCount: bigint;
  businessAcceptedCount: bigint;
  eligibleRedriveEntryId: string | null;
  aggregateVersion: bigint;
  states: unknown;
  reconciliationStatus: string | null;
  reconciliationUpdatedAt: Date | null;
}>;

type RecentEventRow = Readonly<{
  id: string;
  provider: string;
  externalEventId: string;
  state: RegulatoryIntegrationState;
  schemaVersion: string;
  mappingVersion: string;
  receivedAt: Date;
  occurredAt: Date;
  attempts: number;
  nextAttemptAt: Date | null;
  providerAcknowledgedAt: Date | null;
  businessAcceptedAt: Date | null;
  lastErrorCode: string | null;
  lastErrorCategory: string | null;
  correlationId: string;
  version: bigint;
}>;

type ReconciliationReplayRow = Readonly<{
  id: string;
  payload: unknown;
  correlationId: string | null;
}>;

type AuditReplayRow = Readonly<{
  id: string;
  objectId: string | null;
  reason: string | null;
}>;

type HashRow = Readonly<{ hash: string }>;
type IdRow = Readonly<{ id: string }>;

@Injectable()
export class RegulatoryIntegrationControlTowerRepository {
  constructor(private readonly transactions: RlsTransactionService) {}

  async list(
    user: RequestUser,
    filters: IntegrationControlTowerFilters,
  ): Promise<IntegrationControlTowerPage> {
    const limit = boundedLimit(filters.limit);
    const cursor = decodeCursor(filters.cursor);
    const rows = await this.loadAggregates(user);
    let summaries = rows.map((row) => toSummary(row, user, filters.hasJitAuthority));

    summaries = summaries.filter((item) => {
      if (filters.adapterCode && item.adapterCode !== filters.adapterCode) return false;
      if (filters.status && item.honestStatus !== filters.status) return false;
      if (filters.environment && item.environment !== filters.environment) return false;
      if (filters.provider && item.provider !== filters.provider) return false;
      if (filters.state) {
        const row = rows.find((candidate) => candidate.adapterCode === item.adapterCode);
        if (!row || !stringArray(row.states).includes(filters.state)) return false;
      }
      if (cursor) {
        const timestamp = Date.parse(item.freshnessAt);
        if (timestamp > cursor.timestamp) return false;
        if (timestamp === cursor.timestamp && item.adapterCode <= cursor.adapterCode) return false;
      }
      return true;
    });

    const selected = summaries.slice(0, limit + 1);
    const hasMore = selected.length > limit;
    const items = hasMore ? selected.slice(0, limit) : selected;
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last
        ? encodeCursor(Date.parse(last.freshnessAt), last.adapterCode)
        : null,
    };
  }

  async detail(
    user: RequestUser,
    adapterCode: string,
    input: Readonly<{ eventLimit?: number; state?: RegulatoryIntegrationState; hasJitAuthority: boolean }>,
  ): Promise<IntegrationControlTowerDetail> {
    const page = await this.list(user, {
      limit: 2,
      adapterCode,
      hasJitAuthority: input.hasJitAuthority,
    });
    const summary = page.items[0];
    if (!summary || summary.adapterCode !== adapterCode) {
      throw new IntegrationControlTowerRepositoryError('ADAPTER_NOT_FOUND', 'Integration adapter is not accessible.');
    }
    const eventLimit = boundedLimit(input.eventLimit ?? 25);
    const recentEvents = await this.transactions.withTrustedContext(user, async (tx, context) => {
      const stateFilter = input.state
        ? Prisma.sql`AND "state" = ${input.state}`
        : Prisma.empty;
      return tx.$queryRaw<RecentEventRow[]>(Prisma.sql`
        SELECT "id", "provider", "externalEventId", "state", "schemaVersion",
               "mappingVersion", "receivedAt", "occurredAt", "attempts",
               "nextAttemptAt", "providerAcknowledgedAt", "businessAcceptedAt",
               "lastErrorCode", "lastErrorCategory", "correlationId", "version"
        FROM public."regulatory_integration_inbox_entries"
        WHERE "tenantId" = ${context.tenantId}
          AND "organizationId" = ${context.orgId}
          AND "adapterCode" = ${adapterCode}
          ${stateFilter}
        ORDER BY "receivedAt" DESC, "id" DESC
        LIMIT ${eventLimit}
      `);
    });
    return {
      ...summary,
      recentEvents: recentEvents.map((row) => ({
        id: row.id,
        provider: row.provider,
        externalEventId: row.externalEventId,
        state: row.state,
        schemaVersion: row.schemaVersion,
        mappingVersion: row.mappingVersion,
        receivedAt: row.receivedAt.toISOString(),
        occurredAt: row.occurredAt.toISOString(),
        attempts: row.attempts,
        nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
        providerAcknowledgedAt: row.providerAcknowledgedAt?.toISOString() ?? null,
        businessAcceptedAt: row.businessAcceptedAt?.toISOString() ?? null,
        lastErrorCode: row.lastErrorCode,
        lastErrorCategory: row.lastErrorCategory,
        correlationId: row.correlationId,
        version: row.version.toString(),
      })),
    };
  }

  async requestReconciliation(
    user: RequestUser,
    command: IntegrationReconciliationCommand,
  ): Promise<IntegrationReconciliationReceipt> {
    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const versionRows = await tx.$queryRaw<Array<{ version: bigint }>>(Prisma.sql`
          SELECT COALESCE(max("version"), 0)::bigint AS "version"
          FROM public."regulatory_integration_inbox_entries"
          WHERE "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
            AND "adapterCode" = ${command.adapterCode}
          HAVING count(*) > 0
          FOR UPDATE
        `);
        const currentVersion = versionRows[0]?.version;
        if (currentVersion === undefined) {
          throw new IntegrationControlTowerRepositoryError('ADAPTER_NOT_FOUND', 'Integration adapter is not accessible.');
        }
        if (currentVersion.toString() !== command.expectedVersion) {
          throw new IntegrationControlTowerRepositoryError('STALE_VERSION', 'Integration aggregate version changed.');
        }

        const canonicalKey = `regulatory-reconciliation:${context.tenantId}:${context.orgId}:${command.idempotencyKey}`;
        await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
          WITH acquired AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtextextended(${canonicalKey}, 0))
          )
          SELECT true AS "locked" FROM acquired
        `);
        const replay = await tx.$queryRaw<ReconciliationReplayRow[]>(Prisma.sql`
          SELECT "id", "payload", "correlationId"
          FROM public."outbox_entries"
          WHERE "idempotencyKey" = ${canonicalKey}
          FOR UPDATE
        `);
        if (replay[0]) {
          const payload = asRecord(replay[0].payload);
          if (
            payload.adapterCode !== command.adapterCode
            || payload.tenantId !== context.tenantId
            || payload.organizationId !== context.orgId
            || payload.commandId !== command.commandId
          ) {
            throw new IntegrationControlTowerRepositoryError(
              'IDEMPOTENCY_PAYLOAD_MISMATCH',
              'Reconciliation idempotency key is bound to another command.',
            );
          }
          const audits = await tx.$queryRaw<AuditReplayRow[]>(Prisma.sql`
            SELECT "id", "objectId", "reason"
            FROM public."audit_events"
            WHERE "runtimeIdempotencyKey" = ${canonicalKey}
              AND "tenantId" = ${context.tenantId}
              AND "orgId" = ${context.orgId}
            ORDER BY "createdAt" DESC, "id" DESC
            LIMIT 1
          `);
          const audit = audits[0];
          if (!audit || audit.objectId !== command.adapterCode || audit.reason !== command.reason.trim()) {
            throw new IntegrationControlTowerRepositoryError(
              'RECONCILIATION_EVIDENCE_INVALID',
              'Reconciliation replay is missing matching immutable audit evidence.',
            );
          }
          return {
            kind: 'REPLAY',
            adapterCode: command.adapterCode,
            aggregateVersion: currentVersion.toString(),
            auditEventId: audit.id,
            outboxEntryId: replay[0].id,
            correlationId: replay[0].correlationId ?? command.correlationId,
          };
        }

        const auditEventId = randomUUID();
        const outboxEntryId = randomUUID();
        const previous = await tx.$queryRaw<HashRow[]>(Prisma.sql`
          SELECT "hash" FROM public."audit_events"
          ORDER BY "createdAt" DESC, "id" DESC
          LIMIT 1 FOR UPDATE
        `);
        const prevHash = previous[0]?.hash ?? '';
        const payload = {
          schemaVersion: 'pc-crop.regulatory-integration-reconciliation.v1',
          adapterCode: command.adapterCode,
          tenantId: context.tenantId,
          organizationId: context.orgId,
          commandId: command.commandId,
          requestedVersion: currentVersion.toString(),
          requestedByUserId: user.id,
        };
        const auditHash = createHash('sha256').update(JSON.stringify({
          id: auditEventId,
          action: RECONCILIATION_AUDIT_ACTION,
          actorUserId: user.id,
          adapterCode: command.adapterCode,
          correlationId: command.correlationId,
          prevHash,
        })).digest('hex');

        const audit = await tx.$queryRaw<IdRow[]>(Prisma.sql`
          INSERT INTO public."audit_events" (
            "id", "action", "actorUserId", "actorRole", "tenantId", "orgId",
            "objectType", "objectId", "beforeState", "afterState", "outcome",
            "reason", "metadata", "correlationId", "runtimeIdempotencyKey",
            "hash", "prevHash"
          ) VALUES (
            ${auditEventId}, ${RECONCILIATION_AUDIT_ACTION}, ${user.id}, ${user.role},
            ${context.tenantId}, ${context.orgId}, ${RECONCILIATION_OBJECT_TYPE},
            ${command.adapterCode}, CAST(${JSON.stringify({ aggregateVersion: currentVersion.toString() })} AS jsonb),
            CAST(${JSON.stringify({ reconciliationState: 'PENDING', outboxEntryId })} AS jsonb),
            'SUCCESS', ${command.reason.trim()}, CAST(${JSON.stringify(payload)} AS jsonb),
            ${command.correlationId}, ${canonicalKey}, ${auditHash}, ${prevHash || null}
          ) RETURNING "id"
        `);
        if (audit[0]?.id !== auditEventId) {
          throw new IntegrationControlTowerRepositoryError(
            'RECONCILIATION_EVIDENCE_INVALID',
            'Immutable reconciliation audit was not persisted.',
          );
        }
        const outbox = await tx.$queryRaw<IdRow[]>(Prisma.sql`
          INSERT INTO public."outbox_entries" (
            "id", "type", "payload", "status", "triggeredByUserId",
            "idempotencyKey", "correlationId", "auditId", "nextRetryAt"
          ) VALUES (
            ${outboxEntryId}, ${RECONCILIATION_EVENT_TYPE}, CAST(${JSON.stringify(payload)} AS jsonb),
            'PENDING', ${user.id}, ${canonicalKey}, ${command.correlationId},
            ${auditEventId}, clock_timestamp()
          ) RETURNING "id"
        `);
        if (outbox[0]?.id !== outboxEntryId) {
          throw new IntegrationControlTowerRepositoryError(
            'RECONCILIATION_EVIDENCE_INVALID',
            'Canonical reconciliation outbox event was not persisted.',
          );
        }
        return {
          kind: 'APPLIED',
          adapterCode: command.adapterCode,
          aggregateVersion: currentVersion.toString(),
          auditEventId,
          outboxEntryId,
          correlationId: command.correlationId,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxConflictRetries: 3,
      },
    );
  }

  private async loadAggregates(user: RequestUser): Promise<AggregateRow[]> {
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const rows = await tx.$queryRaw<AggregateRow[]>(Prisma.sql`
        WITH scoped AS (
          SELECT *
          FROM public."regulatory_integration_inbox_entries"
          WHERE "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
        ), grouped AS (
          SELECT
            "adapterCode",
            (array_agg("adapterVersion" ORDER BY "updatedAt" DESC, "id" DESC))[1] AS "adapterVersion",
            (array_agg("provider" ORDER BY "updatedAt" DESC, "id" DESC))[1] AS "provider",
            (array_agg("capabilities" ORDER BY "updatedAt" DESC, "id" DESC))[1] AS "capabilities",
            (array_agg("environment" ORDER BY "updatedAt" DESC, "id" DESC))[1] AS "environment",
            (array_agg("schemaVersion" ORDER BY "updatedAt" DESC, "id" DESC))[1] AS "schemaVersion",
            (array_agg("mappingVersion" ORDER BY "updatedAt" DESC, "id" DESC))[1] AS "mappingVersion",
            max("updatedAt") AS "lastUpdatedAt",
            max("receivedAt") AS "freshnessAt",
            max("receivedAt") FILTER (WHERE "state" = 'PROCESSED') AS "lastSuccessAt",
            max("updatedAt") FILTER (WHERE "lastErrorCode" IS NOT NULL) AS "lastErrorAt",
            (array_agg("lastErrorCode" ORDER BY "updatedAt" DESC, "id" DESC)
              FILTER (WHERE "lastErrorCode" IS NOT NULL))[1] AS "lastErrorCode",
            min("receivedAt") FILTER (WHERE "state" <> 'PROCESSED') AS "oldestEventAt",
            count(*) FILTER (WHERE "state" <> 'PROCESSED')::bigint AS "inboxDepth",
            count(*) FILTER (WHERE "state" = 'RETRY')::bigint AS "retryCount",
            count(*) FILTER (WHERE "state" = 'QUARANTINED')::bigint AS "quarantineCount",
            count(*) FILTER (WHERE "state" = 'DEAD')::bigint AS "deadCount",
            count(*) FILTER (WHERE "state" = 'PROCESSING')::bigint AS "processingCount",
            count(*) FILTER (WHERE "providerAcknowledgedAt" IS NOT NULL)::bigint AS "providerAcknowledgedCount",
            count(*) FILTER (WHERE "businessAcceptedAt" IS NOT NULL)::bigint AS "businessAcceptedCount",
            (array_agg("id" ORDER BY "updatedAt" DESC, "id" DESC)
              FILTER (WHERE "state" IN ('QUARANTINED', 'DEAD')))[1] AS "eligibleRedriveEntryId",
            max("version")::bigint AS "aggregateVersion",
            jsonb_agg(DISTINCT "state") AS "states"
          FROM scoped
          GROUP BY "adapterCode"
        )
        SELECT grouped.*,
          COALESCE(conflicts."conflictCount", 0)::bigint AS "conflictCount",
          reconciliation."status" AS "reconciliationStatus",
          reconciliation."createdAt" AS "reconciliationUpdatedAt"
        FROM grouped
        LEFT JOIN LATERAL (
          SELECT count(*)::bigint AS "conflictCount"
          FROM public."regulatory_integration_inbox_conflicts" c
          WHERE c."tenantId" = ${context.tenantId}
            AND c."organizationId" = ${context.orgId}
            AND EXISTS (
              SELECT 1 FROM scoped s
              WHERE s."adapterCode" = grouped."adapterCode"
                AND s."provider" = c."provider"
                AND s."externalEventId" = c."externalEventId"
            )
        ) conflicts ON true
        LEFT JOIN LATERAL (
          SELECT o."status", o."createdAt"
          FROM public."outbox_entries" o
          WHERE o."type" = ${RECONCILIATION_EVENT_TYPE}
            AND o."payload"->>'tenantId' = ${context.tenantId}
            AND o."payload"->>'organizationId' = ${context.orgId}
            AND o."payload"->>'adapterCode' = grouped."adapterCode"
          ORDER BY o."createdAt" DESC, o."id" DESC
          LIMIT 1
        ) reconciliation ON true
        ORDER BY grouped."freshnessAt" DESC, grouped."adapterCode" ASC
        LIMIT ${MAX_AGGREGATES + 1}
      `);
      if (rows.length > MAX_AGGREGATES) {
        throw new IntegrationControlTowerRepositoryError(
          'QUERY_INVALID',
          'Integration registry exceeds the bounded control-tower window.',
        );
      }
      return rows;
    });
  }
}

function toSummary(
  row: AggregateRow,
  user: RequestUser,
  hasJitAuthority: boolean,
): IntegrationControlTowerSummary {
  const honestStatus = deriveHonestStatus(row);
  return {
    adapterCode: row.adapterCode,
    adapterVersion: row.adapterVersion,
    provider: row.provider,
    capabilities: stringArray(row.capabilities),
    environment: row.environment,
    honestStatus,
    schemaVersion: row.schemaVersion,
    mappingVersion: row.mappingVersion,
    freshnessAt: row.freshnessAt.toISOString(),
    lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
    lastErrorAt: row.lastErrorAt?.toISOString() ?? null,
    lastErrorCode: row.lastErrorCode,
    inboxDepth: safeCount(row.inboxDepth),
    oldestEventAt: row.oldestEventAt?.toISOString() ?? null,
    retryCount: safeCount(row.retryCount),
    quarantineCount: safeCount(row.quarantineCount),
    deadCount: safeCount(row.deadCount),
    processingCount: safeCount(row.processingCount),
    conflictCount: safeCount(row.conflictCount),
    providerAcknowledgedCount: safeCount(row.providerAcknowledgedCount),
    businessAcceptedCount: safeCount(row.businessAcceptedCount),
    reconciliationState: reconciliationState(row.reconciliationStatus),
    reconciliationUpdatedAt: row.reconciliationUpdatedAt?.toISOString() ?? null,
    credentialReferenceExpiresAt: null,
    credentialMetadataAvailable: false,
    aggregateVersion: row.aggregateVersion.toString(),
    primaryAction: deriveIntegrationControlTowerPrimaryAction(user, {
      redriveEntryId: row.eligibleRedriveEntryId,
      hasJitAuthority,
    }),
  };
}

function deriveHonestStatus(row: AggregateRow): IntegrationHonestStatus {
  if (
    row.lastErrorCode !== null
    || row.retryCount > 0n
    || row.quarantineCount > 0n
    || row.deadCount > 0n
    || row.conflictCount > 0n
  ) return 'DEGRADED';
  if (row.environment === 'SANDBOX' || row.environment === 'TEST' || row.environment === 'PREPROD') {
    return 'TEST';
  }
  if (row.environment === 'PRODUCTION') return 'ADAPTER_READY';
  return 'UNAVAILABLE';
}

function reconciliationState(value: string | null): IntegrationReconciliationState {
  if (value === 'SENT' || value === 'CONFIRMED') return 'SENT';
  if (value === 'FAILED') return 'FAILED';
  if (value === 'DEAD_LETTER') return 'DEAD_LETTER';
  if (value === 'PENDING' || value === 'PROCESSING') return 'PENDING';
  return 'NOT_REQUESTED';
}

function boundedLimit(value = 50): number {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new IntegrationControlTowerRepositoryError('QUERY_INVALID', 'limit must be an integer between 1 and 100.');
  }
  return value;
}

function safeCount(value: bigint): number {
  const converted = Number(value);
  if (!Number.isSafeInteger(converted) || converted < 0) {
    throw new IntegrationControlTowerRepositoryError('QUERY_INVALID', 'Aggregate count is outside the safe range.');
  }
  return converted;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0).slice(0, 100);
}

function encodeCursor(timestamp: number, adapterCode: string): string {
  return Buffer.from(JSON.stringify({ timestamp, adapterCode }), 'utf8').toString('base64url');
}

function decodeCursor(value: string | undefined): { timestamp: number; adapterCode: string } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (
      !Number.isSafeInteger(parsed.timestamp)
      || typeof parsed.adapterCode !== 'string'
      || parsed.adapterCode.length < 2
      || parsed.adapterCode.length > 64
    ) throw new Error('invalid');
    return { timestamp: Number(parsed.timestamp), adapterCode: parsed.adapterCode };
  } catch {
    throw new IntegrationControlTowerRepositoryError('CURSOR_INVALID', 'Integration registry cursor is invalid.');
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
