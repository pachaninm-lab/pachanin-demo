import { describe, expect, it } from 'vitest';
import { openMoneyReconciliationAction } from '@/lib/platform-v7/money-safety-actions';
import type { P7MoneyReconciliationDecision } from '@/lib/platform-v7/money-safety';

const reviewDecision: P7MoneyReconciliationDecision = {
  state: 'manual_review',
  reasonCode: 'AMOUNT_MISMATCH',
  action: 'block_release_and_reconcile',
  idempotencyKey: 'money:dl-9115:reserve_confirmed:sber_safe_deals:sber-op-003:rub:387000000',
};

describe('platform-v7 money safety actions', () => {
  it('creates bank-operator review action on mismatch', async () => {
    const result = await openMoneyReconciliationAction({
      dealId: 'DL-9115',
      decision: reviewDecision,
      actor: 'bank-operator',
      at: () => '2026-04-26T13:05:00Z',
    });

    expect(result.phase).toBe('success');
    expect(result.result?.releaseBlocked).toBe(true);
    expect(result.result?.nextOwner).toBe('bank_operator');
    expect(result.log).toHaveLength(2);
    expect(result.log[0]?.status).toBe('started');
    expect(result.log[1]?.status).toBe('success');
    expect(result.log[1]?.scope).toBe('bank');
    expect(result.log[1]?.objectId).toBe('DL-9115');
    expect(result.log[1]?.action).toBe('money-reconciliation-manual-review');
  });
});
