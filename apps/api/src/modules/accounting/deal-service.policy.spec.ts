import {
  DecisionRefusal,
  MAX_QUANTITY_MILLI_UNITS,
  MAX_RATE_KOPECKS,
  ReversalRefusal,
  ServiceRefusal,
  ServiceStatus,
  UNIT_FOR_KIND,
  amountKopecks,
  evaluateDecideService,
  evaluateRecordService,
  evaluateReverseService,
  netKopecks,
  wholeDays,
} from './deal-service.policy';

/**
 * The decisions, without a database.
 *
 * These run over the facts the repository reads rather than over a connection,
 * so they can cover combinations a live test would need contrived setup for. The
 * constraints enforce the same rules again and the PostgreSQL suite proves that
 * — this file proves the reasons are right, not that they are the only line of
 * defence.
 */

const DAY = 24 * 60 * 60 * 1000;
const from = new Date('2026-03-01T00:00:00.000Z');
const to = new Date('2026-03-11T00:00:00.000Z');

// 40 tons stored for 10 days, at 3 roubles per ton-day.
const storage = {
  mayRecord: true,
  organizationId: 'org-1',
  counterpartyOrgId: 'org-2',
  kind: 'STORAGE',
  quantityMilliUnits: 400_000n,
  tonnageMilliTons: 40_000n,
  periodFrom: from,
  periodTo: to,
  rateKopecks: 300n,
  currency: 'RUB',
  idempotencyKey: 'key-1',
  renderedMonthIsClosed: false,
};

const transshipment = {
  ...storage,
  kind: 'TRANSSHIPMENT',
  quantityMilliUnits: 40_000n,
  tonnageMilliTons: null,
  periodFrom: null,
  periodTo: null,
  rateKopecks: 15_000n,
};

describe('what a service line comes to', () => {
  it('is the quantity times the rate, per whole unit', () => {
    // 400 ton-days at 3 roubles.
    expect(amountKopecks(400_000n, 300n)).toBe(120_000n);
  });

  it('rounds half up, and only ever by a kopeck', () => {
    // 1.5 units at 1 kopeck is half a kopeck, which becomes one.
    expect(amountKopecks(1_500n, 1n)).toBe(2n);
    // 1.4 units at 1 kopeck stays at one.
    expect(amountKopecks(1_400n, 1n)).toBe(1n);
  });

  it('is exact for quantities a Float would not survive', () => {
    // 0.1 + 0.2 is the canonical demonstration; the same shape in thousandths
    // of a ton at a kopeck a ton has to come out exactly.
    expect(amountKopecks(100n, 1n) + amountKopecks(200n, 1n)).toBe(
      amountKopecks(300n, 1n),
    );
  });
});

describe('whole days in a window', () => {
  it('counts them', () => {
    expect(wholeDays(from, to)).toBe(10n);
  });

  it('refuses a window that is not a whole number of days', () => {
    expect(wholeDays(from, new Date(from.getTime() + DAY + 3_600_000))).toBeNull();
  });

  it('refuses a window that ends where it starts', () => {
    expect(wholeDays(from, from)).toBeNull();
  });

  it('refuses a window that runs backwards', () => {
    expect(wholeDays(to, from)).toBeNull();
  });
});

describe('recording a service', () => {
  it('permits storage whose ton-days follow from its window', () => {
    expect(evaluateRecordService(storage).permitted).toBe(true);
  });

  it('permits a handling service charged by the ton', () => {
    expect(evaluateRecordService(transshipment).permitted).toBe(true);
  });

  it('refuses an actor without the capability', () => {
    const decision = evaluateRecordService({ ...storage, mayRecord: false });
    expect(decision.refusals).toContain(ServiceRefusal.NOT_AUTHORISED);
  });

  it('refuses a kind the contour does not know, and says nothing else', () => {
    // Every remaining check is about matching the unit, and there is no unit
    // without a kind. Judging them anyway would complain about a shape nobody
    // claimed.
    const decision = evaluateRecordService({ ...storage, kind: 'ASTROLOGY' });
    expect(decision.refusals).toEqual([ServiceRefusal.KIND_UNKNOWN]);
  });

  it('refuses more ton-days than the window and tonnage support', () => {
    // The same 10-day window, billed as though 50 tons had been stored.
    const decision = evaluateRecordService({
      ...storage,
      quantityMilliUnits: 500_000n,
    });
    expect(decision.permitted).toBe(false);
    expect(decision.refusals).toContain(
      ServiceRefusal.TON_DAYS_DISAGREE_WITH_WINDOW,
    );
  });

  it('refuses the same tonnage billed for more days than the window holds', () => {
    const decision = evaluateRecordService({
      ...storage,
      periodTo: new Date(from.getTime() + 5 * DAY),
    });
    expect(decision.refusals).toContain(
      ServiceRefusal.TON_DAYS_DISAGREE_WITH_WINDOW,
    );
  });

  it('refuses storage without a window', () => {
    const decision = evaluateRecordService({
      ...storage,
      periodFrom: null,
      periodTo: null,
    });
    expect(decision.refusals).toContain(ServiceRefusal.WINDOW_MISSING);
  });

  it('refuses storage without a tonnage', () => {
    const decision = evaluateRecordService({ ...storage, tonnageMilliTons: null });
    expect(decision.refusals).toContain(ServiceRefusal.TONNAGE_MISSING);
  });

  it('refuses a window that is not whole days', () => {
    const decision = evaluateRecordService({
      ...storage,
      periodTo: new Date(from.getTime() + 10 * DAY + 1),
    });
    expect(decision.refusals).toContain(ServiceRefusal.WINDOW_NOT_WHOLE_DAYS);
  });

  it('refuses a window on a service not charged by time', () => {
    const decision = evaluateRecordService({ ...transshipment, periodFrom: from });
    expect(decision.refusals).toContain(ServiceRefusal.WINDOW_NOT_ALLOWED);
  });

  it('refuses a tonnage on a service not charged by ton-days', () => {
    const decision = evaluateRecordService({
      ...transshipment,
      tonnageMilliTons: 1_000n,
    });
    expect(decision.refusals).toContain(ServiceRefusal.TONNAGE_NOT_ALLOWED);
  });

  it('refuses a fraction of an operation', () => {
    const decision = evaluateRecordService({
      ...transshipment,
      kind: 'WEIGHING',
      quantityMilliUnits: 1_500n,
    });
    expect(decision.refusals).toContain(ServiceRefusal.OPERATIONS_ARE_NOT_WHOLE);
  });

  it('permits whole operations', () => {
    expect(
      evaluateRecordService({
        ...transshipment,
        kind: 'LOADING',
        quantityMilliUnits: 3_000n,
      }).permitted,
    ).toBe(true);
  });

  it.each([0n, -1n])('refuses a quantity of %s', (quantityMilliUnits) => {
    const decision = evaluateRecordService({
      ...transshipment,
      quantityMilliUnits,
    });
    expect(decision.refusals).toContain(
      ServiceRefusal.QUANTITY_IS_NOT_A_QUANTITY,
    );
  });

  it('refuses a quantity beyond the range the arithmetic is safe in', () => {
    const decision = evaluateRecordService({
      ...transshipment,
      quantityMilliUnits: MAX_QUANTITY_MILLI_UNITS + 1n,
    });
    expect(decision.refusals).toContain(ServiceRefusal.QUANTITY_OUT_OF_RANGE);
  });

  it('refuses a rate beyond that range', () => {
    const decision = evaluateRecordService({
      ...transshipment,
      rateKopecks: MAX_RATE_KOPECKS + 1n,
    });
    expect(decision.refusals).toContain(ServiceRefusal.RATE_OUT_OF_RANGE);
  });

  it('refuses a free service', () => {
    const decision = evaluateRecordService({ ...transshipment, rateKopecks: 0n });
    expect(decision.refusals).toContain(ServiceRefusal.RATE_IS_NOT_A_RATE);
  });

  it('refuses a service to oneself', () => {
    const decision = evaluateRecordService({
      ...transshipment,
      counterpartyOrgId: 'org-1',
    });
    expect(decision.refusals).toContain(ServiceRefusal.COUNTERPARTY_IS_SELF);
  });

  it('refuses an unknown currency', () => {
    const decision = evaluateRecordService({ ...transshipment, currency: 'XAU' });
    expect(decision.refusals).toContain(ServiceRefusal.CURRENCY_UNKNOWN);
  });

  it('refuses a command with no idempotency key', () => {
    const decision = evaluateRecordService({
      ...transshipment,
      idempotencyKey: '  ',
    });
    expect(decision.refusals).toContain(ServiceRefusal.IDEMPOTENCY_KEY_MISSING);
  });

  it('refuses a service rendered in a closed month', () => {
    const decision = evaluateRecordService({
      ...transshipment,
      renderedMonthIsClosed: true,
    });
    expect(decision.refusals).toContain(ServiceRefusal.PERIOD_CLOSED);
  });
});

const decide = {
  mayDecide: true,
  serviceFound: true,
  intended: ServiceStatus.APPROVED,
  currentStatus: ServiceStatus.RENDERED,
  recordedByMembershipId: 'm-1',
  decidingMembershipId: 'm-2',
  renderedMonthIsClosed: false,
};

describe('approving or rejecting a line', () => {
  it('permits a second person to approve', () => {
    expect(evaluateDecideService(decide).permitted).toBe(true);
  });

  it('refuses the recorder approving their own line', () => {
    const decision = evaluateDecideService({
      ...decide,
      decidingMembershipId: 'm-1',
    });
    expect(decision.permitted).toBe(false);
    expect(decision.refusals).toContain(DecisionRefusal.APPROVER_IS_RECORDER);
  });

  it('lets the recorder withdraw their own line', () => {
    // Rejection is withdrawal. Nothing is owed as a result, so the independent
    // pair of eyes the approval needs is not needed here.
    expect(
      evaluateDecideService({
        ...decide,
        intended: ServiceStatus.REJECTED,
        decidingMembershipId: 'm-1',
      }).permitted,
    ).toBe(true);
  });

  it.each([ServiceStatus.APPROVED, ServiceStatus.REJECTED])(
    'refuses deciding a line that is already %s',
    (currentStatus) => {
      const decision = evaluateDecideService({ ...decide, currentStatus });
      expect(decision.refusals).toContain(DecisionRefusal.ALREADY_DECIDED);
    },
  );

  it('says only that the line is missing when it is', () => {
    const decision = evaluateDecideService({
      ...decide,
      serviceFound: false,
      currentStatus: null,
      recordedByMembershipId: null,
    });
    expect(decision.refusals).toEqual([DecisionRefusal.SERVICE_NOT_FOUND]);
  });

  it('refuses approving into a closed month', () => {
    const decision = evaluateDecideService({
      ...decide,
      renderedMonthIsClosed: true,
    });
    expect(decision.refusals).toContain(DecisionRefusal.PERIOD_CLOSED);
  });

  it('permits rejecting in a closed month', () => {
    // The line was never approved, so it was never in the closed figures.
    expect(
      evaluateDecideService({
        ...decide,
        intended: ServiceStatus.REJECTED,
        renderedMonthIsClosed: true,
      }).permitted,
    ).toBe(true);
  });

  it('refuses an actor without the capability', () => {
    const decision = evaluateDecideService({ ...decide, mayDecide: false });
    expect(decision.refusals).toContain(DecisionRefusal.NOT_AUTHORISED);
  });
});

const reverse = {
  mayReverse: true,
  originalFound: true,
  originalStatus: ServiceStatus.APPROVED,
  originalIsReversal: false,
  originalAlreadyReversed: false,
  reversalMonthIsClosed: false,
  idempotencyKey: 'key-rev',
};

describe('reversing a line', () => {
  it('permits reversing an approved line', () => {
    expect(evaluateReverseService(reverse).permitted).toBe(true);
  });

  it.each([ServiceStatus.RENDERED, ServiceStatus.REJECTED])(
    'refuses reversing a %s line',
    (originalStatus) => {
      const decision = evaluateReverseService({ ...reverse, originalStatus });
      expect(decision.refusals).toContain(ReversalRefusal.ORIGINAL_NOT_APPROVED);
    },
  );

  it('refuses reversing a reversal', () => {
    const decision = evaluateReverseService({
      ...reverse,
      originalIsReversal: true,
    });
    expect(decision.refusals).toContain(ReversalRefusal.ORIGINAL_IS_REVERSAL);
  });

  it('refuses a second reversal of the same line', () => {
    const decision = evaluateReverseService({
      ...reverse,
      originalAlreadyReversed: true,
    });
    expect(decision.refusals).toContain(ReversalRefusal.ALREADY_REVERSED);
  });

  it('says only that the original is missing when it is', () => {
    const decision = evaluateReverseService({
      ...reverse,
      originalFound: false,
      originalStatus: null,
    });
    expect(decision.refusals).toEqual([ReversalRefusal.ORIGINAL_NOT_FOUND]);
  });

  it('refuses a reversal landing in a closed month', () => {
    const decision = evaluateReverseService({
      ...reverse,
      reversalMonthIsClosed: true,
    });
    expect(decision.refusals).toContain(ReversalRefusal.PERIOD_CLOSED);
  });
});

describe('what the deal owes for services', () => {
  const line = (
    status: ServiceStatus,
    amount: bigint,
    isReversal = false,
  ) => ({ status, amountKopecks: amount, isReversal });

  it('counts approved lines', () => {
    expect(netKopecks([
      line(ServiceStatus.APPROVED, 100n),
      line(ServiceStatus.APPROVED, 50n),
    ])).toBe(150n);
  });

  it('ignores lines nobody approved', () => {
    expect(netKopecks([
      line(ServiceStatus.APPROVED, 100n),
      line(ServiceStatus.RENDERED, 500n),
      line(ServiceStatus.REJECTED, 900n),
    ])).toBe(100n);
  });

  it('counts an approved reversal against the charge', () => {
    expect(netKopecks([
      line(ServiceStatus.APPROVED, 100n),
      line(ServiceStatus.APPROVED, 100n, true),
    ])).toBe(0n);
  });

  it('ignores a reversal that has not been approved yet', () => {
    // A correction one person asked for is not yet a correction: it needs the
    // same second person the charge needed.
    expect(netKopecks([
      line(ServiceStatus.APPROVED, 100n),
      line(ServiceStatus.RENDERED, 100n, true),
    ])).toBe(100n);
  });
});

describe('the unit of a kind', () => {
  it('is fixed for every kind the contour knows', () => {
    expect(UNIT_FOR_KIND).toEqual({
      STORAGE: 'TON_DAY',
      DRYING: 'TON',
      CLEANING: 'TON',
      TRANSSHIPMENT: 'TON',
      WEIGHING: 'OPERATION',
      LOADING: 'OPERATION',
    });
  });
});
