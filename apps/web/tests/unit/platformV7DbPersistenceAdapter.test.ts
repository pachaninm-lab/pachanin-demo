import { describe, expect, it } from 'vitest';
import { createP7DbRuntimeStore } from '@/lib/platform-v7/runtime/db-persistence-adapter';
import { createP7InMemoryPersistenceDriver } from '@/lib/platform-v7/runtime/persistence-driver';
import type { PlatformV7MoneyTree } from '@/lib/platform-v7/money-tree';
import type { P7PersistedRecord } from '@/lib/platform-v7/runtime/persistence-ports';

function moneyRecord(dealId: string, version = 'seed-v0'): P7PersistedRecord<PlatformV7MoneyTree> {
  return {
    recordId: `money:${dealId}`,
    dealId,
    value: { dealId } as unknown as PlatformV7MoneyTree,
    version: { resourceType: 'money_tree', resourceId: dealId, version, updatedAt: '2026-05-24T00:00:00.000Z' },
    createdAt: '2026-05-24T00:00:00.000Z',
    updatedAt: '2026-05-24T00:00:00.000Z',
  };
}

const saveOptions = { correlationId: 'corr-1' };

function newStore() {
  return createP7DbRuntimeStore(createP7InMemoryPersistenceDriver());
}

describe('PR-2 DB persistence adapter', () => {
  it('round-trips a money tree and stamps a new version', async () => {
    const store = newStore();
    const saved = await store.moneyTree.saveMoneyTree(moneyRecord('DL-1'), saveOptions);
    expect(saved.ok).toBe(true);
    const loaded = await store.moneyTree.loadByDealId('DL-1');
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value.value.dealId).toBe('DL-1');
  });

  it('enforces optimistic concurrency via expectedVersion', async () => {
    const store = newStore();
    const first = await store.moneyTree.saveMoneyTree(moneyRecord('DL-2'), saveOptions);
    expect(first.ok).toBe(true);
    const currentVersion = first.ok ? first.value.version.version : '';
    // правильная версия — ок
    const ok = await store.moneyTree.saveMoneyTree(moneyRecord('DL-2'), { ...saveOptions, expectedVersion: currentVersion });
    expect(ok.ok).toBe(true);
    // устаревшая версия — конфликт
    const stale = await store.moneyTree.saveMoneyTree(moneyRecord('DL-2'), { ...saveOptions, expectedVersion: 'seed-v0' });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.status).toBe('conflict');
  });

  it('reserves idempotency keys and rejects duplicates', async () => {
    const store = newStore();
    const scope = { dealId: 'DL-3', correlationId: 'c3' };
    const first = await store.idempotency.reserveKey({ key: 'k1', scope, correlationId: 'c3' });
    expect(first.ok).toBe(true);
    const dup = await store.idempotency.reserveKey({ key: 'k1', scope, correlationId: 'c3' });
    expect(dup.ok).toBe(false);
    const ctx = await store.idempotency.loadContext(scope);
    expect(ctx.processedKeys).toContain('k1');
  });

  it('dedupes bank confirmation by bankEventId', async () => {
    const store = newStore();
    const rec = {
      recordId: 'DL-4:evt-1',
      dealId: 'DL-4',
      value: { decision: {}, confirmation: { bankEventId: 'evt-1' } },
      version: { resourceType: 'bank_confirmation', resourceId: 'evt-1', version: 'v0', updatedAt: '2026-05-24T00:00:00.000Z' },
      createdAt: '2026-05-24T00:00:00.000Z',
      updatedAt: '2026-05-24T00:00:00.000Z',
    } as unknown as Parameters<typeof store.bankBasis.saveBankConfirmation>[0];
    expect((await store.bankBasis.saveBankConfirmation(rec, saveOptions)).ok).toBe(true);
    const second = await store.bankBasis.saveBankConfirmation(rec, saveOptions);
    expect(second.ok).toBe(false);
  });

  it('appends audit and lists by correlation id', async () => {
    const store = newStore();
    await store.audit.append({ auditId: 'a1', correlationId: 'cc', dealId: 'DL-5' } as never);
    const listed = await store.audit.listByCorrelationId('cc');
    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.value.length).toBe(1);
  });

  it('rolls back the transaction when the unit of work returns a failure', async () => {
    const store = newStore();
    const result = await store.runInTransaction(async (ports) => {
      await ports.moneyTree.saveMoneyTree(moneyRecord('DL-6'), saveOptions);
      return { ok: false as const, error: { code: 'domain_blocked' as never, message: 'blocked' } } as never;
    });
    expect(result.ok).toBe(false);
    // запись не должна сохраниться после отката
    const loaded = await store.moneyTree.loadByDealId('DL-6');
    expect(loaded.ok).toBe(false);
  });

  it('commits the transaction on success', async () => {
    const store = newStore();
    const result = await store.runInTransaction(async (ports) => {
      const saved = await ports.moneyTree.saveMoneyTree(moneyRecord('DL-7'), saveOptions);
      return { ok: true as const, value: saved.ok };
    });
    expect(result.ok).toBe(true);
    const loaded = await store.moneyTree.loadByDealId('DL-7');
    expect(loaded.ok).toBe(true);
  });
});
