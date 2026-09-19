import { describe, expect, it } from 'vitest';
import { EMPTY_P7_PERSISTENCE_STATE, persistMoneyEvent } from '@/lib/platform-v7/persistence-queue';
import {
  buildPersistenceSnapshot,
  getPersistenceHealth,
  hydratePersistenceSnapshot,
  validatePersistenceState,
} from '@/lib/platform-v7/persistence-snapshot';
import type { P7MoneyEvent } from '@/lib/platform-v7/money-safety';

const reserveEvent: P7MoneyEvent = {
  dealId: 'DL-9109',
  eventId: 'bank-event-001',
  type: 'reserve_confirmed',
  amount: 3_873_600,
  provider: 'sber_safe_deals',
  providerOperationId: 'sber-op-001',
  occurredAt: '2026-04-26T12:00:00Z',
  payloadHash: 'payload-a',
};

function buildStateWithManualReview() {
  const first = persistMoneyEvent(EMPTY_P7_PERSISTENCE_STATE, {
    event: reserveEvent,
    actor: 'bank-runtime',
    now: () => '2026-04-26T13:00:00Z',
  });

  return persistMoneyEvent(first.state, {
    event: {
      ...reserveEvent,
      eventId: 'bank-event-mismatch-001',
      amount: 3_870_000,
      occurredAt: '2026-04-26T13:01:00Z',
    },
    actor: 'bank-runtime',
    now: () => '2026-04-26T13:02:00Z',
  }).state;
}

describe('platform-v7 persistence snapshot', () => {
  it('builds a schema-versioned snapshot with review health', () => {
    const state = buildStateWithManualReview();
    const snapshot = buildPersistenceSnapshot(state, {
      source: 'controlled-pilot',
      now: () => '2026-04-26T14:00:00Z',
    });

    expect(snapshot.schemaVersion).toBe('p7.persistence.v1');
    expect(snapshot.generatedAt).toBe('2026-04-26T14:00:00Z');
    expect(snapshot.source).toBe('controlled-pilot');
    expect(snapshot.state.ledger).toHaveLength(1);
    expect(snapshot.health).toEqual({
      status: 'review',
      issueCount: 0,
      manualReviewCount: 2,
      rejectedCount: 0,
    });
  });

  it('hydrates a snapshot back into persistence state without mutating source arrays', () => {
    const state = buildStateWithManualReview();
    const snapshot = buildPersistenceSnapshot(state, {
      source: 'database',
      now: () => '2026-04-26T14:00:00Z',
    });

    const hydrated = hydratePersistenceSnapshot(snapshot);

    expect(hydrated).toEqual(state);
    expect(hydrated.ledger).not.toBe(state.ledger);
    expect(hydrated.queue).not.toBe(state.queue);
    expect(hydrated.actionLog).not.toBe(state.actionLog);
  });

  it('detects duplicate ledger idempotency keys', () => {
    const state = buildStateWithManualReview();
    const brokenState = {
      ...state,
      ledger: [...state.ledger, state.ledger[0]],
    };

    const issues = validatePersistenceState(brokenState);
    const health = getPersistenceHealth(brokenState);

    expect(issues).toContainEqual(expect.objectContaining({
      code: 'LEDGER_DUPLICATE_IDEMPOTENCY_KEY',
      objectId: state.ledger[0]?.idempotencyKey,
    }));
    expect(health.status).toBe('error');
    expect(health.issueCount).toBeGreaterThan(0);
  });

  it('detects manual review item without reason', () => {
    const state = buildStateWithManualReview();
    const manualItem = state.queue.find((item) => item.status === 'manual_review');
    if (!manualItem) throw new Error('Expected manual review item in stable state');

    const brokenState = {
      ...state,
      queue: state.queue.map((item) => item.id === manualItem.id ? { ...item, reason: '' } : item),
    };

    expect(validatePersistenceState(brokenState)).toContainEqual(expect.objectContaining({
      code: 'MANUAL_REVIEW_WITHOUT_REASON',
      objectId: manualItem.id,
    }));
    expect(getPersistenceHealth(brokenState).status).toBe('error');
  });

  it('rejects unsupported snapshot schema during hydrate', () => {
    const snapshot = buildPersistenceSnapshot(buildStateWithManualReview());

    expect(() => hydratePersistenceSnapshot({
      ...snapshot,
      schemaVersion: 'p7.persistence.v0' as 'p7.persistence.v1',
    })).toThrow('Unsupported persistence snapshot schema');
  });
});
