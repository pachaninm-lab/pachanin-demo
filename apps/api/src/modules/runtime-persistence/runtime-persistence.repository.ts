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
  /**
   * Compatibility entry point for internal callers that do not yet own a
   * trusted transaction. Authenticated command paths must use
   * writeWithinTransaction instead.
   */
  write(input: RuntimePersistenceWriteInput): Promise<RuntimePersistenceWriteReceipt>;

  /** Executes lookup and all writes on the supplied trusted transaction. */
  writeWithinTransaction(
    tx: Prisma.TransactionClient,
    input: RuntimePersistenceWriteInput,
  ): Promise<RuntimePersistenceWriteReceipt>;

  /** Reclassifies a concurrent idempotency winner inside a new trusted transaction. */
  classifyExistingWithinTransaction(
    tx: Prisma.TransactionClient,
    input: RuntimePersistenceWriteInput,
  ): Promise<RuntimePersistenceWriteReceipt | null>;
}

function disabledReceipt(input: RuntimePersistenceWriteInput): RuntimePersistenceWriteReceipt {
  return {
    status: 'failed',
    runtimeSnapshotId: input.runtimeSnapshotId,
    idempotencyKey: input.idempotencyKey,
    state: 'ready_to_persist',
    reasonCode: 'repository_not_enabled',
  };
}

/**
 * Safe default for environments where the Postgres runtime-persistence path is
 * not explicitly enabled. It never falls back to the process runtime store.
 */
export class DisabledRuntimePersistenceRepository implements RuntimePersistenceRepository {
  async write(input: RuntimePersistenceWriteInput): Promise<RuntimePersistenceWriteReceipt> {
    return disabledReceipt(input);
  }

  async writeWithinTransaction(
    _tx: Prisma.TransactionClient,
    input: RuntimePersistenceWriteInput,
  ): Promise<RuntimePersistenceWriteReceipt> {
    return disabledReceipt(input);
  }

  async classifyExistingWithinTransaction(
    _tx: Prisma.TransactionClient,
    _input: RuntimePersistenceWriteInput,
  ): Promise<RuntimePersistenceWriteReceipt | null> {
    return null;
  }
}
