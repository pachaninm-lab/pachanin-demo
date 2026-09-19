import { Capability } from '../auth/membership-capability.resolver';

/**
 * Closing a period.
 *
 * What is being closed matters: this is the platform saying its own document
 * set for a stretch of time stopped moving, not an accounting ledger close.
 * «Прозрачная Цена» is not the books and does not replace 1С. Naming it
 * precisely is not pedantry — a screen that says "период закрыт" while the
 * bookkeeper's ledger is open would be read as the second thing, and somebody
 * would file on the strength of it.
 *
 * The rules here are stated again in the database guard. The split is the usual
 * one: this answers the caller with every reason at once, the guard answers
 * every principal including one with a psql session.
 */

export const PeriodStatus = {
  OPEN: 'OPEN',
  /** Nobody is adding to it; outstanding work is being counted. */
  CLOSING: 'CLOSING',
  CLOSED: 'CLOSED',
} as const;
export type PeriodStatus = (typeof PeriodStatus)[keyof typeof PeriodStatus];

export interface PeriodView {
  readonly id: string;
  /** Inclusive. */
  readonly periodStart: Date;
  /** Exclusive. */
  readonly periodEnd: Date;
  readonly status: PeriodStatus;
}

export const PeriodRefusal = {
  ACTOR_LACKS_PACKAGE_CLOSE: 'ACTOR_LACKS_PACKAGE_CLOSE',
  PERIOD_ALREADY_CLOSED: 'PERIOD_ALREADY_CLOSED',
  PERIOD_NOT_CLOSING: 'PERIOD_NOT_CLOSING',
  PERIOD_HAS_NOT_ENDED: 'PERIOD_HAS_NOT_ENDED',
  WORK_OUTSTANDING: 'WORK_OUTSTANDING',
  UNSIGNED_DOCUMENTS: 'UNSIGNED_DOCUMENTS',
  /**
   * Service lines nobody approved or rejected, rendered inside the window.
   *
   * Blocking, and for a mechanical reason rather than a tidiness one: the
   * services guard refuses an approval whose line falls in a closed month, so
   * closing over a RENDERED line does not defer that charge — it discards it.
   */
  SERVICE_LINES_UNDECIDED: 'SERVICE_LINES_UNDECIDED',
  WINDOW_IS_EMPTY: 'WINDOW_IS_EMPTY',
  WINDOW_OVERLAPS: 'WINDOW_OVERLAPS',
} as const;
export type PeriodRefusal = (typeof PeriodRefusal)[keyof typeof PeriodRefusal];

export interface PeriodDecision {
  readonly permitted: boolean;
  readonly refusals: readonly PeriodRefusal[];
}

export interface CloseRequest {
  readonly period: PeriodView;
  readonly actorCapabilities: readonly string[];
  /** Derived tasks still open for documents raised inside the window. */
  readonly outstandingDerivedTasks: number;
  /** Documents raised inside the window carrying no signature. */
  readonly unsignedDocuments: number;
  /** Service lines rendered inside the window that are still RENDERED. */
  readonly undecidedServiceLines: number;
  readonly now: Date;
}

/**
 * Whether this period can be closed now.
 *
 * Every reason at once, because a close is the sort of thing somebody attempts
 * at the end of a long day and discovering the blockers one at a time turns one
 * evening into three.
 */
export function evaluatePeriodClose(request: CloseRequest): PeriodDecision {
  const refusals: PeriodRefusal[] = [];
  const { period } = request;

  if (!request.actorCapabilities.includes(Capability.ACCOUNTING_PACKAGE_CLOSE)) {
    // The external accountant deliberately does not hold this: daily
    // bookkeeping is theirs, declaring the month finished is not.
    refusals.push(PeriodRefusal.ACTOR_LACKS_PACKAGE_CLOSE);
  }

  if (period.status === PeriodStatus.CLOSED) {
    refusals.push(PeriodRefusal.PERIOD_ALREADY_CLOSED);
    return { permitted: false, refusals };
  }
  if (period.status !== PeriodStatus.CLOSING) {
    refusals.push(PeriodRefusal.PERIOD_NOT_CLOSING);
  }

  // Declaring a period finished while it is still running claims finality over
  // time that has not happened yet.
  if (period.periodEnd.getTime() > request.now.getTime()) {
    refusals.push(PeriodRefusal.PERIOD_HAS_NOT_ENDED);
  }

  if (request.outstandingDerivedTasks > 0) {
    refusals.push(PeriodRefusal.WORK_OUTSTANDING);
  }
  if (request.unsignedDocuments > 0) {
    refusals.push(PeriodRefusal.UNSIGNED_DOCUMENTS);
  }
  if (request.undecidedServiceLines > 0) {
    refusals.push(PeriodRefusal.SERVICE_LINES_UNDECIDED);
  }

  return { permitted: refusals.length === 0, refusals };
}

export interface OpenRequest {
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly existing: readonly PeriodView[];
  readonly actorCapabilities: readonly string[];
}

/**
 * Whether this window may be opened.
 *
 * Half-open, so a successor beginning exactly where its predecessor ends is a
 * handover rather than an overlap — the same convention the regulatory rule
 * registry and the tax profiles already use, and worth keeping identical: a
 * reader who learns it once should not have to re-learn it per table.
 */
export function evaluatePeriodOpen(request: OpenRequest): PeriodDecision {
  const refusals: PeriodRefusal[] = [];

  if (!request.actorCapabilities.includes(Capability.ACCOUNTING_PACKAGE_CLOSE)) {
    refusals.push(PeriodRefusal.ACTOR_LACKS_PACKAGE_CLOSE);
  }
  if (request.periodEnd.getTime() <= request.periodStart.getTime()) {
    refusals.push(PeriodRefusal.WINDOW_IS_EMPTY);
  }

  const overlaps = request.existing.some(
    (other) =>
      other.periodStart.getTime() < request.periodEnd.getTime() &&
      other.periodEnd.getTime() > request.periodStart.getTime(),
  );
  if (overlaps) refusals.push(PeriodRefusal.WINDOW_OVERLAPS);

  return { permitted: refusals.length === 0, refusals };
}

export const SuccessorRefusal = {
  /** The window is not one calendar month, so its successor is a guess. */
  NOT_A_CALENDAR_MONTH: 'NOT_A_CALENDAR_MONTH',
} as const;
export type SuccessorRefusal =
  (typeof SuccessorRefusal)[keyof typeof SuccessorRefusal];

export interface SuccessorWindow {
  readonly periodStart: Date;
  readonly periodEnd: Date;
}

export interface SuccessorDecision {
  readonly window: SuccessorWindow | null;
  readonly refusals: readonly SuccessorRefusal[];
}

/**
 * The window that follows this one.
 *
 * Only for a period that is exactly one calendar month, starting at midnight
 * UTC on the first. Anything else gets nothing rather than a guess: carrying the
 * predecessor's length forward would give February's successor twenty-eight
 * days, and a period boundary that is wrong by three days is wrong in every
 * document the month contains.
 *
 * The successor starts exactly where this one ends, which is why the windows
 * are half-open in the first place.
 */
export function deriveSuccessorWindow(period: {
  periodStart: Date;
  periodEnd: Date;
}): SuccessorDecision {
  const start = period.periodStart;
  const end = period.periodEnd;

  const startsOnAMonth =
    start.getUTCDate() === 1 &&
    start.getUTCHours() === 0 &&
    start.getUTCMinutes() === 0 &&
    start.getUTCSeconds() === 0 &&
    start.getUTCMilliseconds() === 0;

  const expectedEnd = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth() + 1,
    1,
    0,
    0,
    0,
    0,
  );

  if (!startsOnAMonth || end.getTime() !== expectedEnd) {
    return { window: null, refusals: [SuccessorRefusal.NOT_A_CALENDAR_MONTH] };
  }

  return {
    window: {
      periodStart: new Date(expectedEnd),
      periodEnd: new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 2, 1, 0, 0, 0, 0),
      ),
    },
    refusals: [],
  };
}

export const PeriodReadiness = {
  READY_TO_CLOSE: 'READY_TO_CLOSE',
  WAITING_ON_WORK: 'WAITING_ON_WORK',
  STILL_RUNNING: 'STILL_RUNNING',
  CLOSED: 'CLOSED',
} as const;
export type PeriodReadiness = (typeof PeriodReadiness)[keyof typeof PeriodReadiness];

/**
 * The dashboard's "готово к закрытию" signal.
 *
 * Deliberately independent of who is looking: whether the month is finishable
 * is a fact about the month. Whether this person may finish it is the separate
 * question evaluatePeriodClose answers, and merging the two would show a farmer
 * "не готово" when the truth is "готово, но не вами".
 */
export function describeReadiness(
  period: PeriodView,
  outstandingDerivedTasks: number,
  unsignedDocuments: number,
  now: Date,
  // Defaulted so the existing callers keep their meaning: a reader who passes
  // three counts is asking the same question they were before, and gets the
  // same answer.
  undecidedServiceLines = 0,
): PeriodReadiness {
  if (period.status === PeriodStatus.CLOSED) return PeriodReadiness.CLOSED;
  if (period.periodEnd.getTime() > now.getTime()) return PeriodReadiness.STILL_RUNNING;
  if (
    outstandingDerivedTasks > 0
    || unsignedDocuments > 0
    || undecidedServiceLines > 0
  ) {
    return PeriodReadiness.WAITING_ON_WORK;
  }
  return PeriodReadiness.READY_TO_CLOSE;
}
