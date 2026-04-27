import { appendActionLogEntry, createActionLogEntry, type PlatformActionLogEntry } from './action-log';
import { appendMoneyEventOnce, reconcileMoneyEventWithLedger, type P7LedgerEntry, type P7MoneyEvent, type P7MoneyReconciliationDecision } from './money-safety';

export type P7QueueItemStatus = 'queued' | 'processed' | 'duplicate' | 'manual_review' | 'rejected';
export type P7QueueItemType = 'money_event' | 'reconciliation';

export interface P7QueueItemBase {
  readonly id: string;
  readonly type: P7QueueItemType;
  readonly dealId: string;
  readonly status: P7QueueItemStatus;
  readonly idempotencyKey: string;
  readonly createdAt: string;
  readonly processedAt?: string;
  readonly reason?: string;
}

export interface P7MoneyEventQueueItem extends P7QueueItemBase {
  readonly type: 'money_event';
  readonly event: P7MoneyEvent;
}

export interface P7ReconciliationQueueItem extends P7QueueItemBase {
  readonly type: 'reconciliation';
  readonly decision: P7MoneyReconciliationDecision;
}

export type P7PersistenceQueueItem = P7MoneyEventQueueItem | P7ReconciliationQueueItem;

export interface P7PersistenceState {
  readonly ledger: P7LedgerEntry[];
  readonly queue: P7PersistenceQueueItem[];
  readonly actionLog: PlatformActionLogEntry[];
}

export interface P7PersistMoneyEventInput {
  readonly event: P7MoneyEvent;
  readonly actor?: string;
  readonly now?: () => string;
}

export interface P7PersistMoneyEventResult {
  readonly state: P7PersistenceState;
  readonly queueItem: P7PersistenceQueueItem;
  readonly reconciliation?: P7MoneyReconciliationDecision;
}

export const EMPTY_P7_PERSISTENCE_STATE: P7PersistenceState = {
  ledger: [],
  queue: [],
  actionLog: [],
};

const at = (now?: () => string) => now?.() ?? new Date().toISOString();
const itemId = (type: P7QueueItemType, dealId: string, key: string) => `${type}:${dealId}:${key}`;

function addQueueItem(queue: readonly P7PersistenceQueueItem[], item: P7PersistenceQueueItem): P7PersistenceQueueItem[] {
  if (queue.some((entry) => entry.type === item.type && entry.idempotencyKey === item.idempotencyKey)) return [...queue];
  return [item, ...queue];
}

function addLog(state: P7PersistenceState, item: P7PersistenceQueueItem, actor: string, message: string): PlatformActionLogEntry[] {
  return appendActionLogEntry([...state.actionLog], createActionLogEntry({
    scope: 'bank',
    status: item.status === 'rejected' ? 'error' : 'success',
    objectId: item.dealId,
    action: item.type === 'money_event' ? 'persist-money-event' : 'persist-reconciliation',
    actor,
    at: item.processedAt ?? item.createdAt,
    message,
    error: item.status === 'rejected' ? item.reason : undefined,
  }));
}

function moneyItem(input: {
  event: P7MoneyEvent;
  status: P7QueueItemStatus;
  idempotencyKey: string;
  createdAt: string;
  processedAt?: string;
  reason?: string;
}): P7MoneyEventQueueItem {
  return {
    id: itemId('money_event', input.event.dealId, input.idempotencyKey),
    type: 'money_event',
    dealId: input.event.dealId,
    status: input.status,
    idempotencyKey: input.idempotencyKey,
    createdAt: input.createdAt,
    processedAt: input.processedAt,
    reason: input.reason,
    event: input.event,
  };
}

function reconciliationItem(dealId: string, decision: P7MoneyReconciliationDecision, createdAt: string): P7ReconciliationQueueItem {
  return {
    id: itemId('reconciliation', dealId, decision.idempotencyKey),
    type: 'reconciliation',
    dealId,
    status: decision.state === 'manual_review' ? 'manual_review' : 'processed',
    idempotencyKey: decision.idempotencyKey,
    createdAt,
    processedAt: createdAt,
    reason: decision.reasonCode,
    decision,
  };
}

function hasExistingMismatch(decision: P7MoneyReconciliationDecision): boolean {
  return decision.state === 'manual_review' && Boolean(decision.entry);
}

export function persistMoneyEvent(state: P7PersistenceState, input: P7PersistMoneyEventInput): P7PersistMoneyEventResult {
  const createdAt = at(input.now);
  const actor = input.actor ?? 'system';
  const preflight = reconcileMoneyEventWithLedger(state.ledger, input.event);

  if (hasExistingMismatch(preflight)) {
    const queueItem = moneyItem({
      event: input.event,
      status: 'manual_review',
      idempotencyKey: preflight.idempotencyKey,
      createdAt,
      processedAt: createdAt,
      reason: preflight.reasonCode,
    });
    const reviewItem = reconciliationItem(input.event.dealId, preflight, createdAt);
    const queue = addQueueItem(addQueueItem(state.queue, queueItem), reviewItem);
    return {
      state: {
        ledger: [...state.ledger],
        queue,
        actionLog: addLog(state, reviewItem, actor, `Manual reconciliation required: ${preflight.reasonCode}`),
      },
      queueItem,
      reconciliation: preflight,
    };
  }

  const appended = appendMoneyEventOnce(state.ledger, input.event, { at: () => createdAt });

  if (appended.status === 'rejected') {
    const queueItem = moneyItem({
      event: input.event,
      status: 'rejected',
      idempotencyKey: appended.idempotencyKey,
      createdAt,
      processedAt: createdAt,
      reason: appended.reasonCode,
    });
    return {
      state: {
        ledger: appended.ledger,
        queue: addQueueItem(state.queue, queueItem),
        actionLog: addLog(state, queueItem, actor, `Money event rejected: ${appended.reasonCode}`),
      },
      queueItem,
    };
  }

  const queueItem = moneyItem({
    event: input.event,
    status: appended.status === 'duplicate' ? 'duplicate' : 'processed',
    idempotencyKey: appended.idempotencyKey,
    createdAt,
    processedAt: createdAt,
    reason: appended.status === 'duplicate' ? 'DUPLICATE_EVENT' : undefined,
  });
  const reconciliation = appended.status === 'duplicate'
    ? preflight
    : reconcileMoneyEventWithLedger(appended.ledger, input.event);
  const reconciledItem = reconciliationItem(input.event.dealId, reconciliation, createdAt);
  const queue = addQueueItem(addQueueItem(state.queue, queueItem), reconciledItem);

  return {
    state: {
      ledger: appended.ledger,
      queue,
      actionLog: addLog(state, reconciledItem, actor, reconciliation.state === 'manual_review'
        ? `Manual reconciliation required: ${reconciliation.reasonCode}`
        : `Money event persisted and reconciled: ${input.event.dealId}`),
    },
    queueItem,
    reconciliation,
  };
}

export function getQueueByDeal(state: P7PersistenceState, dealId: string): P7PersistenceQueueItem[] {
  return state.queue.filter((item) => item.dealId === dealId);
}

export function getManualReconciliationQueue(state: P7PersistenceState): P7ReconciliationQueueItem[] {
  return state.queue.filter((item): item is P7ReconciliationQueueItem => item.type === 'reconciliation' && item.status === 'manual_review');
}

export function projectQueueToDealTimeline(state: P7PersistenceState, dealId: string) {
  return getQueueByDeal(state, dealId).map((item) => ({
    ts: item.processedAt ?? item.createdAt,
    actor: item.type === 'money_event' ? 'Банк' : 'Система сверки',
    action: item.type === 'money_event'
      ? `Денежное событие ${item.status}`
      : `Сверка ${item.status}: ${item.reason ?? item.decision.reasonCode}`,
    type: item.status === 'manual_review' || item.status === 'rejected' ? 'danger' : 'success',
  }));
}
