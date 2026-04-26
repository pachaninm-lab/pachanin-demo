import { describe, expect, it } from 'vitest';
import { buildStableV7rPersistenceState } from '@/lib/v7r/persistence-queue';
import {
  buildPersistenceSnapshot,
  getPersistenceHealth,
  hydratePersistenceSnapshot,
  validatePersistenceState,
} from '@/lib/platform-v7/persistence-snapshot';

describe('platform-v7 persistence snapshot', () => {
  it('builds a schema-versioned snapshot with review health for controlled pilot state', () => {
    const state = buildStableV7rPersistenceState();
    const snapshot = buildPersistenceSnapshot(state, {
      source: 'controlled-pilot',
      now: () => '2026-04-26T14:00:00Z',
    });

    expect(snapshot.schemaVersion).toBe('p7.persistence.v1');
    expect(snapshot.generatedAt).toBe('2026-04-26T14:00:00Z');
    expect(snapshot.source).toBe('controlled-pilot');
    expect(snapshot.state.ledger).toHaveLength(3);
    expect(snapshot.state.queue).toHaveLength(8);
    expect(snapshot.health).toEqual({
      status: 'review',
      issueCount: 0,
      manualReviewCount: 1,
      rejectedCount: 0,
    });
  });

  it('hydrates a snapshot back into persistence state without mutating source arrays', () => {
    const state = buildStableV7rPersistenceState();
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
    const state = buildStableV7rPersistenceState();
    const brokenState = {
      ...state,
      ledger: [...state.ledger, state.ledger[0]],
    };

    const issues = validatePersistenceState(brokenState);
    const health = getPersistenceHealth(brokenState);

    expect(issues).toContainEqual(expect.objectContaining({
      code: 'LEDGER_DUPLICATE_IDEMPOTENCY_KEY',
      objectId: state.ledger[0].idempotencyKey,
    }));
    expect(health.status).toBe('error');
    expect(health.issueCount).toBeGreaterThan(0);
  });

  it('detects queue item without manual review reason', () => {
    const state = buildStableV7rPersistenceState();
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
    const state = buildStableV7rPersistenceState();
    const snapshot = buildPersistenceSnapshot(state);

    expect(() => hydratePersistenceSnapshot({
      ...snapshot,
      schemaVersion: 'p7.persistence.v0' as 'p7.persistence.v1',
    })).toThrow('Unsupported persistence snapshot schema');
  });
});
