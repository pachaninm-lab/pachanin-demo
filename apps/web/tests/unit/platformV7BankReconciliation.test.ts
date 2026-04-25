import { describe, expect, it } from 'vitest';
import type { PlatformV7BankLedgerEntry } from '@/lib/platform-v7/bank-ledger';
import type { PlatformV7BankWebhookEvent } from '@/lib/platform-v7/bank-webhooks';
import {
  platformV7BankReconciliationAllowsRelease,
  platformV7BankReconciliationModel,
  platformV7BankReconciliationTone,
} from '@/lib/platform-v7/bank-reconciliation';

const matchedLedger: PlatformV7BankLedgerEntry[] = [
  { id: 'l1', dealId: 'DL-1', type: 'reserve', amount: 1000, status: 'confirmed', createdAt: '2026-04-25T10:00:00.000Z' },
  { id: 'l2', dealId: 'DL-1', type: 'release', amount: 1000, status: 'confirmed', createdAt: '2026-04-25T10:01:00.000Z' },
];

const appliedWebhook: PlatformV7BankWebhookEvent[] = [
  { id: 'w1', dealId: 'DL-1', type: 'release_confirmed', status: 'applied', externalRef: 'ext-1', amount: 1000, receivedAt: '2026-04-25T10:02:00.000Z', retryCount: 0 },
];

describe('platform-v7 bank reconciliation', () => {
  it('allows release when ledger and webhooks are matched', () => {
    const model = platformV7BankReconciliationModel('DL-1', matchedLedger, appliedWebhook);

    expect(model.status).toBe('matched');
    expect(model.mismatchReason).toBeNull();
    expect(platformV7BankReconciliationAllowsRelease(model)).toBe(true);
    expect(platformV7BankReconciliationTone(model)).toBe('success');
  });

  it('marks pending reconciliation when webhook is retryable', () => {
    const model = platformV7BankReconciliationModel('DL-1', matchedLedger, [
      { ...appliedWebhook[0]!, status: 'retryable', retryCount: 1 },
    ]);

    expect(model.status).toBe('pending');
    expect(model.pendingItems).toBe(1);
    expect(platformV7BankReconciliationAllowsRelease(model)).toBe(false);
    expect(platformV7BankReconciliationTone(model)).toBe('warning');
  });

  it('marks failed reconciliation when webhook is rejected', () => {
    const model = platformV7BankReconciliationModel('DL-1', matchedLedger, [
      { ...appliedWebhook[0]!, status: 'rejected' },
    ]);

    expect(model.status).toBe('failed');
    expect(model.failedItems).toBe(1);
    expect(platformV7BankReconciliationTone(model)).toBe('danger');
  });
});
