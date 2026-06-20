import {
  RuntimeMoneyEngine,
  FAILED_TEST_PENALTY_RUB,
  type MoneyRuntimeSnapshot,
} from './runtime-money-engine';

const engine = new RuntimeMoneyEngine();

function snap(overrides: Partial<MoneyRuntimeSnapshot> = {}): MoneyRuntimeSnapshot {
  return {
    paymentStatus: 'REQUIRES_BANK',
    dealStatus: 'IN_TRANSIT',
    releasedRub: 0,
    callbackState: 'NOT_SENT',
    reserveConfirmedAt: undefined,
    reserveRequestedAt: undefined,
    blockers: [],
    ...overrides,
  };
}

describe('RuntimeMoneyEngine — sampleMoneyDelta', () => {
  it('penalises -125000 per failed test', () => {
    // 0 * -125000 yields -0 (unchanged from the original inline logic); assert numeric zero.
    expect(engine.sampleMoneyDelta({ tests: [] })).toBeCloseTo(0);
    expect(engine.sampleMoneyDelta({ tests: [{ passed: true }, { passed: false }] })).toBe(FAILED_TEST_PENALTY_RUB);
    expect(engine.sampleMoneyDelta({ tests: [{ passed: false }, { passed: false }] })).toBe(2 * FAILED_TEST_PENALTY_RUB);
    // undefined `passed` is not a failure
    expect(engine.sampleMoneyDelta({ tests: [{}, { passed: false }] })).toBe(FAILED_TEST_PENALTY_RUB);
  });
});

describe('RuntimeMoneyEngine — moneyImpact', () => {
  it('projects the money summary with safe fallbacks', () => {
    expect(
      engine.moneyImpact(
        { amountRub: 1000, disputedAmountRub: 200, undisputedAmountRub: 800, bankEventId: 'B1' },
        { moneyDeltaRub: -200 },
      ),
    ).toEqual({ amountRub: 1000, disputedAmountRub: 200, undisputedAmountRub: 800, qualityDeltaRub: -200, bankEventId: 'B1' });

    expect(engine.moneyImpact({ amountRub: 500, bankEventId: 'B2' }, undefined)).toEqual({
      amountRub: 500,
      disputedAmountRub: 0,
      undisputedAmountRub: 500,
      qualityDeltaRub: 0,
      bankEventId: 'B2',
    });
  });
});

describe('RuntimeMoneyEngine — decideDealRuntime (priority ladder)', () => {
  it('MISMATCH wins first', () => {
    expect(engine.decideDealRuntime(snap({ paymentStatus: 'MISMATCH', dealStatus: 'DISPUTE_OPEN' }))).toBe('MISMATCH_HOLD');
  });

  it('open dispute holds next', () => {
    expect(engine.decideDealRuntime(snap({ dealStatus: 'DISPUTE_OPEN' }))).toBe('DISPUTE_HOLD');
  });

  it('released only when releasedRub>0 AND callback CONFIRMED', () => {
    expect(engine.decideDealRuntime(snap({ releasedRub: 100, callbackState: 'CONFIRMED' }))).toBe('RELEASED');
    // released money without a confirmed bank callback must NOT report RELEASED
    expect(engine.decideDealRuntime(snap({ releasedRub: 100, callbackState: 'PENDING' }))).not.toBe('RELEASED');
  });

  it('ready for release only when reserve confirmed and no blockers (callback-blocker ignored)', () => {
    expect(
      engine.decideDealRuntime(snap({ reserveConfirmedAt: 'x', blockers: ['Нет callback банка'] })),
    ).toBe('READY_FOR_RELEASE');
    expect(
      engine.decideDealRuntime(snap({ reserveConfirmedAt: 'x', blockers: ['Нет документов: contract'] })),
    ).toBe('HOLD_BLOCKERS');
  });

  it('reserve pending when requested but not confirmed', () => {
    expect(engine.decideDealRuntime(snap({ reserveRequestedAt: 'x' }))).toBe('RESERVE_PENDING');
  });

  it('holds on blockers, otherwise requires bank', () => {
    expect(engine.decideDealRuntime(snap({ blockers: ['Нет документов: contract'] }))).toBe('HOLD_BLOCKERS');
    expect(engine.decideDealRuntime(snap())).toBe('REQUIRES_BANK');
  });

  it('is pure — does not mutate the snapshot', () => {
    const s = snap({ blockers: ['x'] });
    const frozen = JSON.stringify(s);
    engine.decideDealRuntime(s);
    expect(JSON.stringify(s)).toBe(frozen);
  });
});
