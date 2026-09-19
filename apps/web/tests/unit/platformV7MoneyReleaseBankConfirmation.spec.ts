import { describe, expect, it } from 'vitest';
import { calculateMoneyProjection, createReleaseIdempotencyKey } from '@/lib/platform-v7/grain-execution/automation/money-release-engine';

describe('platform-v7 money release bank confirmation', () => {
  it('blocks money release while external bank confirmation is still pending', () => {
    const projection = calculateMoneyProjection({
      dealId: 'DL-GRAIN-450',
      grossDealAmount: 1_000,
      reservedAmount: 1_000,
      bankConfirmationStatus: 'requested',
      bankConfirmationId: 'BANK-EVENT-1',
    });

    expect(projection.readyToReleaseAmount.value).toBe(1_000);
    expect(projection.releaseAllowed).toBe(false);
    expect(projection.releaseBlockedReasons).toHaveLength(1);
    expect(projection.releaseBlockedReasons[0]).toMatchObject({
      id: 'bank-release-DL-GRAIN-450-requested',
      type: 'money',
      severity: 'warning',
      blocks: 'money_release',
      responsibleRole: 'bank',
      relatedEntityType: 'bank_release_confirmation',
      relatedEntityId: 'BANK-EVENT-1',
    });
    expect(projection.releaseBlockedReasons[0]?.description).toContain('Платформа не имитирует ответ банка');
  });

  it('moves all releasable money into manual review when bank confirmation mismatches', () => {
    const projection = calculateMoneyProjection({
      dealId: 'DL-GRAIN-450',
      grossDealAmount: 1_000,
      reservedAmount: 1_000,
      releasedAmount: 100,
      bankConfirmationStatus: 'mismatch',
      bankConfirmationId: 'BANK-EVENT-MISMATCH',
    });

    expect(projection.releaseAllowed).toBe(false);
    expect(projection.readyToReleaseAmount.value).toBe(0);
    expect(projection.manualReviewAmount.value).toBe(900);
    expect(projection.releaseBlockedReasons[0]).toMatchObject({
      id: 'bank-release-DL-GRAIN-450-mismatch',
      severity: 'critical',
      title: 'Ответ банка не сходится с системой',
    });
  });

  it('allows release only when bank confirmation is confirmed and no other blockers exist', () => {
    const projection = calculateMoneyProjection({
      dealId: 'DL-GRAIN-450',
      grossDealAmount: 1_000,
      reservedAmount: 1_000,
      bankConfirmationStatus: 'confirmed',
    });

    expect(projection.releaseAllowed).toBe(true);
    expect(projection.readyToReleaseAmount.value).toBe(1_000);
    expect(projection.releaseBlockedReasons).toHaveLength(0);
  });

  it('creates stable idempotency keys for repeated money release attempts', () => {
    const firstKey = createReleaseIdempotencyKey({
      dealId: 'DL-GRAIN-450',
      operation: 'release',
      amount: 1_000,
      currency: 'RUB',
      counterpartyId: 'seller-1',
    });
    const secondKey = createReleaseIdempotencyKey({
      dealId: 'DL-GRAIN-450',
      operation: 'release',
      amount: 1_000,
      currency: 'RUB',
      counterpartyId: 'seller-1',
    });
    const differentAmountKey = createReleaseIdempotencyKey({
      dealId: 'DL-GRAIN-450',
      operation: 'release',
      amount: 1_001,
      currency: 'RUB',
      counterpartyId: 'seller-1',
    });

    expect(firstKey).toBe('platform-v7:DL-GRAIN-450:release:seller-1:RUB:100000');
    expect(secondKey).toBe(firstKey);
    expect(differentAmountKey).not.toBe(firstKey);
  });
});
