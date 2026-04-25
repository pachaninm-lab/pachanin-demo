import { describe, expect, it } from 'vitest';
import type { PlatformV7BankReconciliationModel } from '@/lib/platform-v7/bank-reconciliation';
import {
  platformV7BankManualReviewCaseIsOverdue,
  platformV7BankManualReviewDecision,
  platformV7BankManualReviewModel,
  platformV7BankManualReviewPriority,
} from '@/lib/platform-v7/bank-manual-review';

const matchedReconciliation: PlatformV7BankReconciliationModel = {
  dealId: 'DL-1',
  status: 'matched',
  ledgerBalance: 0,
  ledgerBlocksRelease: false,
  webhookBlocksReconciliation: false,
  pendingItems: 0,
  failedItems: 0,
  mismatchReason: null,
};

describe('platform-v7 bank manual review', () => {
  it('does not require review for matched reconciliation below limit', () => {
    const model = platformV7BankManualReviewModel({
      reconciliation: matchedReconciliation,
      releaseAmount: 1000,
      releaseLimit: 5000,
      disputeOpen: false,
      amlFlag: false,
    });

    expect(model.requiresReview).toBe(false);
    expect(model.reasons).toEqual([]);
    expect(model.priority).toBe('low');
    expect(model.recommendedDecision).toBe('approve');
  });

  it('requires critical review for failed webhook or AML flag', () => {
    const model = platformV7BankManualReviewModel({
      reconciliation: { ...matchedReconciliation, status: 'failed', failedItems: 1, mismatchReason: 'failed' },
      releaseAmount: 1000,
      releaseLimit: 5000,
      disputeOpen: false,
      amlFlag: true,
    });

    expect(model.requiresReview).toBe(true);
    expect(model.priority).toBe('critical');
    expect(model.recommendedDecision).toBe('escalate');
    expect(model.reasons).toEqual(['webhook-failed', 'aml-review']);
  });

  it('maps priority and decision from reasons', () => {
    expect(platformV7BankManualReviewPriority(['ledger-mismatch'])).toBe('high');
    expect(platformV7BankManualReviewPriority(['webhook-pending'])).toBe('medium');
    expect(platformV7BankManualReviewDecision(['active-dispute'])).toBe('hold');
    expect(platformV7BankManualReviewDecision([])).toBe('approve');
  });

  it('detects overdue manual review cases', () => {
    expect(platformV7BankManualReviewCaseIsOverdue({
      id: 'MR-1',
      dealId: 'DL-1',
      reason: 'ledger-mismatch',
      priority: 'high',
      amount: 1000,
      assignedTo: 'bank-operator',
      openedAt: '2026-04-25T10:00:00.000Z',
      slaHours: 2,
    }, '2026-04-25T13:00:01.000Z')).toBe(true);
  });
});
