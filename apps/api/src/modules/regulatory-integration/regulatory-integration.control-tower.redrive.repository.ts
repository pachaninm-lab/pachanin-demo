import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../../common/types/request-user';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import {
  RegulatoryIntegrationPermission,
  assertRegulatoryInboxRedriveAuthority,
} from './regulatory-integration.inbox-policy';
import { IntegrationControlTowerRepositoryError } from './regulatory-integration.control-tower.repository';

const REDRIVE_ACTION = 'REGULATORY_INTEGRATION_INBOX_REDRIVE';
const REDRIVE_EVENT_TYPE = 'REGULATORY_INTEGRATION_INBOX_REDRIVEN';
const REDRIVE_OBJECT_TYPE = 'REGULATORY_INTEGRATION_INBOX_ENTRY';

type RedriveEntryRow = Readonly<{
  id: string;
  state: string;
  attempts: number;
  version: bigint;
}>;

type RedriveOutboxRow = Readonly<{
  id: string;
  payload: unknown;
  correlationId: string | null;
}>;

type RedriveAuditRow = Readonly<{
  id: string;
  reason: string | null;
  objectId: string | null;
}>;

type HashRow = Readonly<{ hash: string }>;
type IdRow = Readonly<{ id: string }>;

export type IntegrationControlTowerRedriveCommand = Readonly<{
  entryId: string;
  expectedVersion: string;
  reason: string;
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
}>;

export type IntegrationControlTowerRedriveReceipt = Readonly<{
  kind: 'APPLIED' | 'REPLAY';
  entryId: string;
  outboxEntryId: string;
  auditEventId: string;
  correlationId: string;
}>;

@Injectable()
export class RegulatoryIntegrationControlTowerRedriveRepository {
  constructor(private readonly transactions: RlsTransactionService) {}

  async redrive(
    user: RequestUser,
    command: IntegrationControlTowerRedriveCommand,
  ): Promise<IntegrationControlTowerRedriveReceipt> {
    assertRegulatoryInboxRedriveAuthority(
      user,
      command.reason,
      `${command.commandId}:${command.idempotencyKey}`,
    );
    const reason = command.reason.trim();

    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const commandKey = `${command.commandId}:${command.idempotencyKey}`;
        const canonicalKey = [
          'regulatory-integration',
          'inbox-redrive',
          context.tenantId,
          context.orgId,
          commandKey,
        ].join(':');

        await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
          WITH acquired AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtextextended(${canonicalKey}, 0))
          )
          SELECT true AS "locked" FROM acquired
        `);

        const replayRows = await tx.$queryRaw<RedriveOutboxRow[]>(Prisma.sql`
          SELECT "id", "payload", "correlationId"
          FROM public."outbox_entries"
          WHERE "idempotencyKey" = ${canonicalKey}
          FOR UPDATE
        `);
        const replay = replayRows[0];
        if (replay) {
          const payload = asRecord(replay.payload);
          if (
            payload.inboxEntryId !== command.entryId
            || payload.tenantId !== context.tenantId
            || payload.organizationId !== context.orgId
          ) {
            throw new IntegrationControlTowerRepositoryError(
              'IDEMPOTENCY_PAYLOAD_MISMATCH',
              'Redrive idempotency key is bound to another inbox identity.',
            );
          }
          const audits = await tx.$queryRaw<RedriveAuditRow[]>(Prisma.sql`
            SELECT "id", "reason", "objectId"
            FROM public."audit_events"
            WHERE "runtimeIdempotencyKey" = ${canonicalKey}
              AND "tenantId" = ${context.tenantId}
              AND "orgId" = ${context.orgId}
            ORDER BY "createdAt" DESC, "id" DESC
            LIMIT 1
          `);
          const audit = audits[0];
          if (!audit || audit.objectId !== command.entryId || audit.reason !== reason) {
            throw new IntegrationControlTowerRepositoryError(
              'RECONCILIATION_EVIDENCE_INVALID',
              'Redrive replay is missing matching immutable audit evidence.',
            );
          }
          return {
            kind: 'REPLAY',
            entryId: command.entryId,
            outboxEntryId: replay.id,
            auditEventId: audit.id,
            correlationId: replay.correlationId ?? command.correlationId,
          };
        }

        const currentRows = await tx.$queryRaw<RedriveEntryRow[]>(Prisma.sql`
          SELECT "id", "state", "attempts", "version"
          FROM public."regulatory_integration_inbox_entries"
          WHERE "id" = ${command.entryId}
            AND "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
          FOR UPDATE
        `);
        const current = currentRows[0];
        if (!current) {
          throw new IntegrationControlTowerRepositoryError(
            'ADAPTER_NOT_FOUND',
            'Inbox entry is not accessible.',
          );
        }
        if (current.version.toString() !== command.expectedVersion) {
          throw new IntegrationControlTowerRepositoryError(
            'STALE_VERSION',
            'Inbox entry version changed.',
          );
        }
        if (current.state !== 'QUARANTINED' && current.state !== 'DEAD') {
          throw new IntegrationControlTowerRepositoryError(
            'STALE_VERSION',
            `Inbox entry cannot be redriven from state ${current.state}.`,
          );
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
        const beforeState = {
          state: current.state,
          attempts: current.attempts,
          version: current.version.toString(),
        };
        const afterState = {
          state: 'RETRY',
          attempts: 0,
          nextAttemptAt: 'IMMEDIATE',
          version: (current.version + 1n).toString(),
        };
        const auditHash = createHash('sha256').update(JSON.stringify({
          id: auditEventId,
          action: REDRIVE_ACTION,
          actorUserId: user.id,
          actorRole: user.role,
          objectType: REDRIVE_OBJECT_TYPE,
          objectId: command.entryId,
          outcome: 'SUCCESS',
          prevHash,
        })).digest('hex');
        const auditMetadata = {
          schemaVersion: 'pc-crop.regulatory-integration-redrive-audit.v1',
          permission: RegulatoryIntegrationPermission.INBOX_REDRIVE,
          idempotencyKey: canonicalKey,
          commandId: command.commandId,
          correlationId: command.correlationId,
          outboxEntryId,
          previousState: current.state,
          previousAttempts: current.attempts,
        };

        const insertedAudit = await tx.$queryRaw<IdRow[]>(Prisma.sql`
          INSERT INTO public."audit_events" (
            "id", "action", "actorUserId", "actorRole", "tenantId", "orgId",
            "objectType", "objectId", "beforeState", "afterState", "outcome",
            "reason", "metadata", "correlationId", "runtimeIdempotencyKey",
            "hash", "prevHash"
          ) VALUES (
            ${auditEventId}, ${REDRIVE_ACTION}, ${user.id}, ${user.role},
            ${context.tenantId}, ${context.orgId}, ${REDRIVE_OBJECT_TYPE},
            ${command.entryId}, CAST(${JSON.stringify(beforeState)} AS jsonb),
            CAST(${JSON.stringify(afterState)} AS jsonb), 'SUCCESS', ${reason},
            CAST(${JSON.stringify(auditMetadata)} AS jsonb),
            ${command.correlationId}, ${canonicalKey}, ${auditHash}, ${prevHash || null}
          ) RETURNING "id"
        `);
        if (insertedAudit[0]?.id !== auditEventId) {
          throw new IntegrationControlTowerRepositoryError(
            'RECONCILIATION_EVIDENCE_INVALID',
            'Immutable redrive audit was not persisted.',
          );
        }

        const outboxPayload = {
          schemaVersion: 'pc-crop.regulatory-integration-redrive.v1',
          inboxEntryId: command.entryId,
          tenantId: context.tenantId,
          organizationId: context.orgId,
          previousState: current.state,
          previousAttempts: current.attempts,
          auditEventId,
          correlationId: command.correlationId,
          permission: RegulatoryIntegrationPermission.INBOX_REDRIVE,
        };
        const insertedOutbox = await tx.$queryRaw<IdRow[]>(Prisma.sql`
          INSERT INTO public."outbox_entries" (
            "id", "type", "payload", "status", "triggeredByUserId",
            "idempotencyKey", "maxRetries", "retryCount", "nextRetryAt",
            "correlationId", "auditId"
          ) VALUES (
            ${outboxEntryId}, ${REDRIVE_EVENT_TYPE},
            CAST(${JSON.stringify(outboxPayload)} AS jsonb), 'PENDING',
            ${user.id}, ${canonicalKey}, 5, 0, clock_timestamp(),
            ${command.correlationId}, ${auditEventId}
          ) RETURNING "id"
        `);
        if (insertedOutbox[0]?.id !== outboxEntryId) {
          throw new IntegrationControlTowerRepositoryError(
            'RECONCILIATION_EVIDENCE_INVALID',
            'Canonical redrive outbox event was not persisted.',
          );
        }

        const updated = await tx.$queryRaw<IdRow[]>(Prisma.sql`
          UPDATE public."regulatory_integration_inbox_entries"
          SET "state" = 'RETRY',
              "attempts" = 0,
              "nextAttemptAt" = clock_timestamp(),
              "leaseOwner" = NULL,
              "leaseExpiresAt" = NULL,
              "lastErrorCode" = NULL,
              "lastErrorCategory" = NULL,
              "lastErrorDetailReference" = NULL,
              "outboxEntryId" = ${outboxEntryId},
              "version" = "version" + 1
          WHERE "id" = ${command.entryId}
            AND "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
            AND "state" = ${current.state}
            AND "version" = ${current.version}
          RETURNING "id"
        `);
        if (updated[0]?.id !== command.entryId) {
          throw new IntegrationControlTowerRepositoryError(
            'STALE_VERSION',
            'Redrive lost a concurrent inbox update.',
          );
        }

        return {
          kind: 'APPLIED',
          entryId: command.entryId,
          outboxEntryId,
          auditEventId,
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
