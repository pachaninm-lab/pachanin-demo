import {
  AdvanceRefusal,
  OffsetRefusal,
  evaluateApplyOffset,
  evaluateRecordAdvance,
  remainingKopecks,
} from './advance.policy';

/**
 * The decisions, without a database.
 *
 * These run over the facts the repository reads rather than over a connection,
 * so they can cover the combinations a live test would need contrived setup
 * for. The same rules are enforced again by the guards, and the PostgreSQL
 * suite proves that — this file proves the reasons are right, not that they are
 * the only line of defence.
 */

const evidence = {
  found: true,
  confirmed: true,
  dealId: 'deal-1',
  amountKopecks: 100_00n,
  currency: 'RUB',
};

const recordFacts = {
  mayRecord: true,
  organizationId: 'org-1',
  counterpartyOrgId: 'org-2',
  dealId: 'deal-1',
  amountKopecks: 100_00n,
  currency: 'RUB',
  bankOperationId: 'op-1',
  evidence,
  arrivalMonthIsClosed: false,
};

describe('recording an advance', () => {
  it('permits one that matches its evidence exactly', () => {
    expect(evaluateRecordAdvance(recordFacts).permitted).toBe(true);
  });

  it('refuses an actor without the capability', () => {
    const decision = evaluateRecordAdvance({ ...recordFacts, mayRecord: false });
    expect(decision.permitted).toBe(false);
    expect(decision.refusals).toContain(AdvanceRefusal.NOT_AUTHORISED);
  });

  it.each([0n, -1n])('refuses %s kopecks', (amountKopecks) => {
    const decision = evaluateRecordAdvance({
      ...recordFacts,
      amountKopecks,
      evidence: { ...evidence, amountKopecks },
    });
    expect(decision.refusals).toContain(AdvanceRefusal.AMOUNT_IS_NOT_MONEY);
  });

  it('refuses a blank bank operation without also complaining it disagrees', () => {
    // A missing reference and a mismatching one are different problems, and
    // reporting both would send somebody looking for a transfer they never
    // named.
    const decision = evaluateRecordAdvance({
      ...recordFacts,
      bankOperationId: '   ',
    });
    expect(decision.refusals).toContain(AdvanceRefusal.EVIDENCE_MISSING);
    expect(decision.refusals).not.toContain(AdvanceRefusal.EVIDENCE_DISAGREES);
  });

  it('refuses an unconfirmed transfer', () => {
    const decision = evaluateRecordAdvance({
      ...recordFacts,
      evidence: { ...evidence, confirmed: false },
    });
    expect(decision.refusals).toContain(AdvanceRefusal.EVIDENCE_NOT_CONFIRMED);
  });

  it.each([
    ['another deal', { dealId: 'deal-9' }],
    ['another amount', { amountKopecks: 99_00n }],
    ['another currency', { currency: 'USD' }],
  ])('refuses evidence for %s', (_label, override) => {
    const decision = evaluateRecordAdvance({
      ...recordFacts,
      evidence: { ...evidence, ...override },
    });
    expect(decision.refusals).toContain(AdvanceRefusal.EVIDENCE_DISAGREES);
  });

  it('refuses an advance from the organization to itself', () => {
    const decision = evaluateRecordAdvance({
      ...recordFacts,
      counterpartyOrgId: 'org-1',
    });
    expect(decision.refusals).toContain(AdvanceRefusal.COUNTERPARTY_IS_SELF);
  });

  it('refuses an advance landing in a closed month', () => {
    const decision = evaluateRecordAdvance({
      ...recordFacts,
      arrivalMonthIsClosed: true,
    });
    expect(decision.refusals).toContain(AdvanceRefusal.PERIOD_CLOSED);
  });
});

const offsetFacts = {
  mayApply: true,
  advanceFound: true,
  amountKopecks: 40_00n,
  advanceAmountKopecks: 100_00n,
  alreadyAppliedKopecks: 30_00n,
  applicationMonthIsClosed: false,
  reason: 'offset against delivery',
  idempotencyKey: 'key-1',
};

describe('applying an advance', () => {
  it('permits an offset that fits in what is left', () => {
    expect(evaluateApplyOffset(offsetFacts).permitted).toBe(true);
  });

  it('permits an offset for exactly the remainder', () => {
    expect(
      evaluateApplyOffset({ ...offsetFacts, amountKopecks: 70_00n }).permitted,
    ).toBe(true);
  });

  it('refuses the kopeck that would take it past what arrived', () => {
    const decision = evaluateApplyOffset({
      ...offsetFacts,
      amountKopecks: 70_01n,
    });
    expect(decision.permitted).toBe(false);
    expect(decision.refusals).toContain(OffsetRefusal.EXCEEDS_REMAINING);
  });

  it('says only that the advance is missing when it is', () => {
    // Judging the amount against an advance that was never found would produce
    // a list of complaints about numbers nobody supplied.
    const decision = evaluateApplyOffset({
      ...offsetFacts,
      advanceFound: false,
      reason: '',
      idempotencyKey: '',
    });
    expect(decision.refusals).toEqual([OffsetRefusal.ADVANCE_NOT_FOUND]);
  });

  it('refuses an offset with no reason', () => {
    const decision = evaluateApplyOffset({ ...offsetFacts, reason: '  ' });
    expect(decision.refusals).toContain(OffsetRefusal.REASON_MISSING);
  });

  it('refuses an offset with no idempotency key', () => {
    const decision = evaluateApplyOffset({ ...offsetFacts, idempotencyKey: '' });
    expect(decision.refusals).toContain(OffsetRefusal.IDEMPOTENCY_KEY_MISSING);
  });

  it('refuses an offset landing in a closed month', () => {
    const decision = evaluateApplyOffset({
      ...offsetFacts,
      applicationMonthIsClosed: true,
    });
    expect(decision.refusals).toContain(OffsetRefusal.PERIOD_CLOSED);
  });

  it('refuses an actor without the capability', () => {
    const decision = evaluateApplyOffset({ ...offsetFacts, mayApply: false });
    expect(decision.refusals).toContain(OffsetRefusal.NOT_AUTHORISED);
  });
});

describe('what is left of an advance', () => {
  it('is the difference', () => {
    expect(remainingKopecks(100_00n, 30_00n)).toBe(70_00n);
  });

  it('is nothing once fully applied', () => {
    expect(remainingKopecks(100_00n, 100_00n)).toBe(0n);
  });

  it('never goes negative, even if the sums ever disagree', () => {
    // The guards make this unreachable. Reporting a negative remainder would
    // read as money owed back, which is a different event entirely, so the
    // floor is here rather than left to whatever renders it.
    expect(remainingKopecks(100_00n, 130_00n)).toBe(0n);
  });
});
