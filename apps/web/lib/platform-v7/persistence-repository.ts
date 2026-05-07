import {
  canPlatformV7EntityBeDeletedByUser,
  getPlatformV7PersistenceContract,
  type PlatformV7PersistentEntity,
} from './persistence-contracts';

export type PlatformV7PersistedRecord<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  readonly entity: PlatformV7PersistentEntity;
  readonly id: string;
  readonly ownerId?: string;
  readonly dealId?: string;
  readonly idempotencyKey: string;
  readonly auditEventIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly payload: TPayload;
};

export type PlatformV7RepositoryMode = 'memory_test_adapter_not_durable' | 'durable_adapter_required';

export type PlatformV7RepositoryResult<TValue> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: string };

export type PlatformV7PersistenceRepository = {
  readonly mode: PlatformV7RepositoryMode;
  readonly save: <TPayload extends Record<string, unknown>>(
    record: PlatformV7PersistedRecord<TPayload>,
  ) => PlatformV7RepositoryResult<PlatformV7PersistedRecord<TPayload>>;
  readonly update: <TPayload extends Record<string, unknown>>(
    record: PlatformV7PersistedRecord<TPayload>,
  ) => PlatformV7RepositoryResult<PlatformV7PersistedRecord<TPayload>>;
  readonly get: <TPayload extends Record<string, unknown>>(
    entity: PlatformV7PersistentEntity,
    id: string,
  ) => PlatformV7RepositoryResult<PlatformV7PersistedRecord<TPayload> | null>;
  readonly list: <TPayload extends Record<string, unknown>>(
    entity: PlatformV7PersistentEntity,
  ) => readonly PlatformV7PersistedRecord<TPayload>[];
  readonly remove: (entity: PlatformV7PersistentEntity, id: string) => PlatformV7RepositoryResult<null>;
};

const keyFor = (entity: PlatformV7PersistentEntity, id: string) => `${entity}:${id}`;

const validateRecord = (record: PlatformV7PersistedRecord): string[] => {
  const contract = getPlatformV7PersistenceContract(record.entity);
  const issues: string[] = [];

  if (!contract) issues.push(`Persistence contract for ${record.entity} is missing.`);
  if (!record.id.trim()) issues.push('Record id is required.');
  if (!record.idempotencyKey.trim()) issues.push('Idempotency key is required.');
  if (!record.createdAt.trim()) issues.push('createdAt is required.');
  if (!record.updatedAt.trim()) issues.push('updatedAt is required.');
  if (contract?.requiresOwnerId && !record.ownerId?.trim()) issues.push(`Owner id is required for ${record.entity}.`);
  if (contract?.requiresDealId && !record.dealId?.trim()) issues.push(`Deal id is required for ${record.entity}.`);
  if (contract?.requiresAuditLink && record.auditEventIds.length === 0) {
    issues.push(`Audit link is required for ${record.entity}.`);
  }

  return issues;
};

export function createPlatformV7MemoryPersistenceRepository(): PlatformV7PersistenceRepository {
  const records = new Map<string, PlatformV7PersistedRecord>();

  return {
    mode: 'memory_test_adapter_not_durable',
    save: <TPayload extends Record<string, unknown>>(record: PlatformV7PersistedRecord<TPayload>) => {
      const issues = validateRecord(record);
      const key = keyFor(record.entity, record.id);

      if (issues.length > 0) return { ok: false, error: issues.join(' ') };
      if (records.has(key)) return { ok: false, error: `Record ${key} already exists.` };

      records.set(key, record);
      return { ok: true, value: record };
    },
    update: <TPayload extends Record<string, unknown>>(record: PlatformV7PersistedRecord<TPayload>) => {
      const contract = getPlatformV7PersistenceContract(record.entity);
      const key = keyFor(record.entity, record.id);
      const issues = validateRecord(record);

      if (issues.length > 0) return { ok: false, error: issues.join(' ') };
      if (!records.has(key)) return { ok: false, error: `Record ${key} does not exist.` };
      if (contract?.storageMode === 'append_only') return { ok: false, error: `Append-only entity ${record.entity} cannot be updated.` };

      records.set(key, record);
      return { ok: true, value: record };
    },
    get: <TPayload extends Record<string, unknown>>(entity: PlatformV7PersistentEntity, id: string) => ({
      ok: true,
      value: (records.get(keyFor(entity, id)) as PlatformV7PersistedRecord<TPayload> | undefined) ?? null,
    }),
    list: <TPayload extends Record<string, unknown>>(entity: PlatformV7PersistentEntity) =>
      Array.from(records.values()).filter((record) => record.entity === entity) as PlatformV7PersistedRecord<TPayload>[],
    remove: (entity: PlatformV7PersistentEntity, id: string) => {
      const key = keyFor(entity, id);

      if (!records.has(key)) return { ok: false, error: `Record ${key} does not exist.` };
      if (!canPlatformV7EntityBeDeletedByUser(entity)) return { ok: false, error: `Entity ${entity} cannot be removed by user action.` };

      records.delete(key);
      return { ok: true, value: null };
    },
  };
}

export function getPlatformV7RepositoryReadinessSummary(repository: PlatformV7PersistenceRepository) {
  return {
    mode: repository.mode,
    durable: repository.mode === 'durable_adapter_required',
    canStoreAfterReload: repository.mode === 'durable_adapter_required',
    requiresDurableAdapter: repository.mode !== 'durable_adapter_required',
  };
}
