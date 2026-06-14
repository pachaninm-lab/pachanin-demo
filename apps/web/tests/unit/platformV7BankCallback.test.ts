import { describe, expect, it } from 'vitest';
import {
  P7_DEFAULT_BANK_RETRY,
  p7BankCallbackBackoffMs,
  p7BankReconciliationTimedOut,
  p7MapCallbackStatusToPath,
  p7NormalizeBankCallback,
  p7ReconcileBankCallback,
  p7ShouldRetryBankReconciliation,
  type P7BankCallbackEvent,
  type P7BankReconciliationExpectation,
} from '@/lib/platform-v7/bank-callback';

const expectation: P7BankReconciliationExpectation = {
  dealId: 'DL-9106',
  expectedAmount: 9_648_000,
  currency: 'RUB',
  processedBankEventIds: ['evt-old'],
};

function event(over: Partial<P7BankCallbackEvent> = {}): P7BankCallbackEvent {
  return {
    bankEventId: 'evt-1',
    dealId: 'DL-9106',
    status: 'released',
    amount: 9_648_000,
    currency: 'RUB',
    bankReference: 'ref-1',
    occurredAt: '2026-05-24T10:00:00.000Z',
    ...over,
  };
}

describe('PR-3 bank callback / reconciliation', () => {
  it('normalizes a valid callback and rejects malformed payloads', () => {
    const ok = p7NormalizeBankCallback({ bankEventId: 'e1', dealId: 'DL-1', status: 'released', amount: 100 });
    expect(ok.ok).toBe(true);
    expect(p7NormalizeBankCallback(null).ok).toBe(false);
    expect(p7NormalizeBankCallback({ dealId: 'DL-1', status: 'released', amount: 100 }).ok).toBe(false); // no eventId
    expect(p7NormalizeBankCallback({ bankEventId: 'e', dealId: 'DL-1', status: 'weird', amount: 1 }).ok).toBe(false);
    expect(p7NormalizeBankCallback({ bankEventId: 'e', dealId: 'DL-1', status: 'released', amount: 'x' }).ok).toBe(false);
  });

  it('maps statuses to confirmation paths', () => {
    expect(p7MapCallbackStatusToPath('released')).toBe('release');
    expect(p7MapCallbackStatusToPath('refunded')).toBe('refund');
    expect(p7MapCallbackStatusToPath('held')).toBe('hold');
    expect(p7MapCallbackStatusToPath('rejected')).toBe('reject');
    expect(p7MapCallbackStatusToPath('pending')).toBeNull();
  });

  it('confirms a matching release callback', () => {
    const outcome = p7ReconcileBankCallback(event(), expectation);
    expect(outcome.action).toBe('confirm');
    expect(outcome.path).toBe('release');
  });

  it('treats an already-processed event as duplicate (no double release)', () => {
    const outcome = p7ReconcileBankCallback(event({ bankEventId: 'evt-old' }), expectation);
    expect(outcome.action).toBe('duplicate');
    expect(outcome.path).toBeNull();
  });

  it('sends amount/currency/deal mismatch to manual review, never confirms money movement', () => {
    expect(p7ReconcileBankCallback(event({ amount: 1 }), expectation).action).toBe('manual_review');
    expect(p7ReconcileBankCallback(event({ dealId: 'DL-OTHER' }), expectation).action).toBe('manual_review');
    expect(p7ReconcileBankCallback(event({ status: 'pending' }), expectation).action).toBe('manual_review');
  });

  it('routes a rejected callback to the reject path', () => {
    const outcome = p7ReconcileBankCallback(event({ status: 'rejected' }), expectation);
    expect(outcome.action).toBe('reject');
    expect(outcome.path).toBe('reject');
  });

  it('provides retry/backoff and timeout→manual-review semantics', () => {
    expect(p7BankCallbackBackoffMs(1)).toBe(P7_DEFAULT_BANK_RETRY.baseDelayMs);
    expect(p7BankCallbackBackoffMs(3)).toBe(P7_DEFAULT_BANK_RETRY.baseDelayMs * 4);
    expect(p7ShouldRetryBankReconciliation(1, 1000)).toBe(true);
    expect(p7ShouldRetryBankReconciliation(P7_DEFAULT_BANK_RETRY.maxAttempts, 1000)).toBe(false);
    expect(p7BankReconciliationTimedOut(1000)).toBeNull();
    expect(p7BankReconciliationTimedOut(P7_DEFAULT_BANK_RETRY.timeoutMs)?.action).toBe('manual_review');
  });
});
