export type RuntimeAggregateType = 'bid' | 'logistics';
export type RuntimeCommandStatus = 'SUCCEEDED' | 'FAILED';

export type RuntimeCommandRecord = {
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly scopeId: string;
  readonly aggregateType: RuntimeAggregateType;
  readonly aggregateId: string;
  readonly action: string;
  readonly actorRole: string;
  readonly actorId?: string;
  readonly status: RuntimeCommandStatus;
  readonly payload: Record<string, unknown>;
  readonly result?: Record<string, unknown>;
  readonly error?: string;
  readonly createdAt: string;
};

export type RuntimeEventRecord = {
  readonly eventId: string;
  readonly commandId: string;
  readonly scopeId: string;
  readonly aggregateType: RuntimeAggregateType;
  readonly aggregateId: string;
  readonly actorRole: string;
  readonly actorId?: string;
  readonly title: string;
  readonly details: string;
  readonly eventPayload: Record<string, unknown>;
  readonly createdAt: string;
};

export type RuntimeSnapshotRecord<TProjection = unknown> = {
  readonly snapshotId: string;
  readonly scopeId: string;
  readonly aggregateType: RuntimeAggregateType;
  readonly aggregateId: string;
  readonly revision: number;
  readonly projection: TProjection;
  readonly lastCommandId?: string;
  readonly createdAt: string;
};

export type RuntimeCommandWrite<TProjection = unknown> = {
  readonly command: RuntimeCommandRecord;
  readonly event: RuntimeEventRecord;
  readonly snapshot?: RuntimeSnapshotRecord<TProjection>;
};

export type RuntimeCommandWriteResult<TProjection = unknown> = {
  readonly command: RuntimeCommandRecord;
  readonly event: RuntimeEventRecord;
  readonly snapshot?: RuntimeSnapshotRecord<TProjection>;
  readonly idempotent: boolean;
};

export interface PlatformV7RuntimeRepository<TProjection = unknown> {
  readonly mode: 'postgres' | 'memory' | 'test';
  readonly durable: boolean;

  findCommandByIdempotencyKey(idempotencyKey: string): Promise<RuntimeCommandRecord | null>;

  appendCommandEventAndSnapshot(input: RuntimeCommandWrite<TProjection>): Promise<RuntimeCommandWriteResult<TProjection>>;

  getLatestSnapshot(params: {
    readonly scopeId: string;
    readonly aggregateType: RuntimeAggregateType;
    readonly aggregateId: string;
  }): Promise<RuntimeSnapshotRecord<TProjection> | null>;

  listEvents(params: {
    readonly scopeId: string;
    readonly aggregateType: RuntimeAggregateType;
    readonly aggregateId?: string;
    readonly limit?: number;
  }): Promise<readonly RuntimeEventRecord[]>;
}

export function assertDurableRepository(repository: PlatformV7RuntimeRepository): void {
  if (!repository.durable) {
    throw new Error('Platform-v7 runtime repository is not durable. Keep runtime persistence passport non-durable.');
  }
}
