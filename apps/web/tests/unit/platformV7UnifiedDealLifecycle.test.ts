import { describe, expect, it } from 'vitest';
import { createP7DbRuntimeStore } from '@/lib/platform-v7/runtime/db-persistence-adapter';
import { createP7InMemoryPersistenceDriver } from '@/lib/platform-v7/runtime/persistence-driver';
import {
  p7ReconcileBankCallback,
  p7ShouldRetryBankReconciliation,
  p7BankReconciliationTimedOut,
  P7_DEFAULT_BANK_RETRY,
  type P7BankCallbackEvent,
  type P7BankReconciliationExpectation,
} from '@/lib/platform-v7/bank-callback';
import type { P7PersistedRecord } from '@/lib/platform-v7/runtime/persistence-ports';
import type { PlatformV7MoneyTree } from '@/lib/platform-v7/money-tree';
import type { PlatformV7DocumentMatrix } from '@/lib/platform-v7/document-matrix';

const DEAL = 'DL-9106';
const opt = { correlationId: 'c-lifecycle' };

function money(version = 'v0'): P7PersistedRecord<PlatformV7MoneyTree> {
  return {
    recordId: `money:${DEAL}`, dealId: DEAL,
    value: { dealId: DEAL } as unknown as PlatformV7MoneyTree,
    version: { resourceType: 'money_tree', resourceId: DEAL, version, updatedAt: '2026-05-24T00:00:00.000Z' },
    createdAt: '2026-05-24T00:00:00.000Z', updatedAt: '2026-05-24T00:00:00.000Z',
  };
}
function matrix(): P7PersistedRecord<PlatformV7DocumentMatrix> {
  return {
    recordId: `dm:${DEAL}`, dealId: DEAL,
    value: { dealId: DEAL, documents: [] } as unknown as PlatformV7DocumentMatrix,
    version: { resourceType: 'document_matrix', resourceId: DEAL, version: 'v0', updatedAt: '2026-05-24T00:00:00.000Z' },
    createdAt: '2026-05-24T00:00:00.000Z', updatedAt: '2026-05-24T00:00:00.000Z',
  };
}

const expectation: P7BankReconciliationExpectation = {
  dealId: DEAL, expectedAmount: 9_648_000, currency: 'RUB', processedBankEventIds: [],
};
function callback(over: Partial<P7BankCallbackEvent> = {}): P7BankCallbackEvent {
  return { bankEventId: 'evt-1', dealId: DEAL, status: 'released', amount: 9_648_000, currency: 'RUB', bankReference: 'r', occurredAt: '2026-05-24T10:00:00.000Z', ...over };
}

describe('PR-8 unified deal lifecycle (runtime integration)', () => {
  it('runs the full deal flow lot→deal→docs→money→audit→close with persistence', async () => {
    const store = createP7DbRuntimeStore(createP7InMemoryPersistenceDriver());

    // 1-2. lot/deal created → money tree + document matrix persisted
    expect((await store.moneyTree.saveMoneyTree(money(), opt)).ok).toBe(true);
    expect((await store.documentMatrix.saveDocumentMatrix(matrix(), opt)).ok).toBe(true);

    // 3-7. logistics/driver/elevator/lab/documents readiness → document requirements appended
    const req = { documentId: 'SDIZ', status: 'ready' } as never;
    expect((await store.documentMatrix.saveDocumentRequirement(DEAL, req, opt)).ok).toBe(true);

    // 8. money hold/release decision → reconcile bank callback → confirm
    const outcome = p7ReconcileBankCallback(callback(), expectation);
    expect(outcome.action).toBe('confirm');
    expect(outcome.path).toBe('release');

    // 10. audit export
    await store.audit.append({ auditId: 'a-1', correlationId: opt.correlationId, dealId: DEAL } as never);
    const audit = await store.audit.listByCorrelationId(opt.correlationId);
    expect(audit.ok && audit.value.length).toBe(1);

    // 11. close deal
    const loaded = await store.moneyTree.loadByDealId(DEAL);
    const currentVersion = loaded.ok ? loaded.value.version.version : '';
    const closed = await store.moneyTree.saveMoneyTree(money(), { ...opt, expectedVersion: currentVersion });
    expect(closed.ok).toBe(true);
  });

  it('offline queue + duplicate event → no double processing', async () => {
    const store = createP7DbRuntimeStore(createP7InMemoryPersistenceDriver());
    const scope = { dealId: DEAL, correlationId: 'c-offline' };
    // оффлайн-операция поставлена в очередь и применена
    expect((await store.idempotency.reserveKey({ key: 'offline-op-1', scope, correlationId: 'c-offline' })).ok).toBe(true);
    // повторная отправка того же события (слабая связь / ретрай) — отклонена
    expect((await store.idempotency.reserveKey({ key: 'offline-op-1', scope, correlationId: 'c-offline' })).ok).toBe(false);

    // дубликат банковского callback не приводит к повторному выпуску
    const dup = p7ReconcileBankCallback(callback({ bankEventId: 'evt-dup' }), { ...expectation, processedBankEventIds: ['evt-dup'] });
    expect(dup.action).toBe('duplicate');
  });

  it('conflict on concurrent write is rejected (optimistic concurrency)', async () => {
    const store = createP7DbRuntimeStore(createP7InMemoryPersistenceDriver());
    await store.moneyTree.saveMoneyTree(money(), opt);
    const stale = await store.moneyTree.saveMoneyTree(money(), { ...opt, expectedVersion: 'v0' });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.status).toBe('conflict');
  });

  it('mismatch and retry/timeout route money to manual review, never silent release', () => {
    expect(p7ReconcileBankCallback(callback({ amount: 1 }), expectation).action).toBe('manual_review');
    expect(p7ShouldRetryBankReconciliation(1, 1000)).toBe(true);
    expect(p7BankReconciliationTimedOut(P7_DEFAULT_BANK_RETRY.timeoutMs)?.action).toBe('manual_review');
  });
});
