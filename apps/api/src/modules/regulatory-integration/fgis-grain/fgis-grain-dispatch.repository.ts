import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../../../common/types/request-user';
import { RlsTransactionService } from '../../../common/prisma/rls-transaction.service';
import {
  FGIS_GRAIN_DISPATCH_SCHEMA_VERSION,
  FGIS_GRAIN_OPERATIONAL_STATUS,
  FGIS_GRAIN_OUTBOX_EVENT_TYPE,
  FGIS_GRAIN_SIGNING_POLICY_VERSION,
  assertFgisGrainDispatchPayload,
  type FgisGrainOutboundDispatchPayload,
} from './fgis-grain-1.0.23.dispatch.contract';
import type {
  FgisGrainBusinessOperationCode,
  FgisGrainTransportOperation,
} from './fgis-grain-1.0.23.generated';

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,239}$/u;
const SAFE_IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,159}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const OBJECT_REFERENCE =
  /^object-store:\/\/[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,500}$/u;
const CONFIG_REFERENCE =
  /^config:\/\/[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,500}$/u;
const AUDIT_ACTION = FGIS_GRAIN_OUTBOX_EVENT_TYPE;
const AUDIT_OBJECT_TYPE = 'FGIS_GRAIN_OUTBOUND_DISPATCH';
const AUDIT_OBJECT_ID = 'FGIS_ZERNO';

type OutboxReplayRow = Readonly<{
  id: string;
  type: string;
  payload: unknown;
  triggeredByUserId: string | null;
  idempotencyKey: string | null;
  correlationId: string | null;
  auditId: string | null;
}>;

type AuditReplayRow = Readonly<{
  id: string;
  action: string;
  actorUserId: string;
  actorRole: string;
  tenantId: string | null;
  orgId: string | null;
  objectType: string | null;
  objectId: string | null;
  outcome: string;
  reason: string | null;
  metadata: unknown;
  correlationId: string | null;
  runtimeIdempotencyKey: string | null;
}>;

type HashRow = Readonly<{ hash: string }>;
type IdRow = Readonly<{ id: string }>;

export interface EnqueueFgisGrainDispatchCommand {
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly reason: string;
  readonly transportOperation: FgisGrainTransportOperation;
  readonly businessOperationCode: FgisGrainBusinessOperationCode | null;
  readonly messageId: string;
  readonly referenceMessageId: string;
  readonly messageDataId: string;
  readonly unsignedEnvelopeReference: string;
  readonly unsignedEnvelopeSha256: string;
  readonly unsignedEnvelopeSizeBytes: number;
  readonly messageDataSha256: string;
  readonly providerConfigurationReference: string;
  readonly correlationId: string;
  readonly causationId: string | null;
}

export interface FgisGrainDispatchReceipt {
  readonly schemaVersion: 'pc-crop.fgis-grain-dispatch-receipt.v1';
  readonly outboxId: string;
  readonly auditId: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly state: 'PENDING';
  readonly replayed: boolean;
  readonly providerConfirmed: false;
  readonly operationalStatus: typeof FGIS_GRAIN_OPERATIONAL_STATUS;
}

function assertCommandShape(command: EnqueueFgisGrainDispatchCommand): void {
  if (
    !SAFE_ID.test(command.commandId)
    || !SAFE_IDEMPOTENCY_KEY.test(command.idempotencyKey)
    || !SAFE_ID.test(command.correlationId)
    || (command.causationId !== null && !SAFE_ID.test(command.causationId))
  ) {
    throw new UnprocessableEntityException('Invalid dispatch authority identifier');
  }
  const reason = command.reason.trim();
  if (reason.length < 12 || reason.length > 1000) {
    throw new UnprocessableEntityException(
      'Dispatch reason must contain 12..1000 characters',
    );
  }
  if (
    !OBJECT_REFERENCE.test(command.unsignedEnvelopeReference)
    || !CONFIG_REFERENCE.test(command.providerConfigurationReference)
    || !SHA256.test(command.unsignedEnvelopeSha256)
    || !SHA256.test(command.messageDataSha256)
    || !Number.isInteger(command.unsignedEnvelopeSizeBytes)
    || command.unsignedEnvelopeSizeBytes < 1
    || command.unsignedEnvelopeSizeBytes > 2 * 1024 * 1024
  ) {
    throw new UnprocessableEntityException(
      'Dispatch content references or integrity metadata are invalid',
    );
  }
}

function canonicalIdempotencyKey(
  tenantId: string,
  orgId: string,
  command: EnqueueFgisGrainDispatchCommand,
): string {
  const value = [
    'fgis-grain-dispatch',
    tenantId,
    orgId,
    command.idempotencyKey,
  ].join(':');
  if (value.length > 255) {
    throw new UnprocessableEntityException('Canonical idempotency key is too long');
  }
  return value;
}

function buildPayload(
  tenantId: string,
  orgId: string,
  command: EnqueueFgisGrainDispatchCommand,
): FgisGrainOutboundDispatchPayload {
  return assertFgisGrainDispatchPayload({
    schemaVersion: FGIS_GRAIN_DISPATCH_SCHEMA_VERSION,
    adapterCode: 'FGIS_ZERNO',
    apiVersion: '1.0.23',
    mappingVersion: 'fgis-zerno-1.0.23-catalog.v1',
    signingPolicyVersion: FGIS_GRAIN_SIGNING_POLICY_VERSION,
    tenantId,
    organizationId: orgId,
    commandId: command.commandId,
    transportOperation: command.transportOperation,
    businessOperationCode: command.businessOperationCode,
    messageId: command.messageId,
    referenceMessageId: command.referenceMessageId,
    messageDataId: command.messageDataId,
    unsignedEnvelopeReference: command.unsignedEnvelopeReference,
    unsignedEnvelopeSha256: command.unsignedEnvelopeSha256,
    unsignedEnvelopeSizeBytes: command.unsignedEnvelopeSizeBytes,
    messageDataSha256: command.messageDataSha256,
    providerConfigurationReference: command.providerConfigurationReference,
    correlationId: command.correlationId,
    causationId: command.causationId,
  });
}

function samePayload(
  existing: unknown,
  expected: FgisGrainOutboundDispatchPayload,
): boolean {
  try {
    const actual = assertFgisGrainDispatchPayload(existing);
    return actual.schemaVersion === expected.schemaVersion
      && actual.adapterCode === expected.adapterCode
      && actual.apiVersion === expected.apiVersion
      && actual.mappingVersion === expected.mappingVersion
      && actual.signingPolicyVersion === expected.signingPolicyVersion
      && actual.tenantId === expected.tenantId
      && actual.organizationId === expected.organizationId
      && actual.commandId === expected.commandId
      && actual.transportOperation === expected.transportOperation
      && actual.businessOperationCode === expected.businessOperationCode
      && actual.messageId === expected.messageId
      && actual.referenceMessageId === expected.referenceMessageId
      && actual.messageDataId === expected.messageDataId
      && actual.unsignedEnvelopeReference === expected.unsignedEnvelopeReference
      && actual.unsignedEnvelopeSha256 === expected.unsignedEnvelopeSha256
      && actual.unsignedEnvelopeSizeBytes === expected.unsignedEnvelopeSizeBytes
      && actual.messageDataSha256 === expected.messageDataSha256
      && actual.providerConfigurationReference === expected.providerConfigurationReference
      && actual.correlationId === expected.correlationId
      && actual.causationId === expected.causationId;
  } catch {
    return false;
  }
}

function receipt(
  row: Pick<OutboxReplayRow, 'id' | 'auditId' | 'idempotencyKey' | 'correlationId'>,
  replayed: boolean,
): FgisGrainDispatchReceipt {
  if (!row.auditId || !row.idempotencyKey || !row.correlationId) {
    throw new ServiceUnavailableException(
      'Canonical outbox row is missing audit, idempotency or correlation authority',
    );
  }
  return {
    schemaVersion: 'pc-crop.fgis-grain-dispatch-receipt.v1',
    outboxId: row.id,
    auditId: row.auditId,
    idempotencyKey: row.idempotencyKey,
    correlationId: row.correlationId,
    state: 'PENDING',
    replayed,
    providerConfirmed: false,
    operationalStatus: FGIS_GRAIN_OPERATIONAL_STATUS,
  };
}

function sha256Json(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

@Injectable()
export class FgisGrainDispatchRepository {
  constructor(private readonly rls: RlsTransactionService) {}

  async enqueue(
    user: RequestUser,
    command: EnqueueFgisGrainDispatchCommand,
  ): Promise<FgisGrainDispatchReceipt> {
    assertCommandShape(command);
    try {
      return await this.rls.withTrustedContext(
        user,
        async (tx, context) => {
          const payload = buildPayload(context.tenantId, context.orgId, command);
          const key = canonicalIdempotencyKey(
            context.tenantId,
            context.orgId,
            command,
          );
          const reason = command.reason.trim();

          await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
            WITH acquired AS MATERIALIZED (
              SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))
            )
            SELECT true AS "locked" FROM acquired
          `);

          const replayRows = await tx.$queryRaw<OutboxReplayRow[]>(Prisma.sql`
            SELECT "id", "type", "payload", "triggeredByUserId",
                   "idempotencyKey", "correlationId", "auditId"
            FROM public."outbox_entries"
            WHERE "idempotencyKey" = ${key}
            FOR UPDATE
          `);
          const replay = replayRows[0];
          if (replay) {
            const auditRows = await tx.$queryRaw<AuditReplayRow[]>(Prisma.sql`
              SELECT "id", "action", "actorUserId", "actorRole", "tenantId",
                     "orgId", "objectType", "objectId", "outcome", "reason",
                     "metadata", "correlationId", "runtimeIdempotencyKey"
              FROM public."audit_events"
              WHERE "id" = ${replay.auditId ?? ''}
                AND "runtimeIdempotencyKey" = ${key}
                AND "tenantId" = ${context.tenantId}
                AND "orgId" = ${context.orgId}
              FOR UPDATE
            `);
            const audit = auditRows[0];
            const validReplay = replay.type === FGIS_GRAIN_OUTBOX_EVENT_TYPE
              && replay.triggeredByUserId === context.userId
              && replay.idempotencyKey === key
              && replay.correlationId === payload.correlationId
              && samePayload(replay.payload, payload)
              && audit?.id === replay.auditId
              && audit.action === AUDIT_ACTION
              && audit.actorUserId === context.userId
              && audit.actorRole === context.role
              && audit.tenantId === context.tenantId
              && audit.orgId === context.orgId
              && audit.objectType === AUDIT_OBJECT_TYPE
              && audit.objectId === AUDIT_OBJECT_ID
              && audit.outcome === 'SUCCESS'
              && audit.reason === reason
              && audit.correlationId === payload.correlationId
              && audit.runtimeIdempotencyKey === key
              && samePayload(audit.metadata, payload);
            if (!validReplay) {
              throw new ConflictException(
                'Idempotency key is already bound to another dispatch authority',
              );
            }
            return receipt(replay, true);
          }

          const auditId = randomUUID();
          const outboxId = randomUUID();
          const previous = await tx.$queryRaw<HashRow[]>(Prisma.sql`
            SELECT "hash"
            FROM public."audit_events"
            ORDER BY "createdAt" DESC, "id" DESC
            LIMIT 1
            FOR UPDATE
          `);
          const prevHash = previous[0]?.hash ?? '';
          const auditHash = sha256Json({
            id: auditId,
            action: AUDIT_ACTION,
            actorUserId: context.userId,
            actorRole: context.role,
            tenantId: context.tenantId,
            orgId: context.orgId,
            objectType: AUDIT_OBJECT_TYPE,
            objectId: AUDIT_OBJECT_ID,
            reason,
            correlationId: payload.correlationId,
            runtimeIdempotencyKey: key,
            payload,
            prevHash,
          });

          const insertedAudit = await tx.$queryRaw<IdRow[]>(Prisma.sql`
            INSERT INTO public."audit_events" (
              "id", "action", "actorUserId", "actorRole", "tenantId", "orgId",
              "objectType", "objectId", "beforeState", "afterState", "outcome",
              "reason", "metadata", "correlationId", "runtimeIdempotencyKey",
              "hash", "prevHash"
            ) VALUES (
              ${auditId}, ${AUDIT_ACTION}, ${context.userId}, ${context.role},
              ${context.tenantId}, ${context.orgId}, ${AUDIT_OBJECT_TYPE},
              ${AUDIT_OBJECT_ID}, NULL,
              CAST(${JSON.stringify({ state: 'PENDING', outboxId })} AS jsonb),
              'SUCCESS', ${reason}, CAST(${JSON.stringify(payload)} AS jsonb),
              ${payload.correlationId}, ${key}, ${auditHash}, ${prevHash || null}
            )
            RETURNING "id"
          `);
          if (insertedAudit[0]?.id !== auditId) {
            throw new ServiceUnavailableException(
              'Immutable dispatch audit was not persisted',
            );
          }

          const insertedOutbox = await tx.$queryRaw<OutboxReplayRow[]>(Prisma.sql`
            INSERT INTO public."outbox_entries" (
              "id", "type", "payload", "status", "triggeredByUserId",
              "idempotencyKey", "maxRetries", "retryCount", "nextRetryAt",
              "correlationId", "auditId"
            ) VALUES (
              ${outboxId}, ${FGIS_GRAIN_OUTBOX_EVENT_TYPE},
              CAST(${JSON.stringify(payload)} AS jsonb), 'PENDING',
              ${context.userId}, ${key}, 5, 0, clock_timestamp(),
              ${payload.correlationId}, ${auditId}
            )
            RETURNING "id", "type", "payload", "triggeredByUserId",
                      "idempotencyKey", "correlationId", "auditId"
          `);
          const created = insertedOutbox[0];
          if (!created || created.id !== outboxId || created.auditId !== auditId) {
            throw new ServiceUnavailableException(
              'Canonical FGIS Grain outbox row was not persisted',
            );
          }
          return receipt(created, false);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxConflictRetries: 3,
        },
      );
    } catch (error) {
      if (
        error instanceof ConflictException
        || error instanceof UnprocessableEntityException
        || error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      throw new ServiceUnavailableException(
        'Unable to persist canonical FGIS Grain dispatch request',
      );
    }
  }
}
