import type { PlatformActionLogEntry } from './action-log';
import type { P7LedgerEntry } from './money-safety';
import type { P7PersistenceQueueItem, P7PersistenceState } from './persistence-queue';

export type P7PersistenceSnapshotSource = 'controlled-pilot' | 'api' | 'database' | 'test';

export type P7PersistenceValidationIssueCode =
  | 'LEDGER_DUPLICATE_IDEMPOTENCY_KEY'
  | 'QUEUE_DUPLICATE_IDEMPOTENCY_KEY'
  | 'QUEUE_ITEM_WITHOUT_DEAL_ID'
  | 'MONEY_EVENT_QUEUE_DEAL_MISMATCH'
  | 'RECONCILIATION_QUEUE_DEAL_MISMATCH'
  | 'MANUAL_REVIEW_WITHOUT_REASON'
  | 'ACTION_LOG_WITHOUT_OBJECT_ID';

export interface P7PersistenceValidationIssue {
  readonly code: P7PersistenceValidationIssueCode;
  readonly objectId: string;
  readonly message: string;
}

export interface P7PersistenceHealth {
  readonly status: 'healthy' | 'review' | 'error';
  readonly issueCount: number;
  readonly manualReviewCount: number;
  readonly rejectedCount: number;
}

export interface P7PersistenceSnapshot {
  readonly schemaVersion: 'p7.persistence.v1';
  readonly generatedAt: string;
  readonly source: P7PersistenceSnapshotSource;
  readonly state: {
    readonly ledger: P7LedgerEntry[];
    readonly queue: P7PersistenceQueueItem[];
    readonly actionLog: PlatformActionLogEntry[];
  };
  readonly health: P7PersistenceHealth;
}

function duplicateKeys(items: readonly { idempotencyKey: string }[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of items) {
    if (seen.has(item.idempotencyKey)) duplicates.add(item.idempotencyKey);
    seen.add(item.idempotencyKey);
  }

  return [...duplicates];
}

export function validatePersistenceState(state: P7PersistenceState): P7PersistenceValidationIssue[] {
  const issues: P7PersistenceValidationIssue[] = [];

  for (const key of duplicateKeys(state.ledger)) {
    issues.push({
      code: 'LEDGER_DUPLICATE_IDEMPOTENCY_KEY',
      objectId: key,
      message: `Duplicate ledger idempotency key: ${key}`,
    });
  }

  const queueIdentityKeys = state.queue.map((item) => ({ idempotencyKey: `${item.type}:${item.idempotencyKey}` }));
  for (const key of duplicateKeys(queueIdentityKeys)) {
    issues.push({
      code: 'QUEUE_DUPLICATE_IDEMPOTENCY_KEY',
      objectId: key,
      message: `Duplicate queue idempotency key: ${key}`,
    });
  }

  for (const item of state.queue) {
    if (!item.dealId.trim()) {
      issues.push({
        code: 'QUEUE_ITEM_WITHOUT_DEAL_ID',
        objectId: item.id,
        message: `Queue item has no dealId: ${item.id}`,
      });
    }

    if (item.type === 'money_event' && item.event.dealId !== item.dealId) {
      issues.push({
        code: 'MONEY_EVENT_QUEUE_DEAL_MISMATCH',
        objectId: item.id,
        message: `Money event dealId ${item.event.dealId} differs from queue dealId ${item.dealId}`,
      });
    }

    if (item.type === 'reconciliation' && item.decision.entry && item.decision.entry.dealId !== item.dealId) {
      issues.push({
        code: 'RECONCILIATION_QUEUE_DEAL_MISMATCH',
        objectId: item.id,
        message: `Reconciliation entry dealId ${item.decision.entry.dealId} differs from queue dealId ${item.dealId}`,
      });
    }

    if (item.status === 'manual_review' && !item.reason?.trim()) {
      issues.push({
        code: 'MANUAL_REVIEW_WITHOUT_REASON',
        objectId: item.id,
        message: `Manual review item has no reason: ${item.id}`,
      });
    }
  }

  for (const entry of state.actionLog) {
    if (!entry.objectId.trim()) {
      issues.push({
        code: 'ACTION_LOG_WITHOUT_OBJECT_ID',
        objectId: entry.id,
        message: `Action log entry has no objectId: ${entry.id}`,
      });
    }
  }

  return issues;
}

export function getPersistenceHealth(state: P7PersistenceState): P7PersistenceHealth {
  const issues = validatePersistenceState(state);
  const manualReviewCount = state.queue.filter((item) => item.status === 'manual_review').length;
  const rejectedCount = state.queue.filter((item) => item.status === 'rejected').length;

  return {
    status: issues.length > 0 || rejectedCount > 0 ? 'error' : manualReviewCount > 0 ? 'review' : 'healthy',
    issueCount: issues.length,
    manualReviewCount,
    rejectedCount,
  };
}

export function buildPersistenceSnapshot(
  state: P7PersistenceState,
  input: { source?: P7PersistenceSnapshotSource; now?: () => string } = {},
): P7PersistenceSnapshot {
  return {
    schemaVersion: 'p7.persistence.v1',
    generatedAt: input.now?.() ?? new Date().toISOString(),
    source: input.source ?? 'controlled-pilot',
    state: {
      ledger: [...state.ledger],
      queue: [...state.queue],
      actionLog: [...state.actionLog],
    },
    health: getPersistenceHealth(state),
  };
}

export function hydratePersistenceSnapshot(snapshot: P7PersistenceSnapshot): P7PersistenceState {
  if (snapshot.schemaVersion !== 'p7.persistence.v1') {
    throw new Error(`Unsupported persistence snapshot schema: ${snapshot.schemaVersion}`);
  }

  return {
    ledger: [...snapshot.state.ledger],
    queue: [...snapshot.state.queue],
    actionLog: [...snapshot.state.actionLog],
  };
}
