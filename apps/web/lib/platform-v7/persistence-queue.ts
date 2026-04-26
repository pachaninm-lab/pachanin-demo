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

function nowOrInput(now?: () => string): string {
  return now?.() ?? new Date().toISOString();
}

function queueItemId(type: P7QueueItemType, dealId: string, idempotencyKey: string): string {
  return `${type}:${dealId}:${idempotencyKey}`;
}

function appendQueueItem(queue: readonly P7PersistenceQueueItem[], item: P7PersistenceQueueItem): P7PersistenceQueueItem[] {
  const existing = queue.find((entry) => entry.idempotencyKey === item.idempotencyKey && entry.type === item.type);
  if (existing) return [...queue];
  return [item, ...queue];
}

function appendBankActionLog(state: P7PersistenceState, item: P7PersistenceQueueItem, actor: string, message: string): PlatformActionLogEntry[] {
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

function buildMoneyQueueItem(input: {
  event: P7MoneyEvent;
  status: P7QueueItemStatus;
  idempotencyKey: string;
  createdAt: string;
  processedAt?: string;
  reason?: string;
}): P7MoneyEventQueueItem {
  return {
    id: queueItemId('money_event', input.event.dealId, input.idempotencyKey),
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

function buildReconciliationQueueItem(input: {
  dealId: string;
  decision: P7MoneyReconciliationDecision;
  createdAt: string;
  processedAt?: string;
}): P7ReconciliationQueueItem {
  return {
    id: queueItemId('reconciliation', input.dealId, input.decision.idempotencyKey),
    type: 'reconciliation',
    dealId: input.dealId,
    status: input.decision.state === 'manual_review' ? 'manual_review' : 'processed',
    idempotencyKey: input.decision.idempotencyKey,
    createdAt: input.createdAt,
    processedAt: input.processedAt,
    reason: input.decision.reasonCode,
    decision: input.decision,
  };
}

export function persistMoneyEvent(state: P7PersistenceState, input: P7PersistMoneyEventInput): P7PersistMoneyEventResult {
  const createdAt = nowOrInput(input.now);
  const appendResult = appendMoneyEventOnce(state.ledger, input.event, { at: () => createdAt });

  if (appendResult.status === 'rejected') {
    const queueItem = buildMoneyQueueItem({
      event: input.event,
      status: 'rejected',
      idempotencyKey: appendResult.idempotencyKey,
      createdAt,
      processedAt: createdAt,
      reason: appendResult.reasonCode,
    });

    const nextState = {
      ledger: appendResult.ledger,
      queue: appendQueueItem(state.queue, queueItem),
      actionLog: appendBankActionLog(state, queueItem, input.actor ?? 'system', `Money event rejected: ${appendResult.reasonCode}`),
    };

    return { state: nextState, queueItem };
  }

  const queueItem = buildMoneyQueueItem({
    event: input.event,
    status: appendResult.status === 'duplicate' ? 'duplicate' : 'processed',
    idempotencyKey: appendResult.idempotencyKey,
    createdAt,
    processedAt: createdAt,
    reason: appendResult.status === 'duplicate' ? 'DUPLICATE_EVENT' : undefined,
  });

  const reconciliation = reconcileMoneyEventWithLedger(appendResult.ledger, input.event);
  const reconciliationItem = buildReconciliationQueueItem({
    dealId: input.event.dealId,
    decision: reconciliation,
    createdAt,
    processedAt: createdAt,
  });

  const queueWithMoney = appendQueueItem(state.queue, queueItem);
  const queueWithReconciliation = appendQueueItem(queueWithMoney, reconciliationItem);
  const nextState = {
    ledger: appendResult.ledger,
    queue: queueWithReconciliation,
    actionLog: appendBankActionLog(state, reconciliationItem, input.actor ?? 'system', reconciliation.state === 'manual_review'
      ? `Manual reconciliation required: ${reconciliation.reasonCode}`
      : `Money event persisted and reconciled: ${input.event.dealId}`),
  };

  return { state: nextState, queueItem, reconciliation };
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
