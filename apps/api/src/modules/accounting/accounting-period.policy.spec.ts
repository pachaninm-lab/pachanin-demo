import { Capability } from '../auth/membership-capability.resolver';
import {
  PeriodReadiness,
  SuccessorRefusal,
  deriveSuccessorWindow,
  PeriodRefusal,
  PeriodStatus,
  type PeriodView,
  describeReadiness,
  evaluatePeriodClose,
  evaluatePeriodOpen,
} from './accounting-period.policy';

const NOW = new Date('2026-08-16T12:00:00.000Z');

function period(overrides: Partial<PeriodView> = {}): PeriodView {
  return {
    id: 'p-1',
    periodStart: new Date('2026-07-01T00:00:00.000Z'),
    periodEnd: new Date('2026-08-01T00:00:00.000Z'),
    status: PeriodStatus.CLOSING,
    ...overrides,
  };
}

const CLOSER = [Capability.ACCOUNTING_PACKAGE_CLOSE as string];

function close(overrides: Record<string, unknown> = {}) {
  return evaluatePeriodClose({
    period: period(),
    actorCapabilities: CLOSER,
    outstandingDerivedTasks: 0,
    unsignedDocuments: 0,
    undecidedServiceLines: 0,
    now: NOW,
    ...overrides,
  } as Parameters<typeof evaluatePeriodClose>[0]);
}

describe('closing a period', () => {
  it('refuses to close over a service line nobody decided', () => {
    // Not tidiness: the services guard refuses an approval whose line falls in
    // a closed month, so closing over a RENDERED line discards that charge
    // rather than deferring it.
    const decision = close({ undecidedServiceLines: 1 });
    expect(decision.permitted).toBe(false);
    expect(decision.refusals).toContain(PeriodRefusal.SERVICE_LINES_UNDECIDED);
  });

  it('closes a finished period with nothing outstanding', () => {
    expect(close()).toEqual({ permitted: true, refusals: [] });
  });

  it('refuses while derived work for the period is still open', () => {
    const decision = close({ outstandingDerivedTasks: 2 });
    expect(decision.permitted).toBe(false);
    expect(decision.refusals).toContain(PeriodRefusal.WORK_OUTSTANDING);
  });

  it('refuses while documents raised inside it are unsigned', () => {
    expect(close({ unsignedDocuments: 1 }).refusals).toContain(
      PeriodRefusal.UNSIGNED_DOCUMENTS,
    );
  });

  it('refuses to declare a month finished before it has ended', () => {
    const decision = close({
      period: period({ periodEnd: new Date('2026-09-01T00:00:00.000Z') }),
    });
    expect(decision.refusals).toContain(PeriodRefusal.PERIOD_HAS_NOT_ENDED);
  });

  it('refuses to skip the closing step', () => {
    expect(close({ period: period({ status: PeriodStatus.OPEN }) }).refusals).toContain(
      PeriodRefusal.PERIOD_NOT_CLOSING,
    );
  });

  it('refuses an already closed period and says nothing else', () => {
    // Once closed there is only one thing to report; listing the other
    // conditions would suggest fixing them would help.
    expect(close({ period: period({ status: PeriodStatus.CLOSED }) })).toEqual({
      permitted: false,
      refusals: [PeriodRefusal.PERIOD_ALREADY_CLOSED],
    });
  });

  it('refuses the external accountant, who keeps daily bookkeeping', () => {
    const decision = close({
      actorCapabilities: [
        Capability.ACCOUNTING_DASHBOARD_READ,
        Capability.DOCUMENTS_PREPARE,
      ],
    });
    expect(decision.refusals).toContain(PeriodRefusal.ACTOR_LACKS_PACKAGE_CLOSE);
  });

  it('reports every blocker at once', () => {
    const decision = close({
      actorCapabilities: [],
      outstandingDerivedTasks: 3,
      unsignedDocuments: 1,
      period: period({ periodEnd: new Date('2026-12-01T00:00:00.000Z') }),
    });

    expect(decision.refusals).toEqual(
      expect.arrayContaining([
        PeriodRefusal.ACTOR_LACKS_PACKAGE_CLOSE,
        PeriodRefusal.PERIOD_HAS_NOT_ENDED,
        PeriodRefusal.WORK_OUTSTANDING,
        PeriodRefusal.UNSIGNED_DOCUMENTS,
      ]),
    );
  });
});

describe('opening a period', () => {
  const existing = [
    period({ id: 'p-jul', status: PeriodStatus.CLOSED }),
  ];

  it('opens a window that starts exactly where the last one ended', () => {
    expect(
      evaluatePeriodOpen({
        periodStart: new Date('2026-08-01T00:00:00.000Z'),
        periodEnd: new Date('2026-09-01T00:00:00.000Z'),
        existing,
        actorCapabilities: CLOSER,
      }),
    ).toEqual({ permitted: true, refusals: [] });
  });

  it('refuses a window that overlaps an existing one by an instant', () => {
    const decision = evaluatePeriodOpen({
      periodStart: new Date('2026-07-31T23:59:59.000Z'),
      periodEnd: new Date('2026-09-01T00:00:00.000Z'),
      existing,
      actorCapabilities: CLOSER,
    });
    expect(decision.refusals).toContain(PeriodRefusal.WINDOW_OVERLAPS);
  });

  it('refuses an empty window', () => {
    const at = new Date('2026-09-01T00:00:00.000Z');
    expect(
      evaluatePeriodOpen({
        periodStart: at,
        periodEnd: at,
        existing: [],
        actorCapabilities: CLOSER,
      }).refusals,
    ).toContain(PeriodRefusal.WINDOW_IS_EMPTY);
  });
});

describe('readiness', () => {
  it('is a fact about the month, not about who is looking', () => {
    // No capabilities anywhere in the signature: whether the month can be
    // finished and whether this person may finish it are separate questions,
    // and merging them shows a farmer "not ready" when the truth is "ready,
    // but not by you".
    expect(describeReadiness(period(), 0, 0, NOW)).toBe(PeriodReadiness.READY_TO_CLOSE);
    expect(describeReadiness(period(), 1, 0, NOW)).toBe(PeriodReadiness.WAITING_ON_WORK);
    expect(describeReadiness(period(), 0, 1, NOW)).toBe(PeriodReadiness.WAITING_ON_WORK);
    expect(
      describeReadiness(
        period({ periodEnd: new Date('2026-09-01T00:00:00.000Z') }),
        0,
        0,
        NOW,
      ),
    ).toBe(PeriodReadiness.STILL_RUNNING);
    expect(
      describeReadiness(period({ status: PeriodStatus.CLOSED }), 5, 5, NOW),
    ).toBe(PeriodReadiness.CLOSED);
  });
});

describe('the window that follows', () => {
  it('gives the next calendar month, not the same number of days', () => {
    // February is the case that matters: carrying twenty-eight days forward
    // would put March's boundary three days early, and a boundary that is wrong
    // is wrong in every document the month contains.
    const decision = deriveSuccessorWindow({
      periodStart: new Date('2026-02-01T00:00:00.000Z'),
      periodEnd: new Date('2026-03-01T00:00:00.000Z'),
    });

    expect(decision.window).toEqual({
      periodStart: new Date('2026-03-01T00:00:00.000Z'),
      periodEnd: new Date('2026-04-01T00:00:00.000Z'),
    });
  });

  it('starts exactly where its predecessor ended', () => {
    const decision = deriveSuccessorWindow({
      periodStart: new Date('2026-12-01T00:00:00.000Z'),
      periodEnd: new Date('2027-01-01T00:00:00.000Z'),
    });
    expect(decision.window?.periodStart).toEqual(
      new Date('2027-01-01T00:00:00.000Z'),
    );
    expect(decision.window?.periodEnd).toEqual(new Date('2027-02-01T00:00:00.000Z'));
  });

  it('refuses to guess a successor for a window that is not a calendar month', () => {
    for (const [start, end] of [
      ['2026-07-15T00:00:00.000Z', '2026-08-15T00:00:00.000Z'],
      ['2026-07-01T00:00:00.000Z', '2026-07-15T00:00:00.000Z'],
      ['2026-07-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'],
      ['2026-07-01T06:00:00.000Z', '2026-08-01T00:00:00.000Z'],
    ] as const) {
      const decision = deriveSuccessorWindow({
        periodStart: new Date(start),
        periodEnd: new Date(end),
      });
      expect(decision.window).toBeNull();
      expect(decision.refusals).toEqual([SuccessorRefusal.NOT_A_CALENDAR_MONTH]);
    }
  });
});
