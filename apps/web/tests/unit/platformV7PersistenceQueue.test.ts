import { describe, expect, it } from 'vitest';
import {
  EMPTY_P7_PERSISTENCE_STATE,
  getManualReconciliationQueue,
  getQueueByDeal,
  persistMoneyEvent,
  projectQueueToDealTimeline,
} from '@/lib/platform-v7/persistence-queue';
import type { P7MoneyEvent } from '@/lib/platform-v7/money-safety';

const now = () => '2026-04-26T13:00:00Z';

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

describe('platform-v7 persistence queue', () => {
  it('persists a bank event into ledger, queue, reconciliation queue and action log', () => {
    const result = persistMoneyEvent(EMPTY_P7_PERSISTENCE_STATE, {
      event: reserveEvent,
      actor: 'bank-runtime',
      now,
    });

    expect(result.queueItem.status).toBe('processed');
    expect(result.reconciliation?.state).toBe('matched');
    expect(result.state.ledger).toHaveLength(1);
    expect(result.state.queue).toHaveLength(2);
    expect(result.state.queue.map((item) => item.type)).toEqual(['reconciliation', 'money_event']);
    expect(result.state.actionLog).toHaveLength(1);
    expect(result.state.actionLog[0]).toMatchObject({
      scope: 'bank',
      status: 'success',
      objectId: 'DL-9109',
      action: 'persist-reconciliation',
      actor: 'bank-runtime',
    });
  });

  it('does not append duplicate bank callbacks to ledger or queue', () => {
    const first = persistMoneyEvent(EMPTY_P7_PERSISTENCE_STATE, {
      event: reserveEvent,
      actor: 'bank-runtime',
      now,
    });

    const duplicate = persistMoneyEvent(first.state, {
      event: {
        ...reserveEvent,
        eventId: 'bank-event-retry-001',
        occurredAt: '2026-04-26T12:01:00Z',
      },
      actor: 'bank-runtime',
      now,
    });

    expect(duplicate.queueItem.status).toBe('duplicate');
    expect(duplicate.state.ledger).toHaveLength(1);
    expect(duplicate.state.queue).toHaveLength(2);
    expect(getQueueByDeal(duplicate.state, 'DL-9109')).toHaveLength(2);
  });

  it('keeps mismatched callbacks out of ledger and routes them to manual reconciliation', () => {
    const first = persistMoneyEvent(EMPTY_P7_PERSISTENCE_STATE, {
      event: reserveEvent,
      actor: 'bank-runtime',
      now,
    });

    const mismatch = persistMoneyEvent(first.state, {
      event: {
        ...reserveEvent,
        eventId: 'bank-event-mismatch-001',
        amount: 3_870_000,
        occurredAt: '2026-04-26T12:01:00Z',
      },
      actor: 'bank-runtime',
      now,
    });

    expect(mismatch.queueItem.status).toBe('manual_review');
    expect(mismatch.queueItem.reason).toBe('AMOUNT_MISMATCH');
    expect(mismatch.reconciliation?.state).toBe('manual_review');
    expect(mismatch.state.ledger).toHaveLength(1);
    expect(mismatch.state.ledger[0].amount).toBe(3_873_600);
    expect(getManualReconciliationQueue(mismatch.state)).toHaveLength(1);
  });

  it('routes rejected event to rejected queue item and does not mutate ledger', () => {
    const result = persistMoneyEvent(EMPTY_P7_PERSISTENCE_STATE, {
      event: {
        ...reserveEvent,
        amount: 0,
      },
      actor: 'bank-runtime',
      now,
    });

    expect(result.queueItem.status).toBe('rejected');
    expect(result.queueItem.reason).toBe('INVALID_AMOUNT');
    expect(result.state.ledger).toHaveLength(0);
    expect(result.state.queue).toHaveLength(1);
    expect(result.state.actionLog[0]).toMatchObject({
      status: 'error',
      error: 'INVALID_AMOUNT',
    });
  });

  it('projects persistence queue into deal timeline events', () => {
    const result = persistMoneyEvent(EMPTY_P7_PERSISTENCE_STATE, {
      event: reserveEvent,
      actor: 'bank-runtime',
      now,
    });

    const timeline = projectQueueToDealTimeline(result.state, 'DL-9109');

    expect(timeline).toHaveLength(2);
    expect(timeline[0]).toMatchObject({
      ts: '2026-04-26T13:00:00Z',
      actor: 'Система сверки',
      type: 'success',
    });
    expect(timeline[1]).toMatchObject({
      ts: '2026-04-26T13:00:00Z',
      actor: 'Банк',
      type: 'success',
    });
  });
});
