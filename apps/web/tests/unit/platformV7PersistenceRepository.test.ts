import { describe, expect, it } from 'vitest';
import {
  createPlatformV7MemoryPersistenceRepository,
  getPlatformV7RepositoryReadinessSummary,
  type PlatformV7PersistedRecord,
} from '@/lib/platform-v7/persistence-repository';

describe('platform-v7 persistence repository foundation', () => {
  const baseRecord: PlatformV7PersistedRecord = {
    entity: 'deal',
    id: 'deal-1',
    ownerId: 'seller-1',
    idempotencyKey: 'idem-1',
    auditEventIds: ['audit-1'],
    createdAt: '2026-05-07T10:00:00.000Z',
    updatedAt: '2026-05-07T10:00:00.000Z',
    payload: { status: 'draft' },
  };

  it('saves and reads a valid record through the memory adapter', () => {
    const repository = createPlatformV7MemoryPersistenceRepository();

    expect(repository.save(baseRecord)).toEqual({ ok: true, value: baseRecord });
    expect(repository.get('deal', 'deal-1')).toEqual({ ok: true, value: baseRecord });
    expect(repository.list('deal')).toEqual([baseRecord]);
  });

  it('rejects missing owner, audit and idempotency requirements', () => {
    const repository = createPlatformV7MemoryPersistenceRepository();
    const invalid = {
      ...baseRecord,
      ownerId: undefined,
      idempotencyKey: '',
      auditEventIds: [],
    };

    const result = repository.save(invalid);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Owner id is required for deal.');
    expect(result.error).toContain('Idempotency key is required.');
    expect(result.error).toContain('Audit link is required for deal.');
  });

  it('rejects deal-bound records without deal id', () => {
    const repository = createPlatformV7MemoryPersistenceRepository();
    const moneyRecord: PlatformV7PersistedRecord = {
      entity: 'money_record',
      id: 'money-1',
      idempotencyKey: 'idem-money-1',
      auditEventIds: ['audit-1'],
      createdAt: '2026-05-07T10:00:00.000Z',
      updatedAt: '2026-05-07T10:00:00.000Z',
      payload: { amountMinor: 100 },
    };

    const result = repository.save(moneyRecord);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Deal id is required for money_record.');
  });

  it('prevents updating append-only records', () => {
    const repository = createPlatformV7MemoryPersistenceRepository();
    const auditRecord: PlatformV7PersistedRecord = {
      entity: 'audit_event',
      id: 'audit-1',
      idempotencyKey: 'idem-audit-1',
      auditEventIds: [],
      createdAt: '2026-05-07T10:00:00.000Z',
      updatedAt: '2026-05-07T10:00:00.000Z',
      payload: { action: 'created' },
    };

    expect(repository.save(auditRecord)).toEqual({ ok: true, value: auditRecord });
    expect(repository.update({ ...auditRecord, payload: { action: 'changed' } })).toEqual({
      ok: false,
      error: 'Append-only entity audit_event cannot be updated.',
    });
  });

  it('does not present the memory adapter as durable storage', () => {
    const repository = createPlatformV7MemoryPersistenceRepository();

    expect(getPlatformV7RepositoryReadinessSummary(repository)).toEqual({
      mode: 'memory_test_adapter_not_durable',
      durable: false,
      canStoreAfterReload: false,
      requiresDurableAdapter: true,
    });
  });
});
