export const PLATFORM_V7_RUNTIME_PERSISTENCE_REPOSITORY = 'PLATFORM_V7_RUNTIME_PERSISTENCE_REPOSITORY';
export const PLATFORM_V7_RUNTIME_PERSISTENCE_PRISMA_MODE = 'prisma';

export type RuntimePersistenceState =
  | 'ready_to_persist'
  | 'outbox_required'
  | 'audit_required'
  | 'fully_linked';

export type RuntimeSnapshotState = 'updated' | 'blocked' | 'duplicate' | 'failed';

export interface RuntimePersistenceWriteInput {
  readonly runtimeSnapshotId: string;
  readonly idempotencyKey: string;
  readonly dealId: string;
  readonly intentId: string;
  readonly snapshotState: RuntimeSnapshotState;
  readonly statusLabel: string;
  readonly runtimeStoreRecordId: string;
  readonly runtimeStoreVersion: string;
  readonly actorId: string;
  readonly actorRole: string;
  readonly correlationId: string;
  readonly auditId: string;
  readonly contractHash: string;
  readonly payload: Record<string, unknown>;
}

export interface RuntimePersistenceReceipt {
  readonly status: 'persisted' | 'duplicate' | 'conflict';
  readonly state: RuntimePersistenceState;
  readonly recordId?: string;
  readonly runtimeSnapshotId: string;
  readonly idempotencyKey: string;
  readonly outboxEntryId?: string;
  readonly auditEventId?: string;
  readonly conflictCode?: 'MATERIAL_IDENTITY_MISMATCH';
}

export interface RuntimePersistenceStoredRecord {
  readonly id: string;
  readonly runtimeSnapshotId: string;
  readonly idempotencyKey: string;
  readonly dealId: string;
  readonly intentId: string;
  readonly state: RuntimePersistenceState;
  readonly snapshotState: RuntimeSnapshotState;
  readonly statusLabel: string;
  readonly runtimeStoreRecordId: string;
  readonly runtimeStoreVersion: string;
  readonly actorId: string;
  readonly actorRole: string;
  readonly correlationId: string;
  readonly auditId: string;
  readonly contractHash: string;
  readonly payload: Record<string, unknown>;
  readonly outboxEntryId: string | null;
  readonly auditEventId: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface RuntimePersistenceRepository {
  write(input: RuntimePersistenceWriteInput): Promise<RuntimePersistenceReceipt>;
  findByIdempotencyKey(idempotencyKey: string): Promise<RuntimePersistenceStoredRecord | null>;
}

export class RuntimePersistenceRepositoryUnavailableError extends Error {
  readonly code = 'RUNTIME_PERSISTENCE_REPOSITORY_UNAVAILABLE';

  constructor(message = 'Runtime persistence repository is unavailable.') {
    super(message);
    this.name = 'RuntimePersistenceRepositoryUnavailableError';
  }
}

export class RuntimePersistenceWriteError extends Error {
  readonly code = 'RUNTIME_PERSISTENCE_WRITE_FAILED';

  constructor() {
    super('Runtime persistence write failed.');
    this.name = 'RuntimePersistenceWriteError';
  }
}
