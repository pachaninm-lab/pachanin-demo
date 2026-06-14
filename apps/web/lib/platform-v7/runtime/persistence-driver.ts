// PR-2 DB persistence — драйвер хранилища (шов под реальную БД).
//
// P7PersistenceDriver — минимальный контракт хранилища, который реализует
// конкретная БД (Postgres/SQLite/…): коллекции типизированных записей с
// optimistic-версионированием, журнал аудита, набор идемпотентности и
// транзакция со снимком/откатом. db-persistence-adapter.ts строит над этим
// порты P7RuntimeUnitOfWork — поэтому при подключении реальной БД меняется
// только драйвер, а application-service не трогается.

import type { P7AuditPayload, P7PersistedRecord, P7ResourceVersion } from './persistence-ports';

export interface P7DriverIdempotencyRecord {
  readonly key: string;
  readonly scopeKey: string;
  readonly operationId?: string;
  readonly bankEventId?: string;
  readonly correlationId: string;
  readonly reservedAt: string;
  readonly result?: P7PersistedRecord<unknown>;
}

export interface P7PersistenceDriver {
  now(): string;
  nextVersion(resourceType: string, resourceId: string): P7ResourceVersion;

  getRecord<T>(collection: string, key: string): P7PersistedRecord<T> | undefined;
  putRecord<T>(collection: string, key: string, record: P7PersistedRecord<T>): void;
  listRecords<T>(collection: string): P7PersistedRecord<T>[];

  appendAudit(record: P7PersistedRecord<P7AuditPayload>): void;
  listAudit(): P7PersistedRecord<P7AuditPayload>[];

  getIdempotency(key: string): P7DriverIdempotencyRecord | undefined;
  listIdempotency(): P7DriverIdempotencyRecord[];
  putIdempotency(record: P7DriverIdempotencyRecord): void;
  hasBankEvent(bankEventId: string): boolean;
  markBankEvent(bankEventId: string): void;

  runInTransaction<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: unknown }>;
}

interface DriverState {
  collections: Record<string, Record<string, P7PersistedRecord<unknown>>>;
  audit: P7PersistedRecord<P7AuditPayload>[];
  idempotency: Record<string, P7DriverIdempotencyRecord>;
  bankEventIds: Set<string>;
  versionCounter: number;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(now: string): DriverState {
  return { collections: {}, audit: [], idempotency: {}, bankEventIds: new Set(), versionCounter: 0 };
}

// Эталонный in-memory драйвер: для тестов, dev и как образец реализации под БД.
export function createP7InMemoryPersistenceDriver(nowValue = '2026-05-24T00:00:00.000Z'): P7PersistenceDriver {
  let state = emptyState(nowValue);

  const driver: P7PersistenceDriver = {
    now: () => nowValue,
    nextVersion(resourceType, resourceId) {
      state.versionCounter += 1;
      return { resourceType, resourceId, version: `db-v${state.versionCounter}`, updatedAt: nowValue };
    },
    getRecord<T>(collection: string, key: string) {
      const rec = state.collections[collection]?.[key];
      return rec ? (clone(rec) as P7PersistedRecord<T>) : undefined;
    },
    putRecord(collection, key, record) {
      (state.collections[collection] ||= {})[key] = clone(record);
    },
    listRecords<T>(collection: string) {
      return Object.values(state.collections[collection] ?? {}).map((r) => clone(r)) as P7PersistedRecord<T>[];
    },
    appendAudit(record) {
      state.audit.push(clone(record));
    },
    listAudit() {
      return state.audit.map((r) => clone(r));
    },
    getIdempotency(key) {
      const rec = state.idempotency[key];
      return rec ? clone(rec) : undefined;
    },
    listIdempotency() {
      return Object.values(state.idempotency).map((r) => clone(r));
    },
    putIdempotency(record) {
      state.idempotency[record.key] = clone(record);
    },
    hasBankEvent(bankEventId) {
      return state.bankEventIds.has(bankEventId);
    },
    markBankEvent(bankEventId) {
      state.bankEventIds.add(bankEventId);
    },
    async runInTransaction(fn) {
      const snapshot: DriverState = {
        collections: clone(state.collections),
        audit: clone(state.audit),
        idempotency: clone(state.idempotency),
        bankEventIds: new Set(state.bankEventIds),
        versionCounter: state.versionCounter,
      };
      try {
        const value = await fn();
        return { ok: true, value };
      } catch (error) {
        state = snapshot;
        return { ok: false, error };
      }
    },
  };

  return driver;
}
