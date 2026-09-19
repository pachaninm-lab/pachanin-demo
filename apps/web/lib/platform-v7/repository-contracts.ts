export type P7EntityName =
  | 'user'
  | 'organization'
  | 'membership'
  | 'grainBatch'
  | 'lot'
  | 'rfq'
  | 'offer'
  | 'deal'
  | 'trip'
  | 'document'
  | 'moneyOperation'
  | 'dispute'
  | 'evidence'
  | 'auditEvent'
  | 'externalCall';

export interface P7RepositoryRecord {
  readonly id: string;
  readonly entity: P7EntityName;
  readonly organizationId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface P7RepositoryQuery {
  readonly entity: P7EntityName;
  readonly organizationId?: string;
  readonly dealId?: string;
  readonly status?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface P7RepositoryPage<TRecord extends P7RepositoryRecord> {
  readonly items: readonly TRecord[];
  readonly nextCursor?: string;
}

export interface P7Repository<TRecord extends P7RepositoryRecord> {
  readonly entity: P7EntityName;
  getById(id: string): Promise<TRecord | null>;
  list(query: P7RepositoryQuery): Promise<P7RepositoryPage<TRecord>>;
  save(record: TRecord): Promise<TRecord>;
}

export interface P7AuditRecord extends P7RepositoryRecord {
  readonly entity: 'auditEvent';
  readonly actorId: string;
  readonly actorRole: string;
  readonly action: string;
  readonly targetEntity: P7EntityName;
  readonly targetId: string;
  readonly correlationId: string;
  readonly auditId: string;
}

export interface P7OutboxRecord extends P7RepositoryRecord {
  readonly entity: 'externalCall';
  readonly system: string;
  readonly operation: string;
  readonly status: 'pending' | 'sent' | 'failed' | 'acknowledged' | 'manual_review';
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly auditId: string;
}

export function p7ValidateRepositoryRecord(record: P7RepositoryRecord): boolean {
  return Boolean(record.id && record.entity && record.createdAt && record.updatedAt && Number.isInteger(record.version) && record.version >= 1);
}

export function p7OptimisticVersionMatches(current: P7RepositoryRecord, next: P7RepositoryRecord): boolean {
  return current.id === next.id && current.entity === next.entity && next.version === current.version + 1;
}

export function p7CreateAuditRecord(input: Omit<P7AuditRecord, 'entity' | 'version' | 'createdAt' | 'updatedAt'> & { readonly now: string }): P7AuditRecord {
  return {
    id: input.id,
    entity: 'auditEvent',
    organizationId: input.organizationId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    targetEntity: input.targetEntity,
    targetId: input.targetId,
    correlationId: input.correlationId,
    auditId: input.auditId,
    createdAt: input.now,
    updatedAt: input.now,
    version: 1,
  };
}

export function p7CreateOutboxRecord(input: Omit<P7OutboxRecord, 'entity' | 'version' | 'createdAt' | 'updatedAt' | 'status'> & { readonly now: string }): P7OutboxRecord {
  return {
    id: input.id,
    entity: 'externalCall',
    organizationId: input.organizationId,
    system: input.system,
    operation: input.operation,
    status: 'pending',
    idempotencyKey: input.idempotencyKey,
    correlationId: input.correlationId,
    auditId: input.auditId,
    createdAt: input.now,
    updatedAt: input.now,
    version: 1,
  };
}
