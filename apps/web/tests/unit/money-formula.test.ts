import { describe, expect, it } from 'vitest';
import {
  calculateDealMoneyAllocationAmount,
  calculateDealMoneyFormulaAmount,
  isDealMoneyStateBalanced,
  selectDealExecutionCase,
  selectDealMoneyState,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

describe('money-formula', () => {
  it('explains DL-9106 reserve from price times volume through one MoneyState', () => {
    const executionCase = selectDealExecutionCase('DL-9106');
    const money = selectDealMoneyState('DL-9106');

    expect(executionCase).toBeDefined();
    expect(money).toBeDefined();
    if (!executionCase || !money) return;

    const goodsAmount = executionCase.price.pricePerTon * executionCase.commodity.volumeDeclaredTons;

    expect(money.goodsAmount).toBe(goodsAmount);
    expect(calculateDealMoneyFormulaAmount(money)).toBe(money.reserveAmount);
    expect(money.reserveAmount).toBe(executionCase.price.reserveAmount);
    expect(money.calculationFormula).toContain('16 080 ₽/т × 600 т');
    expect(money.calculationFormula).toContain('резерв 9 648 000 ₽');
  });

  it('allocates the full reserve without unexplained money gaps', () => {
    const money = selectDealMoneyState('DL-9106');
    expect(money).toBeDefined();
    if (!money) return;

    expect(calculateDealMoneyAllocationAmount(money)).toBe(money.reserveAmount);
    expect(isDealMoneyStateBalanced(money)).toBe(true);
    expect(money.readyToReleaseAmount).toBe(0);
    expect(money.releasedAmount).toBe(0);
    expect(money.manualReviewAmount).toBe(money.reserveAmount);
  });

  it('keeps bank wording in external-confirmation terms', () => {
    const money = selectDealMoneyState('DL-9106');
    expect(money).toBeDefined();
    if (!money) return;

    const fakeReleaseCopy = ['платформа', 'выпустила'].join(' ');
    const fakeGuaranteeCopy = ['деньги', 'гарантированы'].join(' ');

    expect(money.bankStatus).toContain('ожидает подтверждения банка');
    expect(money.bankStatus).not.toContain(fakeReleaseCopy);
    expect(money.bankStatus).not.toContain(fakeGuaranteeCopy);
    expect(money.reconciliationStatus).toBe('awaiting_bank_event');
  });
});
