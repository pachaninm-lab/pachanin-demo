import { CALLBACKS, DEALS } from './data';
import {
  EMPTY_P7_PERSISTENCE_STATE,
  getManualReconciliationQueue,
  persistMoneyEvent,
  projectQueueToDealTimeline,
  type P7PersistenceState,
} from '../platform-v7/persistence-queue';
import type { P7MoneyEvent } from '../platform-v7/money-safety';

function eventFor(dealId: string, input: Partial<P7MoneyEvent> & Pick<P7MoneyEvent, 'type' | 'amount' | 'providerOperationId'>): P7MoneyEvent {
  return {
    dealId,
    eventId: input.eventId ?? `${dealId}-${input.type}-${input.providerOperationId}`,
    type: input.type,
    amount: input.amount,
    currency: input.currency ?? 'RUB',
    provider: input.provider ?? 'sber_safe_deals',
    providerOperationId: input.providerOperationId,
    occurredAt: input.occurredAt ?? '2026-04-26T12:00:00Z',
    payloadHash: input.payloadHash ?? `${dealId}:${input.type}:${input.providerOperationId}:${input.amount}`,
  };
}

export function buildStableV7rPersistenceState(): P7PersistenceState {
  let state = EMPTY_P7_PERSISTENCE_STATE;

  const dl9103 = CALLBACKS.find((callback) => callback.dealId === 'DL-9103');
  if (dl9103?.amountRub) {
    state = persistMoneyEvent(state, {
      event: eventFor('DL-9103', {
        type: 'reserve_confirmed',
        amount: dl9103.amountRub,
        providerOperationId: dl9103.id,
        eventId: `${dl9103.id}-reserve`,
      }),
      actor: 'bank-runtime',
      now: () => '2026-04-26T12:10:00Z',
    }).state;
  }

  const dl9109 = DEALS.find((deal) => deal.id === 'DL-9109');
  if (dl9109) {
    state = persistMoneyEvent(state, {
      event: eventFor('DL-9109', {
        type: 'reserve_confirmed',
        amount: dl9109.reservedAmount,
        providerOperationId: 'DL-9109-reserve',
        eventId: 'DL-9109-reserve-confirmed',
      }),
      actor: 'bank-runtime',
      now: () => '2026-04-26T12:12:00Z',
    }).state;
  }

  const dl9102 = CALLBACKS.find((callback) => callback.dealId === 'DL-9102');
  if (dl9102?.amountRub) {
    state = persistMoneyEvent(state, {
      event: eventFor('DL-9102', {
        type: 'hold_applied',
        amount: dl9102.amountRub,
        providerOperationId: dl9102.id,
        eventId: `${dl9102.id}-hold-base`,
        payloadHash: 'DL-9102:CB-442:hold:base',
      }),
      actor: 'bank-runtime',
      now: () => '2026-04-26T12:14:00Z',
    }).state;

    state = persistMoneyEvent(state, {
      event: eventFor('DL-9102', {
        type: 'hold_applied',
        amount: Math.max(dl9102.amountRub - 3_000, 1),
        providerOperationId: dl9102.id,
        eventId: `${dl9102.id}-hold-bank-retry`,
        payloadHash: 'DL-9102:CB-442:hold:mismatch',
        occurredAt: '2026-04-26T12:16:00Z',
      }),
      actor: 'bank-runtime',
      now: () => '2026-04-26T12:16:30Z',
    }).state;
  }

  return state;
}

export function buildStableV7rPersistenceSummary() {
  const state = buildStableV7rPersistenceState();
  const manualQueue = getManualReconciliationQueue(state);
  const dealIds = Array.from(new Set(state.queue.map((item) => item.dealId)));

  return {
    state,
    totalLedgerEntries: state.ledger.length,
    totalQueueItems: state.queue.length,
    manualReviewItems: manualQueue.length,
    processedItems: state.queue.filter((item) => item.status === 'processed').length,
    duplicateItems: state.queue.filter((item) => item.status === 'duplicate').length,
    rejectedItems: state.queue.filter((item) => item.status === 'rejected').length,
    timelineEvents: dealIds.flatMap((dealId) => projectQueueToDealTimeline(state, dealId)).length,
    manualQueue,
  };
}
