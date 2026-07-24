import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestUser } from '../../../common/auth/request-user';
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

function isPrismaUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === 'P2002';
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
  user: RequestUser,
  command: EnqueueFgisGrainDispatchCommand,
): string {
  const value = [
    'fgis-grain-dispatch',
    user.tenantId,
    user.orgId,
    command.idempotencyKey,
  ].join(':');
  if (value.length > 255) {
    throw new UnprocessableEntityException('Canonical idempotency key is too long');
  }
  return value;
}

function buildPayload(
  user: RequestUser,
  command: EnqueueFgisGrainDispatchCommand,
): FgisGrainOutboundDispatchPayload {
  return assertFgisGrainDispatchPayload({
    schemaVersion: FGIS_GRAIN_DISPATCH_SCHEMA_VERSION,
    adapterCode: 'FGIS_ZERNO',
    apiVersion: '1.0.23',
    mappingVersion: 'fgis-zerno-1.0.23-catalog.v1',
    signingPolicyVersion: FGIS_GRAIN_SIGNING_POLICY_VERSION,
    tenantId: user.tenantId,
    organizationId: user.orgId,
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
    const parsed = assertFgisGrainDispatchPayload(existing);
    return JSON.stringify(parsed) === JSON.stringify(expected);
  } catch {
    return false;
  }
}

function receipt(
  row: {
    readonly id: string;
    readonly auditId: string | null;
    readonly idempotencyKey: string;
    readonly correlationId: string | null;
  },
  replayed: boolean,
): FgisGrainDispatchReceipt {
  if (!row.auditId || !row.correlationId) {
    throw new ServiceUnavailableException(
      'Canonical outbox row is missing audit or correlation authority',
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

@Injectable()
export class FgisGrainDispatchRepository {
  constructor(private readonly rls: RlsTransactionService) {}

  async enqueue(
    user: RequestUser,
    command: EnqueueFgisGrainDispatchCommand,
  ): Promise<FgisGrainDispatchReceipt> {
    assertCommandShape(command);
    const payload = buildPayload(user, command);
    const key = canonicalIdempotencyKey(user, command);
    try {
      return await this.rls.transaction(user, async (tx) => {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${key}))
        `;
        const existing = await tx.outboxEntry.findUnique({
          where: { idempotencyKey: key },
          select: {
            id: true,
            type: true,
            payload: true,
            triggeredByUserId: true,
            idempotencyKey: true,
            correlationId: true,
            auditId: true,
          },
        });
        if (existing) {
          if (
            existing.type !== FGIS_GRAIN_OUTBOX_EVENT_TYPE
            || existing.triggeredByUserId !== user.id
            || existing.correlationId !== payload.correlationId
            || !samePayload(existing.payload, payload)
          ) {
            throw new ConflictException(
              'Idempotency key is already bound to another dispatch authority',
            );
          }
          return receipt(existing, true);
        }

        const auditId = randomUUID();
        const outboxId = randomUUID();
        await tx.auditEvent.create({
          data: {
            id: auditId,
            tenantId: user.tenantId,
            organizationId: user.orgId,
            userId: user.id,
            action: FGIS_GRAIN_OUTBOX_EVENT_TYPE,
            objectType: 'REGULATORY_ADAPTER',
            objectId: 'FGIS_ZERNO',
            reason: command.reason.trim(),
            metadata: payload as unknown as Prisma.InputJsonValue,
          },
        });
        const created = await tx.outboxEntry.create({
          data: {
            id: outboxId,
            type: FGIS_GRAIN_OUTBOX_EVENT_TYPE,
            payload: payload as unknown as Prisma.InputJsonValue,
            status: 'PENDING',
            triggeredByUserId: user.id,
            idempotencyKey: key,
            maxRetries: 5,
            retryCount: 0,
            nextRetryAt: new Date(),
            correlationId: payload.correlationId,
            auditId,
          },
          select: {
            id: true,
            auditId: true,
            idempotencyKey: true,
            correlationId: true,
          },
        });
        return receipt(created, false);
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (isPrismaUniqueViolation(error)) {
        throw new ConflictException(
          'Concurrent dispatch reused the same idempotency key',
        );
      }
      if (error instanceof UnprocessableEntityException) throw error;
      throw new ServiceUnavailableException(
        'Unable to persist canonical FGIS Grain dispatch request',
      );
    }
  }
}
