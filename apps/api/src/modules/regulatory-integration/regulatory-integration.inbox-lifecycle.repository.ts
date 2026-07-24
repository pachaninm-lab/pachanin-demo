import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../../common/types/request-user';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import {
  RegulatoryIntegrationPermission,
  assertRegulatoryInboxRedriveAuthority,
} from './regulatory-integration.inbox-policy';
import type {
  RegulatoryIntegrationState,
  RegulatoryVerificationResult,
} from './regulatory-integration.types';

const REDRIVE_ACTION = 'REGULATORY_INTEGRATION_INBOX_REDRIVE';
const REDRIVE_EVENT_TYPE = 'REGULATORY_INTEGRATION_INBOX_REDRIVEN';
const REDRIVE_OBJECT_TYPE = 'REGULATORY_INTEGRATION_INBOX_ENTRY';

interface VerificationRow {
  readonly id: string;
  readonly state: RegulatoryIntegrationState;
  readonly verificationResult: unknown;
}

interface AcknowledgementRow {
  readonly id: string;
  readonly providerAcknowledgedAt: Date | null;
}

interface RedriveEntryRow {
  readonly id: string;
  readonly state: RegulatoryIntegrationState;
  readonly attempts: number;
  readonly version: bigint;
}

interface RedriveOutboxRow {
  readonly id: string;
  readonly payload: unknown;
  readonly correlationId: string | null;
}

interface RedriveAuditRow {
  readonly id: string;
  readonly reason: string | null;
  readonly objectId: string | null;
}

interface AuditHashRow {
  readonly hash: string;
}

interface IdRow {
  readonly id: string;
}

export type RegulatoryInboxLifecycleMutation = Readonly<{
  kind: 'APPLIED' | 'REPLAY';
  entryId: string;
}>;

export interface RegulatoryInboxRedriveCommand {
  readonly entryId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
}

export type RegulatoryInboxRedriveMutation = Readonly<{
  kind: 'APPLIED' | 'REPLAY';
  entryId: string;
  outboxEntryId: string;
  auditEventId: string;
  correlationId: string;
}>;

export class RegulatoryInboxLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegulatoryInboxLifecycleError';
  }
}

@Injectable()
export class RegulatoryIntegrationInboxLifecycleRepository {
  constructor(private readonly transactions: RlsTransactionService) {}

  async recordVerification(
    user: RequestUser | undefined,
    entryId: string,
    result: RegulatoryVerificationResult,
  ): Promise<RegulatoryInboxLifecycleMutation> {
    assertNonEmpty(entryId, 'entryId');
    if (Number.isNaN(Date.parse(result.verifiedAt))) {
      throw new RegulatoryInboxLifecycleError(
        'verification result must contain a valid verifiedAt timestamp',
      );
    }

    const targetState: RegulatoryIntegrationState = result.verified
      ? 'VERIFIED'
      : 'QUARANTINED';
    const serializedResult = JSON.stringify(result);

    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const applied = await tx.$queryRaw<VerificationRow[]>(Prisma.sql`
          UPDATE public."regulatory_integration_inbox_entries"
          SET "verificationResult" = CAST(${serializedResult} AS jsonb),
              "signatureStatus" = ${signatureStatus(result)},
              "state" = ${targetState},
              "version" = "version" + 1
          WHERE "id" = ${entryId}
            AND "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
            AND "state" = 'RECEIVED'
          RETURNING "id", "state", "verificationResult"
        `);

        if (applied[0] !== undefined) {
          return { kind: 'APPLIED', entryId };
        }

        const current = await tx.$queryRaw<VerificationRow[]>(Prisma.sql`
          SELECT "id", "state", "verificationResult"
          FROM public."regulatory_integration_inbox_entries"
          WHERE "id" = ${entryId}
            AND "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
          FOR UPDATE
        `);
        const row = current[0];
        if (row === undefined) {
          throw new RegulatoryInboxLifecycleError(
            'inbox entry is not accessible in the trusted tenant scope',
          );
        }
        if (
          row.state === targetState
          && stableJson(row.verificationResult) === stableJson(result)
        ) {
          return { kind: 'REPLAY', entryId };
        }

        throw new RegulatoryInboxLifecycleError(
          `verification transition rejected from state ${row.state}`,
        );
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxConflictRetries: 3,
      },
    );
  }

  async markProviderAcknowledged(
    user: RequestUser | undefined,
    entryId: string,
  ): Promise<RegulatoryInboxLifecycleMutation> {
    assertNonEmpty(entryId, 'entryId');

    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const current = await tx.$queryRaw<AcknowledgementRow[]>(Prisma.sql`
          SELECT "id", "providerAcknowledgedAt"
          FROM public."regulatory_integration_inbox_entries"
          WHERE "id" = ${entryId}
            AND "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
          FOR UPDATE
        `);
        const row = current[0];
        if (row === undefined) {
          throw new RegulatoryInboxLifecycleError(
            'inbox entry is not accessible in the trusted tenant scope',
          );
        }
        if (row.providerAcknowledgedAt !== null) {
          return { kind: 'REPLAY', entryId };
        }

        const updated = await tx.$queryRaw<AcknowledgementRow[]>(Prisma.sql`
          UPDATE public."regulatory_integration_inbox_entries"
          SET "providerAcknowledgedAt" = clock_timestamp(),
              "version" = "version" + 1
          WHERE "id" = ${entryId}
            AND "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
            AND "providerAcknowledgedAt" IS NULL
          RETURNING "id", "providerAcknowledgedAt"
        `);
        if (updated[0] === undefined) {
          throw new RegulatoryInboxLifecycleError(
            'provider acknowledgement lost a concurrent update',
          );
        }

        return { kind: 'APPLIED', entryId };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxConflictRetries: 3,
      },
    );
  }

  async redrive(
    user: RequestUser | undefined,
    command: RegulatoryInboxRedriveCommand,
  ): Promise<RegulatoryInboxRedriveMutation> {
    assertNonEmpty(command.entryId, 'entryId');
    assertNonEmpty(command.correlationId, 'correlationId');
    assertRegulatoryInboxRedriveAuthority(
      user,
      command.reason,
      command.idempotencyKey,
    );
    const actor = user as RequestUser;
    const reason = command.reason.trim();

    return this.transactions.withTrustedContext(
      actor,
      async (tx, context) => {
        const canonicalIdempotencyKey = buildRedriveIdempotencyKey(
          context.tenantId,
          context.orgId,
          command.idempotencyKey,
        );

        await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
          WITH acquired AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(
              hashtextextended(${canonicalIdempotencyKey}, 0)
            )
          )
          SELECT true AS "locked"
          FROM acquired
        `);

        const replayOutbox = await tx.$queryRaw<RedriveOutboxRow[]>(Prisma.sql`
          SELECT "id", "payload", "correlationId"
          FROM public."outbox_entries"
          WHERE "idempotencyKey" = ${canonicalIdempotencyKey}
          FOR UPDATE
        `);
        if (replayOutbox[0] !== undefined) {
          const payload = asRecord(replayOutbox[0].payload);
          if (
            payload.inboxEntryId !== command.entryId
            || payload.tenantId !== context.tenantId
            || payload.organizationId !== context.orgId
          ) {
            throw new RegulatoryInboxLifecycleError(
              'redrive idempotency key is already bound to another inbox identity',
            );
          }

          const replayAudit = await tx.$queryRaw<RedriveAuditRow[]>(Prisma.sql`
            SELECT "id", "reason", "objectId"
            FROM public."audit_events"
            WHERE "runtimeIdempotencyKey" = ${canonicalIdempotencyKey}
              AND "tenantId" = ${context.tenantId}
              AND "orgId" = ${context.orgId}
            ORDER BY "createdAt" DESC, "id" DESC
            LIMIT 1
          `);
          const audit = replayAudit[0];
          if (
            audit === undefined
            || audit.objectId !== command.entryId
            || audit.reason !== reason
          ) {
            throw new RegulatoryInboxLifecycleError(
              'redrive replay is missing matching immutable audit evidence',
            );
          }

          return {
            kind: 'REPLAY',
            entryId: command.entryId,
            outboxEntryId: replayOutbox[0].id,
            auditEventId: audit.id,
            correlationId: replayOutbox[0].correlationId ?? command.correlationId,
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
        if (current === undefined) {
          throw new RegulatoryInboxLifecycleError(
            'inbox entry is not accessible in the trusted tenant scope',
          );
        }
        if (current.state !== 'QUARANTINED' && current.state !== 'DEAD') {
          throw new RegulatoryInboxLifecycleError(
            `inbox entry cannot be redriven from state ${current.state}`,
          );
        }

        const auditEventId = randomUUID();
        const outboxEntryId = randomUUID();
        const previousAudit = await tx.$queryRaw<AuditHashRow[]>(Prisma.sql`
          SELECT "hash"
          FROM public."audit_events"
          ORDER BY "createdAt" DESC, "id" DESC
          LIMIT 1
          FOR UPDATE
        `);
        const prevHash = previousAudit[0]?.hash ?? '';
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
        const auditHash = computeAuditHash({
          id: auditEventId,
          actorUserId: actor.id,
          actorRole: actor.role,
          objectId: command.entryId,
          prevHash,
        });
        const auditMetadata = {
          schemaVersion: 'pc-crop.regulatory-integration-redrive-audit.v1',
          permission: RegulatoryIntegrationPermission.INBOX_REDRIVE,
          idempotencyKey: canonicalIdempotencyKey,
          correlationId: command.correlationId,
          outboxEntryId,
          previousState: current.state,
          previousAttempts: current.attempts,
        };

        const auditInserted = await tx.$queryRaw<IdRow[]>(Prisma.sql`
          INSERT INTO public."audit_events" (
            "id", "action", "actorUserId", "actorRole", "tenantId", "orgId",
            "objectType", "objectId", "beforeState", "afterState", "outcome",
            "reason", "metadata", "correlationId", "runtimeIdempotencyKey",
            "hash", "prevHash"
          ) VALUES (
            ${auditEventId}, ${REDRIVE_ACTION}, ${actor.id}, ${actor.role},
            ${context.tenantId}, ${context.orgId}, ${REDRIVE_OBJECT_TYPE},
            ${command.entryId}, CAST(${JSON.stringify(beforeState)} AS jsonb),
            CAST(${JSON.stringify(afterState)} AS jsonb), 'SUCCESS', ${reason},
            CAST(${JSON.stringify(auditMetadata)} AS jsonb),
            ${command.correlationId}, ${canonicalIdempotencyKey}, ${auditHash},
            ${prevHash || null}
          )
          RETURNING "id"
        `);
        if (auditInserted[0]?.id !== auditEventId) {
          throw new RegulatoryInboxLifecycleError(
            'redrive immutable audit evidence was not persisted',
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
        const outboxInserted = await tx.$queryRaw<IdRow[]>(Prisma.sql`
          INSERT INTO public."outbox_entries" (
            "id", "type", "payload", "status", "triggeredByUserId",
            "idempotencyKey", "maxRetries", "retryCount", "nextRetryAt",
            "correlationId", "auditId"
          ) VALUES (
            ${outboxEntryId}, ${REDRIVE_EVENT_TYPE},
            CAST(${JSON.stringify(outboxPayload)} AS jsonb), 'PENDING',
            ${actor.id}, ${canonicalIdempotencyKey}, 5, 0,
            clock_timestamp(), ${command.correlationId}, ${auditEventId}
          )
          RETURNING "id"
        `);
        if (outboxInserted[0]?.id !== outboxEntryId) {
          throw new RegulatoryInboxLifecycleError(
            'redrive canonical outbox event was not persisted',
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
          throw new RegulatoryInboxLifecycleError(
            'redrive lost a concurrent inbox update',
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

function signatureStatus(
  result: RegulatoryVerificationResult,
): 'VERIFIED' | 'INVALID' | 'UNKNOWN_KEY' | 'PENDING' {
  if (result.verified) return 'VERIFIED';
  if (result.errorCode === 'SIGNATURE_INVALID') return 'INVALID';
  if (result.errorCode === 'KEY_REFERENCE_UNKNOWN') return 'UNKNOWN_KEY';
  return 'PENDING';
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new RegulatoryInboxLifecycleError(
      'redrive outbox payload is not an object',
    );
  }
  return value as Record<string, unknown>;
}

function buildRedriveIdempotencyKey(
  tenantId: string,
  organizationId: string,
  commandKey: string,
): string {
  return [
    'regulatory-integration',
    'inbox-redrive',
    tenantId,
    organizationId,
    commandKey.trim(),
  ].join(':');
}

function computeAuditHash(input: Readonly<{
  id: string;
  actorUserId: string;
  actorRole: string;
  objectId: string;
  prevHash: string;
}>): string {
  return createHash('sha256')
    .update(JSON.stringify({
      id: input.id,
      action: REDRIVE_ACTION,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      dealId: null,
      objectType: REDRIVE_OBJECT_TYPE,
      objectId: input.objectId,
      outcome: 'SUCCESS',
      prevHash: input.prevHash,
    }))
    .digest('hex');
}

function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) {
    throw new RegulatoryInboxLifecycleError(`${field} is required`);
  }
}
