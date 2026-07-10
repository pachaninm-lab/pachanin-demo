import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  RuntimePersistenceDbState,
  RuntimePersistenceRepository,
  RuntimePersistenceWriteInput,
  RuntimePersistenceWriteReceipt,
} from './runtime-persistence.repository';

type ExistingRuntimeSnapshot = {
  id: string;
  runtimeSnapshotId: string;
  idempotencyKey: string;
  contractHash: string;
  state: string;
  outboxEntryId: string | null;
  auditEventId: string | null;
  attempts?: Array<{ id: string }>;
};

const requiredStringFields: Array<keyof RuntimePersistenceWriteInput> = [
  'runtimeSnapshotId',
  'idempotencyKey',
  'transactionId',
  'dealId',
  'intentId',
  'statusLabel',
  'runtimeStoreRecordId',
  'runtimeStoreVersion',
  'actorId',
  'actorRole',
  'correlationId',
  'auditId',
  'contractHash',
];

function isKnownUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002',
  );
}

function isValidInput(input: RuntimePersistenceWriteInput): boolean {
  return requiredStringFields.every((field) => {
    const value = input[field];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

@Injectable()
export class PrismaRuntimePersistenceRepository implements RuntimePersistenceRepository {
  constructor(@Optional() private readonly prisma?: PrismaService) {
    if (!this.prisma) {
      throw new Error(
        'PrismaRuntimePersistenceRepository requires PrismaService; the Postgres runtime-persistence path is not active.',
      );
    }
  }

  private get db(): PrismaService {
    if (!this.prisma) {
      throw new Error('PrismaService unavailable; Postgres runtime-persistence path is not active.');
    }
    return this.prisma;
  }

  private classifyExisting(
    input: RuntimePersistenceWriteInput,
    existing: ExistingRuntimeSnapshot,
  ): RuntimePersistenceWriteReceipt {
    const sameMaterialIdentity =
      existing.runtimeSnapshotId === input.runtimeSnapshotId &&
      existing.contractHash === input.contractHash;

    if (!sameMaterialIdentity) {
      return {
        status: 'conflict',
        runtimeSnapshotId: input.runtimeSnapshotId,
        idempotencyKey: input.idempotencyKey,
        state: existing.state as RuntimePersistenceDbState,
        recordId: existing.id,
        outboxEntryId: existing.outboxEntryId ?? undefined,
        auditEventId: existing.auditEventId ?? undefined,
        transactionAttemptId: existing.attempts?.[0]?.id,
        reasonCode: 'material_identity_conflict',
      };
    }

    return {
      status: 'duplicate',
      runtimeSnapshotId: existing.runtimeSnapshotId,
      idempotencyKey: existing.idempotencyKey,
      state: existing.state as RuntimePersistenceDbState,
      recordId: existing.id,
      outboxEntryId: existing.outboxEntryId ?? undefined,
      auditEventId: existing.auditEventId ?? undefined,
      transactionAttemptId: existing.attempts?.[0]?.id,
    };
  }

  private failed(
    input: RuntimePersistenceWriteInput,
    reasonCode: 'invalid_input' | 'database_write_failed',
  ): RuntimePersistenceWriteReceipt {
    return {
      status: 'failed',
      runtimeSnapshotId: input.runtimeSnapshotId,
      idempotencyKey: input.idempotencyKey,
      state: 'ready_to_persist',
      reasonCode,
    };
  }

  private async findExisting(idempotencyKey: string): Promise<ExistingRuntimeSnapshot | null> {
    return this.db.dealWorkspaceRuntimeSnapshot.findUnique({
      where: { idempotencyKey },
      include: {
        attempts: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    });
  }

  async write(input: RuntimePersistenceWriteInput): Promise<RuntimePersistenceWriteReceipt> {
    if (!isValidInput(input)) {
      return this.failed(input, 'invalid_input');
    }

    try {
      const existing = await this.findExisting(input.idempotencyKey);
      if (existing) {
        return this.classifyExisting(input, existing);
      }

      return await this.db.$transaction(async (tx) => {
        const outbox = await tx.outboxEntry.create({
          data: {
            type: 'deal_workspace.runtime_snapshot.persisted',
            dealId: input.dealId,
            status: 'PENDING',
            idempotencyKey: `runtime-outbox:${input.idempotencyKey}`,
            correlationId: input.correlationId,
            auditId: input.auditId,
            runtimeSnapshotId: input.runtimeSnapshotId,
            runtimeIdempotencyKey: input.idempotencyKey,
            payload: {
              runtimeSnapshotId: input.runtimeSnapshotId,
              idempotencyKey: input.idempotencyKey,
              intentId: input.intentId,
              correlationId: input.correlationId,
              auditId: input.auditId,
              snapshot: input.payload,
            },
          },
        });

        const audit = await tx.auditEvent.create({
          data: {
            action: 'deal_workspace.runtime_snapshot.persisted',
            actorUserId: input.actorId,
            actorRole: input.actorRole,
            tenantId: input.tenantId,
            orgId: input.organizationId,
            dealId: input.dealId,
            objectType: 'deal_workspace_runtime_snapshot',
            objectId: input.runtimeSnapshotId,
            afterState: input.payload,
            outcome: 'SUCCESS',
            correlationId: input.correlationId,
            runtimeSnapshotId: input.runtimeSnapshotId,
            runtimeIdempotencyKey: input.idempotencyKey,
            metadata: {
              auditId: input.auditId,
              transactionId: input.transactionId,
              contractHash: input.contractHash,
            },
          },
        });

        const snapshot = await tx.dealWorkspaceRuntimeSnapshot.create({
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
            version: 1,
          },
        });

        const attempt = await tx.dealWorkspaceRuntimeTransactionAttempt.create({
          data: {
            transactionId: input.transactionId,
            snapshotId: snapshot.id,
            idempotencyKey: input.idempotencyKey,
            correlationId: input.correlationId,
            auditId: input.auditId,
            stage: 'committed',
            outcome: 'persisted',
            isReplay: false,
            completedAt: new Date(),
            metadata: {
              runtimeSnapshotId: input.runtimeSnapshotId,
              outboxEntryId: outbox.id,
              auditEventId: audit.id,
            },
          },
        });

        return {
          status: 'persisted',
          runtimeSnapshotId: snapshot.runtimeSnapshotId,
          idempotencyKey: snapshot.idempotencyKey,
          state: snapshot.state as RuntimePersistenceDbState,
          recordId: snapshot.id,
          outboxEntryId: outbox.id,
          auditEventId: audit.id,
          transactionAttemptId: attempt.id,
        } satisfies RuntimePersistenceWriteReceipt;
      });
    } catch (error) {
      if (isKnownUniqueConstraintError(error)) {
        try {
          const concurrent = await this.findExisting(input.idempotencyKey);
          if (concurrent) {
            return this.classifyExisting(input, concurrent);
          }
        } catch {
          return this.failed(input, 'database_write_failed');
        }
      }

      return this.failed(input, 'database_write_failed');
    }
  }
}
