import type { Prisma } from '@prisma/client';

export const RUNTIME_PERSISTENCE_REPOSITORY = Symbol('RUNTIME_PERSISTENCE_REPOSITORY');

export type RuntimePersistenceSnapshotState = 'updated' | 'blocked' | 'duplicate' | 'failed';
export type RuntimePersistenceDbState =
  | 'ready_to_persist'
  | 'outbox_required'
  | 'audit_required'
  | 'fully_linked';
export type RuntimePersistenceWriteStatus = 'persisted' | 'duplicate' | 'conflict' | 'failed';

export interface RuntimePersistenceWriteInput {
  runtimeSnapshotId: string;
  idempotencyKey: string;
  transactionId: string;
  dealId: string;
  intentId: string;
  snapshotState: RuntimePersistenceSnapshotState;
  statusLabel: string;
  runtimeStoreRecordId: string;
  runtimeStoreVersion: string;
  actorId: string;
  actorRole: string;
  tenantId?: string;
  organizationId?: string;
  correlationId: string;
  auditId: string;
  contractHash: string;
  payload: Prisma.InputJsonValue;
}

export interface RuntimePersistenceWriteReceipt {
  status: RuntimePersistenceWriteStatus;
  runtimeSnapshotId: string;
  idempotencyKey: string;
  state: RuntimePersistenceDbState;
  recordId?: string;
  outboxEntryId?: string;
  auditEventId?: string;
  transactionAttemptId?: string;
  reasonCode?:
    | 'repository_not_enabled'
    | 'invalid_input'
    | 'material_identity_conflict'
    | 'database_write_failed';
}

export interface RuntimePersistenceRepository {
  write(input: RuntimePersistenceWriteInput): Promise<RuntimePersistenceWriteReceipt>;
}

/**
 * Safe default for environments where the Postgres runtime-persistence path is
 * not explicitly enabled. It never falls back to the process runtime store.
 */
export class DisabledRuntimePersistenceRepository implements RuntimePersistenceRepository {
  async write(input: RuntimePersistenceWriteInput): Promise<RuntimePersistenceWriteReceipt> {
    return {
      status: 'failed',
      runtimeSnapshotId: input.runtimeSnapshotId,
      idempotencyKey: input.idempotencyKey,
      state: 'ready_to_persist',
      reasonCode: 'repository_not_enabled',
    };
  }
}
