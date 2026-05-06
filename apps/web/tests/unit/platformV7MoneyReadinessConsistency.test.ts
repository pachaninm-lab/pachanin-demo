import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_EXECUTION_SOURCE,
  canRequestMoneyRelease,
  executionBlockers,
  executionSummary,
  expectedDealAmountRub,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

describe('platform-v7 money readiness consistency', () => {
  it('keeps reserved money equal to deal volume times price', () => {
    const { deal, money } = PLATFORM_V7_EXECUTION_SOURCE;

    expect(expectedDealAmountRub()).toBe(deal.volumeTons * deal.priceRubPerTon);
    expect(money.reservedRub).toBe(expectedDealAmountRub());
  });

  it('blocks money release while bank, documents or logistics gates are not ready', () => {
    const { readiness } = PLATFORM_V7_EXECUTION_SOURCE;

    expect(readiness.bank.status).not.toBe('готово');
    expect(readiness.documents.status).not.toBe('готово');
    expect(readiness.logistics.status).not.toBe('готово');
    expect(canRequestMoneyRelease()).toBe(false);
  });

  it('keeps release candidate at zero when release is not allowed', () => {
    const { money } = PLATFORM_V7_EXECUTION_SOURCE;

    expect(canRequestMoneyRelease()).toBe(false);
    expect(money.releaseCandidateRub).toBe(0);
  });

  it('does not double-count held money and release candidate as independent available money', () => {
    const summary = executionSummary();
    const activeMoneyBucketsRub = summary.holdRub + summary.releaseCandidateRub;

    expect(summary.reservedRub).toBe(expectedDealAmountRub());
    expect(activeMoneyBucketsRub).toBeLessThanOrEqual(summary.reservedRub);

    if (!summary.canRelease) {
      expect(summary.releaseCandidateRub).toBe(0);
    }
  });

  it('keeps blockers visible across readiness, bank and deal execution summary', () => {
    const blockers = executionBlockers();
    const summary = executionSummary();

    expect(blockers).toContain('резерв денег не подтверждён');
    expect(blockers).toContain('СДИЗ не оформлен');
    expect(blockers).toContain('слот вывоза не подтверждён');
    expect(summary.blockers).toEqual(blockers);
    expect(summary.canRelease).toBe(false);
  });

  it('does not turn a draft deal into a money-release event', () => {
    const { deal, money } = PLATFORM_V7_EXECUTION_SOURCE;

    expect(deal.status).toBe('черновик сделки');
    expect(money.buyerMoneyStatus).toBe('готов к резерву');
    expect(money.bankDecision).toBe('проверить');
    expect(canRequestMoneyRelease()).toBe(false);
  });
});
