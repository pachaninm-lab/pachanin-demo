import {
  PLATFORM_V7_EXECUTION_SOURCE,
  canRequestMoneyRelease,
  executionBlockers,
  executionReadinessScore,
  executionSummary,
  expectedDealAmountRub,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

describe('platform-v7 deal execution source of truth', () => {
  it('readinessScore is between 0 and 100', () => {
    const score = executionReadinessScore();
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('executionBlockers returns only non-empty blockers from non-ready gates', () => {
    const blockers = executionBlockers();
    expect(Array.isArray(blockers)).toBe(true);
    for (const blocker of blockers) {
      expect(blocker).toBeTruthy();
    }
    const { readiness } = PLATFORM_V7_EXECUTION_SOURCE;
    const readyGateBlockers = Object.values(readiness)
      .filter((g) => g.status === 'готово')
      .map((g) => g.blocker)
      .filter((b) => b !== '');
    expect(readyGateBlockers.length).toBe(0);
  });

  it('canRequestMoneyRelease is false when holdRub > 0', () => {
    const originalHold = PLATFORM_V7_EXECUTION_SOURCE.money.holdRub;
    const { money, readiness } = PLATFORM_V7_EXECUTION_SOURCE;
    const allGatesReady =
      readiness.bank.status === 'готово' &&
      readiness.documents.status === 'готово' &&
      readiness.logistics.status === 'готово' &&
      readiness.dispute.status === 'готово';
    if (money.holdRub > 0) {
      expect(canRequestMoneyRelease()).toBe(false);
    } else {
      expect(canRequestMoneyRelease()).toBe(allGatesReady && money.holdRub === 0);
    }
    expect(originalHold).toBe(PLATFORM_V7_EXECUTION_SOURCE.money.holdRub);
  });

  it('canRequestMoneyRelease is false when documents.status is not готово', () => {
    const { readiness } = PLATFORM_V7_EXECUTION_SOURCE;
    if (readiness.documents.status !== 'готово') {
      expect(canRequestMoneyRelease()).toBe(false);
    }
  });

  it('canRequestMoneyRelease is false when logistics.status is not готово', () => {
    const { readiness } = PLATFORM_V7_EXECUTION_SOURCE;
    if (readiness.logistics.status !== 'готово') {
      expect(canRequestMoneyRelease()).toBe(false);
    }
  });

  it('canRequestMoneyRelease is false when bank.status is not готово', () => {
    const { readiness } = PLATFORM_V7_EXECUTION_SOURCE;
    if (readiness.bank.status !== 'готово') {
      expect(canRequestMoneyRelease()).toBe(false);
    }
  });

  it('canRequestMoneyRelease is false when dispute.status is not готово', () => {
    const { readiness } = PLATFORM_V7_EXECUTION_SOURCE;
    if (readiness.dispute.status !== 'готово') {
      expect(canRequestMoneyRelease()).toBe(false);
    }
  });

  it('canRequestMoneyRelease is true only when all key gates are готово and holdRub === 0', () => {
    const { readiness, money } = PLATFORM_V7_EXECUTION_SOURCE;
    const allReady =
      readiness.bank.status === 'готово' &&
      readiness.documents.status === 'готово' &&
      readiness.logistics.status === 'готово' &&
      readiness.dispute.status === 'готово' &&
      money.holdRub === 0;
    expect(canRequestMoneyRelease()).toBe(allReady);
  });

  it('releaseCandidateRub does not exceed reservedRub', () => {
    const { money } = PLATFORM_V7_EXECUTION_SOURCE;
    expect(money.releaseCandidateRub).toBeLessThanOrEqual(money.reservedRub);
  });

  it('holdRub does not exceed reservedRub', () => {
    const { money } = PLATFORM_V7_EXECUTION_SOURCE;
    expect(money.holdRub).toBeLessThanOrEqual(money.reservedRub);
  });

  it('deal.volumeTons is greater than 0', () => {
    expect(PLATFORM_V7_EXECUTION_SOURCE.deal.volumeTons).toBeGreaterThan(0);
  });

  it('reservedRub is consistent with deal amount', () => {
    const { money } = PLATFORM_V7_EXECUTION_SOURCE;
    const expected = expectedDealAmountRub();
    expect(money.reservedRub).toBeLessThanOrEqual(expected);
    expect(money.reservedRub).toBe(expected);
  });

  it('documents.missingDocuments is an array', () => {
    const { documents } = PLATFORM_V7_EXECUTION_SOURCE;
    expect(Array.isArray(documents.missingDocuments)).toBe(true);
  });

  it('every audit event has required fields', () => {
    const { audit } = PLATFORM_V7_EXECUTION_SOURCE;
    expect(audit.length).toBeGreaterThan(0);
    for (const event of audit) {
      expect(event.time).toBeTruthy();
      expect(event.actor).toBeTruthy();
      expect(event.action).toBeTruthy();
      expect(event.note).toBeTruthy();
      expect(event.status).toBeTruthy();
    }
  });

  it('executionSummary derives values from PLATFORM_V7_EXECUTION_SOURCE', () => {
    const summary = executionSummary();
    expect(summary.dealId).toBe(PLATFORM_V7_EXECUTION_SOURCE.deal.id);
    expect(summary.lotId).toBe(PLATFORM_V7_EXECUTION_SOURCE.deal.lotId);
    expect(summary.fgisPartyId).toBe(PLATFORM_V7_EXECUTION_SOURCE.deal.fgisPartyId);
    expect(summary.readinessScore).toBe(executionReadinessScore());
    expect(summary.reservedRub).toBe(PLATFORM_V7_EXECUTION_SOURCE.money.reservedRub);
    expect(summary.holdRub).toBe(PLATFORM_V7_EXECUTION_SOURCE.money.holdRub);
    expect(summary.releaseCandidateRub).toBe(PLATFORM_V7_EXECUTION_SOURCE.money.releaseCandidateRub);
    expect(summary.canRelease).toBe(canRequestMoneyRelease());
    expect(summary.maturity).toBe(PLATFORM_V7_EXECUTION_SOURCE.deal.maturity);
  });

  it('blockers count matches non-ready gates with non-empty blocker', () => {
    const blockers = executionBlockers();
    const { readiness } = PLATFORM_V7_EXECUTION_SOURCE;
    const expected = Object.values(readiness).filter(
      (g) => g.status !== 'готово' && g.blocker !== '',
    ).length;
    expect(blockers.length).toBe(expected);
  });
});
