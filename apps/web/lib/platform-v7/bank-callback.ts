// PR-3 Bank callback / reconciliation — доменный слой обработки банковского
// ответного события (webhook/callback) и сверки с ожиданием платформы.
//
// Принцип: первичный ответ адаптера = pending; деньги подтверждаются ТОЛЬКО
// ответным callback-ом банка после сверки. Дубликат не приводит к повторному
// выпуску; несовпадение суммы/валюты/сделки и таймаут уводят в ручную проверку.
// Чистая логика без HTTP — реальный webhook-роут (owner-side) вызывает эти
// функции и маршрутизирует исход в application-service.handleBankEvent.

import type { P7BankConfirmationPath } from './bank-basis';

export type P7BankCallbackStatus = 'released' | 'refunded' | 'held' | 'rejected' | 'failed' | 'pending';

export interface P7BankCallbackEvent {
  readonly bankEventId: string;
  readonly dealId: string;
  readonly status: P7BankCallbackStatus;
  readonly amount: number;
  readonly currency: 'RUB';
  readonly bankReference: string;
  readonly occurredAt: string;
  readonly correlationId?: string;
}

export type P7BankCallbackNormalizeResult =
  | { readonly ok: true; readonly event: P7BankCallbackEvent }
  | { readonly ok: false; readonly code: 'INVALID_CALLBACK'; readonly reason: string };

const VALID_STATUSES: ReadonlySet<string> = new Set(['released', 'refunded', 'held', 'rejected', 'failed', 'pending']);

export function p7NormalizeBankCallback(raw: unknown): P7BankCallbackNormalizeResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, code: 'INVALID_CALLBACK', reason: 'Callback payload is not an object.' };
  }
  const r = raw as Record<string, unknown>;
  const bankEventId = typeof r.bankEventId === 'string' ? r.bankEventId : typeof r.id === 'string' ? r.id : '';
  const dealId = typeof r.dealId === 'string' ? r.dealId : '';
  const status = typeof r.status === 'string' ? r.status : '';
  const amount = typeof r.amount === 'number' ? r.amount : Number(r.amount);
  if (!bankEventId) return { ok: false, code: 'INVALID_CALLBACK', reason: 'Missing bankEventId.' };
  if (!dealId) return { ok: false, code: 'INVALID_CALLBACK', reason: 'Missing dealId.' };
  if (!VALID_STATUSES.has(status)) return { ok: false, code: 'INVALID_CALLBACK', reason: `Unknown status: ${status || '(empty)'}.` };
  if (!Number.isFinite(amount)) return { ok: false, code: 'INVALID_CALLBACK', reason: 'Missing or non-numeric amount.' };
  return {
    ok: true,
    event: {
      bankEventId,
      dealId,
      status: status as P7BankCallbackStatus,
      amount,
      currency: (r.currency === 'RUB' || r.currency === undefined ? 'RUB' : 'RUB'),
      bankReference: typeof r.bankReference === 'string' ? r.bankReference : bankEventId,
      occurredAt: typeof r.occurredAt === 'string' ? r.occurredAt : new Date(0).toISOString(),
      correlationId: typeof r.correlationId === 'string' ? r.correlationId : undefined,
    },
  };
}

export function p7MapCallbackStatusToPath(status: P7BankCallbackStatus): P7BankConfirmationPath | null {
  switch (status) {
    case 'released': return 'release';
    case 'refunded': return 'refund';
    case 'held': return 'hold';
    case 'rejected':
    case 'failed': return 'reject';
    case 'pending': return null;
    default: return null;
  }
}

export interface P7BankReconciliationExpectation {
  readonly dealId: string;
  readonly expectedAmount: number;
  readonly currency: 'RUB';
  readonly processedBankEventIds: readonly string[];
}

export type P7BankReconciliationAction = 'confirm' | 'duplicate' | 'manual_review' | 'reject';

export interface P7BankReconciliationOutcome {
  readonly action: P7BankReconciliationAction;
  readonly path: P7BankConfirmationPath | null;
  readonly code: string;
  readonly reason: string;
}

// Пути, двигающие деньги (требуют точной сверки суммы).
const MONEY_MOVING_PATHS: ReadonlySet<P7BankConfirmationPath> = new Set(['release', 'refund']);

export function p7ReconcileBankCallback(
  event: P7BankCallbackEvent,
  expectation: P7BankReconciliationExpectation,
): P7BankReconciliationOutcome {
  // Дубликат: событие уже обработано — никакого повторного выпуска.
  if (expectation.processedBankEventIds.includes(event.bankEventId)) {
    return { action: 'duplicate', path: null, code: 'DUPLICATE_BANK_EVENT', reason: 'Bank event already processed; no double release.' };
  }
  // Несовпадение сделки — в ручную проверку, не подтверждаем.
  if (event.dealId !== expectation.dealId) {
    return { action: 'manual_review', path: 'manual_review', code: 'DEAL_MISMATCH', reason: `Callback deal ${event.dealId} != expected ${expectation.dealId}.` };
  }
  if (event.currency !== expectation.currency) {
    return { action: 'manual_review', path: 'manual_review', code: 'CURRENCY_MISMATCH', reason: 'Callback currency does not match expectation.' };
  }
  const path = p7MapCallbackStatusToPath(event.status);
  if (path === null) {
    return { action: 'manual_review', path: 'manual_review', code: 'NON_TERMINAL_STATUS', reason: `Status ${event.status} is not a terminal confirmation.` };
  }
  // Для движений денег сумма обязана совпасть с ожиданием.
  if (MONEY_MOVING_PATHS.has(path) && event.amount !== expectation.expectedAmount) {
    return { action: 'manual_review', path: 'manual_review', code: 'AMOUNT_MISMATCH', reason: `Callback amount ${event.amount} != expected ${expectation.expectedAmount}.` };
  }
  if (path === 'reject') {
    return { action: 'reject', path: 'reject', code: 'OK', reason: 'Bank rejected the operation.' };
  }
  return { action: 'confirm', path, code: 'OK', reason: `Bank confirmed ${path}.` };
}

// Retry/timeout для исходящей сверки (когда callback не пришёл вовремя).
export interface P7BankRetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly timeoutMs: number;
}

export const P7_DEFAULT_BANK_RETRY: P7BankRetryPolicy = { maxAttempts: 5, baseDelayMs: 2000, timeoutMs: 15 * 60 * 1000 };

export function p7BankCallbackBackoffMs(attempt: number, policy: P7BankRetryPolicy = P7_DEFAULT_BANK_RETRY): number {
  const safeAttempt = Math.max(1, attempt);
  return policy.baseDelayMs * 2 ** (safeAttempt - 1);
}

export function p7ShouldRetryBankReconciliation(attempt: number, elapsedMs: number, policy: P7BankRetryPolicy = P7_DEFAULT_BANK_RETRY): boolean {
  return attempt < policy.maxAttempts && elapsedMs < policy.timeoutMs;
}

// Истёкшее ожидание callback-а → ручная проверка (а не молчаливый выпуск).
export function p7BankReconciliationTimedOut(elapsedMs: number, policy: P7BankRetryPolicy = P7_DEFAULT_BANK_RETRY): P7BankReconciliationOutcome | null {
  if (elapsedMs >= policy.timeoutMs) {
    return { action: 'manual_review', path: 'manual_review', code: 'CALLBACK_TIMEOUT', reason: 'Bank callback not received within timeout; manual reconciliation required.' };
  }
  return null;
}
