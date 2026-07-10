import {
  RuntimePersistenceReceipt,
  RuntimePersistenceRepository,
  RuntimePersistenceStoredRecord,
  RuntimePersistenceWriteError,
  RuntimePersistenceWriteInput,
} from './runtime-persistence.repository';

const RUNTIME_EVENT_TYPE = 'deal_workspace.runtime_snapshot.persisted';

interface RuntimeSnapshotRow extends RuntimePersistenceStoredRecord {}

interface FindUniqueDelegate<T> {
  findUnique(args: Record<string, unknown>): Promise<T | null>;
}

interface CreateDelegate<T> {
  create(args: Record<string, unknown>): Promise<T>;
}

export interface RuntimePersistencePrismaTransaction {
  readonly dealWorkspaceRuntimeSnapshot: FindUniqueDelegate<RuntimeSnapshotRow> & CreateDelegate<RuntimeSnapshotRow>;
  readonly dealWorkspaceRuntimeTransactionAttempt: CreateDelegate<{ id: string }>;
  readonly outboxEntry: CreateDelegate<{ id: string }>;
  readonly auditEvent: CreateDelegate<{ id: string }>;
}

export interface RuntimePersistencePrismaClient {
  $transaction<T>(callback: (transaction: RuntimePersistencePrismaTransaction) => Promise<T>): Promise<T>;
  readonly dealWorkspaceRuntimeSnapshot: FindUniqueDelegate<RuntimeSnapshotRow>;
}

function isMaterialIdentityEqual(existing: RuntimeSnapshotRow, input: RuntimePersistenceWriteInput): boolean {
  return existing.runtimeSnapshotId === input.runtimeSnapshotId
    && existing.dealId === input.dealId
    && existing.intentId === input.intentId
    && existing.contractHash === input.contractHash
    && existing.correlationId === input.correlationId
    && existing.auditId === input.auditId;
}

function toReceipt(
  status: RuntimePersistenceReceipt['status'],
  input: RuntimePersistenceWriteInput,
  record?: RuntimeSnapshotRow,
): RuntimePersistenceReceipt {
  return {
    status,
    state: record?.state ?? 'outbox_required',
    recordId: record?.id,
    runtimeSnapshotId: input.runtimeSnapshotId,
    idempotencyKey: input.idempotencyKey,
    outboxEntryId: record?.outboxEntryId ?? undefined,
    auditEventId: record?.auditEventId ?? undefined,
    ...(status === 'conflict' ? { conflictCode: 'MATERIAL_IDENTITY_MISMATCH' as const } : {}),
  };
}

export class PrismaRuntimePersistenceRepository implements RuntimePersistenceRepository {
  constructor(private readonly prisma: RuntimePersistencePrismaClient) {}

  async write(input: RuntimePersistenceWriteInput): Promise<RuntimePersistenceReceipt> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.dealWorkspaceRuntimeSnapshot.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });

        if (existing) {
          if (!isMaterialIdentityEqual(existing, input)) {
            return toReceipt('conflict', input, existing);
          }
          return toReceipt('duplicate', input, existing);
        }

        const outbox = await transaction.outboxEntry.create({
          data: {
            type: RUNTIME_EVENT_TYPE,
            dealId: input.dealId,
            payload: input.payload,
            status: 'PENDING',
            idempotencyKey: `runtime-outbox:${input.idempotencyKey}`,
            correlationId: input.correlationId,
            auditId: input.auditId,
            runtimeSnapshotId: input.runtimeSnapshotId,
            runtimeIdempotencyKey: input.idempotencyKey,
          },
        });

        const audit = await transaction.auditEvent.create({
          data: {
            id: input.auditId,
            action: RUNTIME_EVENT_TYPE,
            actorUserId: input.actorId,
            actorRole: input.actorRole,
            dealId: input.dealId,
            objectType: 'deal_workspace_runtime_snapshot',
            objectId: input.runtimeSnapshotId,
            afterState: input.payload,
            outcome: 'PERSISTED',
            reason: 'Runtime persistence transaction committed.',
            metadata: {
              correlationId: input.correlationId,
              idempotencyKey: input.idempotencyKey,
              contractHash: input.contractHash,
            },
            correlationId: input.correlationId,
            runtimeSnapshotId: input.runtimeSnapshotId,
            runtimeIdempotencyKey: input.idempotencyKey,
            hash: input.contractHash,
          },
        });

        const snapshot = await transaction.dealWorkspaceRuntimeSnapshot.create({
          data: {
            runtimeSnapshotId: input.runtimeSnapshotId,
            idempotencyKey: input.idempotencyKey,
            dealId: input.dealId,
            intentId: input.intentId,
            state: 'fully_linked',
            snapshotState: input.snapshotState,
            statusLabel: input.statusLabel,
            runtimeStoreRecordId: input.runtimeStoreRecordId,
            runtimeStoreVersion: input.runtimeStoreVersion,
            actorId: input.actorId,
            actorRole: input.actorRole,
            correlationId: input.correlationId,
            auditId: input.auditId,
            contractHash: input.contractHash,
            payload: input.payload,
            outboxEntryId: outbox.id,
            auditEventId: audit.id,
          },
        });

        await transaction.dealWorkspaceRuntimeTransactionAttempt.create({
          data: {
            transactionId: `runtime-tx:${input.idempotencyKey}`,
            snapshotId: snapshot.id,
            idempotencyKey: input.idempotencyKey,
            correlationId: input.correlationId,
            auditId: input.auditId,
            stage: 'committed',
            outcome: 'persisted',
            isReplay: false,
            completedAt: new Date(),
            metadata: {
              outboxEntryId: outbox.id,
              auditEventId: audit.id,
            },
          },
        });

        return toReceipt('persisted', input, snapshot);
      });
    } catch {
      throw new RuntimePersistenceWriteError();
    }
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<RuntimePersistenceStoredRecord | null> {
    try {
      return await this.prisma.dealWorkspaceRuntimeSnapshot.findUnique({
        where: { idempotencyKey },
      });
    } catch {
      throw new RuntimePersistenceWriteError();
    }
  }
}
