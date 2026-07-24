import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../../common/types/request-user';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import {
  IntegrationControlTowerRepositoryError,
  type IntegrationReconciliationCommand,
  type IntegrationReconciliationReceipt,
} from './regulatory-integration.control-tower.repository';

const EVENT_TYPE = 'REGULATORY_INTEGRATION_RECONCILIATION_REQUESTED';
const AUDIT_ACTION = 'REGULATORY_INTEGRATION_RECONCILIATION_REQUESTED';
const OBJECT_TYPE = 'REGULATORY_INTEGRATION_ADAPTER';

type LockedVersionRow = Readonly<{ id: string; version: bigint }>;
type ReplayRow = Readonly<{ id: string; payload: unknown; correlationId: string | null }>;
type AuditReplayRow = Readonly<{ id: string; objectId: string | null; reason: string | null }>;
type HashRow = Readonly<{ hash: string }>;
type IdRow = Readonly<{ id: string }>;

@Injectable()
export class RegulatoryIntegrationReconciliationRepository {
  constructor(private readonly transactions: RlsTransactionService) {}

  async request(
    user: RequestUser,
    command: IntegrationReconciliationCommand,
  ): Promise<IntegrationReconciliationReceipt> {
    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const lockedRows = await tx.$queryRaw<LockedVersionRow[]>(Prisma.sql`
          SELECT "id", "version"
          FROM public."regulatory_integration_inbox_entries"
          WHERE "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
            AND "adapterCode" = ${command.adapterCode}
          ORDER BY "id"
          FOR UPDATE
        `);
        if (lockedRows.length === 0) {
          throw new IntegrationControlTowerRepositoryError(
            'ADAPTER_NOT_FOUND',
            'Integration adapter is not accessible.',
          );
        }
        const currentVersion = lockedRows.reduce(
          (highest, row) => row.version > highest ? row.version : highest,
          0n,
        );
        if (currentVersion.toString() !== command.expectedVersion) {
          throw new IntegrationControlTowerRepositoryError(
            'STALE_VERSION',
            'Integration aggregate version changed.',
          );
        }

        const canonicalKey = `regulatory-reconciliation:${context.tenantId}:${context.orgId}:${command.idempotencyKey}`;
        await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
          WITH acquired AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtextextended(${canonicalKey}, 0))
          )
          SELECT true AS "locked" FROM acquired
        `);
        const replayRows = await tx.$queryRaw<ReplayRow[]>(Prisma.sql`
          SELECT "id", "payload", "correlationId"
          FROM public."outbox_entries"
          WHERE "idempotencyKey" = ${canonicalKey}
          FOR UPDATE
        `);
        const replay = replayRows[0];
        if (replay) {
          const payload = asRecord(replay.payload);
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
            outboxEntryId: replay.id,
            correlationId: replay.correlationId ?? command.correlationId,
          };
        }

        const auditEventId = randomUUID();
        const outboxEntryId = randomUUID();
        const previous = await tx.$queryRaw<HashRow[]>(Prisma.sql`
          SELECT "hash"
          FROM public."audit_events"
          ORDER BY "createdAt" DESC, "id" DESC
          LIMIT 1
          FOR UPDATE
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
          action: AUDIT_ACTION,
          actorUserId: user.id,
          adapterCode: command.adapterCode,
          correlationId: command.correlationId,
          prevHash,
        })).digest('hex');

        const insertedAudit = await tx.$queryRaw<IdRow[]>(Prisma.sql`
          INSERT INTO public."audit_events" (
            "id", "action", "actorUserId", "actorRole", "tenantId", "orgId",
            "objectType", "objectId", "beforeState", "afterState", "outcome",
            "reason", "metadata", "correlationId", "runtimeIdempotencyKey",
            "hash", "prevHash"
          ) VALUES (
            ${auditEventId}, ${AUDIT_ACTION}, ${user.id}, ${user.role},
            ${context.tenantId}, ${context.orgId}, ${OBJECT_TYPE}, ${command.adapterCode},
            CAST(${JSON.stringify({ aggregateVersion: currentVersion.toString() })} AS jsonb),
            CAST(${JSON.stringify({ reconciliationState: 'PENDING', outboxEntryId })} AS jsonb),
            'SUCCESS', ${command.reason.trim()}, CAST(${JSON.stringify(payload)} AS jsonb),
            ${command.correlationId}, ${canonicalKey}, ${auditHash}, ${prevHash || null}
          ) RETURNING "id"
        `);
        if (insertedAudit[0]?.id !== auditEventId) {
          throw new IntegrationControlTowerRepositoryError(
            'RECONCILIATION_EVIDENCE_INVALID',
            'Immutable reconciliation audit was not persisted.',
          );
        }
        const insertedOutbox = await tx.$queryRaw<IdRow[]>(Prisma.sql`
          INSERT INTO public."outbox_entries" (
            "id", "type", "payload", "status", "triggeredByUserId",
            "idempotencyKey", "correlationId", "auditId", "nextRetryAt"
          ) VALUES (
            ${outboxEntryId}, ${EVENT_TYPE}, CAST(${JSON.stringify(payload)} AS jsonb),
            'PENDING', ${user.id}, ${canonicalKey}, ${command.correlationId},
            ${auditEventId}, clock_timestamp()
          ) RETURNING "id"
        `);
        if (insertedOutbox[0]?.id !== outboxEntryId) {
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
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
