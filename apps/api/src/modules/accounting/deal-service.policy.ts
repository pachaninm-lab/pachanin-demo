/**
 * What may be charged as a service on a deal, and what may be done to a line
 * once it exists.
 *
 * Pure decisions. Everything a decision rests on — whether the month is closed,
 * what the line being reversed actually says, who recorded it — is read by the
 * repository from the row policies' own view and passed in. A command that could
 * state its own original terms is a command that can reverse a large charge with
 * a small one.
 *
 * The database enforces all of this again through CHECK constraints and a guard,
 * and deliberately so. This layer exists to answer "why not" in words somebody
 * can act on; the constraints exist so that a script bypassing this layer still
 * cannot bill more ton-days than the storage window holds.
 */

export const ServiceKind = {
  STORAGE: 'STORAGE',
  DRYING: 'DRYING',
  CLEANING: 'CLEANING',
  TRANSSHIPMENT: 'TRANSSHIPMENT',
  WEIGHING: 'WEIGHING',
  LOADING: 'LOADING',
} as const;
export type ServiceKind = (typeof ServiceKind)[keyof typeof ServiceKind];

export const ServiceUnit = {
  /** Storage: tons held, for whole days. */
  TON_DAY: 'TON_DAY',
  /** Handling charged by weight. */
  TON: 'TON',
  /** Counted events, such as a weighing. */
  OPERATION: 'OPERATION',
} as const;
export type ServiceUnit = (typeof ServiceUnit)[keyof typeof ServiceUnit];

/**
 * The unit is a function of the kind, not an independent choice. Stored on the
 * row so a report can read it without knowing this table, and derived here so
 * the two cannot disagree — the same mapping is a CHECK constraint.
 */
export const UNIT_FOR_KIND: Readonly<Record<ServiceKind, ServiceUnit>> =
  Object.freeze({
    [ServiceKind.STORAGE]: ServiceUnit.TON_DAY,
    [ServiceKind.DRYING]: ServiceUnit.TON,
    [ServiceKind.CLEANING]: ServiceUnit.TON,
    [ServiceKind.TRANSSHIPMENT]: ServiceUnit.TON,
    [ServiceKind.WEIGHING]: ServiceUnit.OPERATION,
    [ServiceKind.LOADING]: ServiceUnit.OPERATION,
  });

export const ServiceStatus = {
  RENDERED: 'RENDERED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type ServiceStatus = (typeof ServiceStatus)[keyof typeof ServiceStatus];

export const KNOWN_CURRENCIES: readonly string[] = Object.freeze([
  'RUB',
  'USD',
  'EUR',
  'CNY',
]);

/**
 * Quantities are held in thousandths of the unit and rates in kopecks per whole
 * unit, so the product before rounding runs a thousand times larger than the
 * amount. These bounds keep it inside a 64-bit integer with room to spare, and
 * they are the same numbers the CHECK constraints carry: an implausible line is
 * refused with a reason rather than raising an arithmetic error nobody can act
 * on.
 */
export const MAX_QUANTITY_MILLI_UNITS = 10_000_000_000n;
export const MAX_RATE_KOPECKS = 100_000_000n;

const MILLI = 1_000n;
const SECONDS_PER_DAY = 86_400n;

export const ServiceRefusal = {
  NOT_AUTHORISED: 'NOT_AUTHORISED',
  KIND_UNKNOWN: 'KIND_UNKNOWN',
  CURRENCY_UNKNOWN: 'CURRENCY_UNKNOWN',
  QUANTITY_IS_NOT_A_QUANTITY: 'QUANTITY_IS_NOT_A_QUANTITY',
  QUANTITY_OUT_OF_RANGE: 'QUANTITY_OUT_OF_RANGE',
  RATE_IS_NOT_A_RATE: 'RATE_IS_NOT_A_RATE',
  RATE_OUT_OF_RANGE: 'RATE_OUT_OF_RANGE',
  /** Storage without the window it was stored for. */
  WINDOW_MISSING: 'WINDOW_MISSING',
  /** A window on a service that is not charged by time. */
  WINDOW_NOT_ALLOWED: 'WINDOW_NOT_ALLOWED',
  WINDOW_NOT_WHOLE_DAYS: 'WINDOW_NOT_WHOLE_DAYS',
  TONNAGE_MISSING: 'TONNAGE_MISSING',
  TONNAGE_NOT_ALLOWED: 'TONNAGE_NOT_ALLOWED',
  /** The ton-days billed are not the tonnage times the days of the window. */
  TON_DAYS_DISAGREE_WITH_WINDOW: 'TON_DAYS_DISAGREE_WITH_WINDOW',
  OPERATIONS_ARE_NOT_WHOLE: 'OPERATIONS_ARE_NOT_WHOLE',
  COUNTERPARTY_IS_SELF: 'COUNTERPARTY_IS_SELF',
  PERIOD_CLOSED: 'PERIOD_CLOSED',
  IDEMPOTENCY_KEY_MISSING: 'IDEMPOTENCY_KEY_MISSING',
} as const;
export type ServiceRefusal =
  (typeof ServiceRefusal)[keyof typeof ServiceRefusal];

export const DecisionRefusal = {
  NOT_AUTHORISED: 'NOT_AUTHORISED',
  SERVICE_NOT_FOUND: 'SERVICE_NOT_FOUND',
  /** Already approved or already rejected. Both are final. */
  ALREADY_DECIDED: 'ALREADY_DECIDED',
  /** Approving your own line is one person doing both halves of the rule. */
  APPROVER_IS_RECORDER: 'APPROVER_IS_RECORDER',
  PERIOD_CLOSED: 'PERIOD_CLOSED',
} as const;
export type DecisionRefusal =
  (typeof DecisionRefusal)[keyof typeof DecisionRefusal];

export const ReversalRefusal = {
  NOT_AUTHORISED: 'NOT_AUTHORISED',
  ORIGINAL_NOT_FOUND: 'ORIGINAL_NOT_FOUND',
  /** Only a line that was approved has an effect to reverse. */
  ORIGINAL_NOT_APPROVED: 'ORIGINAL_NOT_APPROVED',
  ORIGINAL_IS_REVERSAL: 'ORIGINAL_IS_REVERSAL',
  ALREADY_REVERSED: 'ALREADY_REVERSED',
  PERIOD_CLOSED: 'PERIOD_CLOSED',
  IDEMPOTENCY_KEY_MISSING: 'IDEMPOTENCY_KEY_MISSING',
} as const;
export type ReversalRefusal =
  (typeof ReversalRefusal)[keyof typeof ReversalRefusal];

export interface ServiceDecision<TRefusal> {
  readonly permitted: boolean;
  readonly refusals: readonly TRefusal[];
}

function blank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === '';
}

export function isServiceKind(value: unknown): value is ServiceKind {
  return typeof value === 'string'
    && Object.prototype.hasOwnProperty.call(UNIT_FOR_KIND, value);
}

/**
 * The amount a line comes to, rounded half up.
 *
 * Integer arithmetic throughout, and the same expression the CHECK constraint
 * carries. Rounding a service charge through a floating point multiplication is
 * how two parties end up with totals a kopeck apart and no way to say which of
 * them is right.
 */
export function amountKopecks(
  quantityMilliUnits: bigint,
  rateKopecks: bigint,
): bigint {
  return (quantityMilliUnits * rateKopecks + 500n) / MILLI;
}

/**
 * Whole days between two instants, or null when the window is not a whole
 * number of days.
 *
 * Not rounded: a window that does not divide into days is refused rather than
 * quietly billed as the next day up.
 */
export function wholeDays(from: Date, to: Date): bigint | null {
  const milliseconds = BigInt(to.getTime() - from.getTime());
  if (milliseconds <= 0n) return null;
  const seconds = milliseconds / 1000n;
  if (milliseconds % 1000n !== 0n) return null;
  if (seconds % SECONDS_PER_DAY !== 0n) return null;
  return seconds / SECONDS_PER_DAY;
}

export interface RecordServiceFacts {
  readonly mayRecord: boolean;
  readonly organizationId: string;
  readonly counterpartyOrgId: string;
  readonly kind: string;
  readonly quantityMilliUnits: bigint;
  readonly tonnageMilliTons: bigint | null;
  readonly periodFrom: Date | null;
  readonly periodTo: Date | null;
  readonly rateKopecks: bigint;
  readonly currency: string;
  readonly idempotencyKey: string;
  readonly renderedMonthIsClosed: boolean;
}

export function evaluateRecordService(
  facts: RecordServiceFacts,
): ServiceDecision<ServiceRefusal> {
  const refusals: ServiceRefusal[] = [];

  if (facts.mayRecord === false) refusals.push(ServiceRefusal.NOT_AUTHORISED);
  if (blank(facts.idempotencyKey)) {
    refusals.push(ServiceRefusal.IDEMPOTENCY_KEY_MISSING);
  }
  if (facts.counterpartyOrgId === facts.organizationId) {
    refusals.push(ServiceRefusal.COUNTERPARTY_IS_SELF);
  }
  if (KNOWN_CURRENCIES.includes(facts.currency) === false) {
    refusals.push(ServiceRefusal.CURRENCY_UNKNOWN);
  }
  if (facts.quantityMilliUnits <= 0n) {
    refusals.push(ServiceRefusal.QUANTITY_IS_NOT_A_QUANTITY);
  } else if (facts.quantityMilliUnits > MAX_QUANTITY_MILLI_UNITS) {
    refusals.push(ServiceRefusal.QUANTITY_OUT_OF_RANGE);
  }
  if (facts.rateKopecks <= 0n) {
    refusals.push(ServiceRefusal.RATE_IS_NOT_A_RATE);
  } else if (facts.rateKopecks > MAX_RATE_KOPECKS) {
    refusals.push(ServiceRefusal.RATE_OUT_OF_RANGE);
  }

  if (isServiceKind(facts.kind) === false) {
    // Without a known kind there is no unit, and every check below is about
    // whether the line matches its unit. Judging them anyway would produce
    // complaints about a shape nobody claimed.
    refusals.push(ServiceRefusal.KIND_UNKNOWN);
    return { permitted: false, refusals };
  }

  const unit = UNIT_FOR_KIND[facts.kind];
  const hasWindow = facts.periodFrom !== null && facts.periodTo !== null;

  if (unit === ServiceUnit.TON_DAY) {
    if (hasWindow === false) refusals.push(ServiceRefusal.WINDOW_MISSING);
    if (facts.tonnageMilliTons === null) {
      refusals.push(ServiceRefusal.TONNAGE_MISSING);
    }
    if (hasWindow && facts.tonnageMilliTons !== null) {
      const days = wholeDays(
        facts.periodFrom as Date,
        facts.periodTo as Date,
      );
      if (days === null) {
        refusals.push(ServiceRefusal.WINDOW_NOT_WHOLE_DAYS);
      } else if (
        facts.tonnageMilliTons <= 0n
        || facts.quantityMilliUnits !== facts.tonnageMilliTons * days
      ) {
        // The arithmetic a storage charge is inflated through: the same window
        // billed for more tonnage, or the same tonnage for more days than the
        // window holds.
        refusals.push(ServiceRefusal.TON_DAYS_DISAGREE_WITH_WINDOW);
      }
    }
  } else {
    if (facts.periodFrom !== null || facts.periodTo !== null) {
      refusals.push(ServiceRefusal.WINDOW_NOT_ALLOWED);
    }
    if (facts.tonnageMilliTons !== null) {
      refusals.push(ServiceRefusal.TONNAGE_NOT_ALLOWED);
    }
  }

  if (
    unit === ServiceUnit.OPERATION
    && facts.quantityMilliUnits > 0n
    && facts.quantityMilliUnits % MILLI !== 0n
  ) {
    refusals.push(ServiceRefusal.OPERATIONS_ARE_NOT_WHOLE);
  }

  if (facts.renderedMonthIsClosed) refusals.push(ServiceRefusal.PERIOD_CLOSED);

  return { permitted: refusals.length === 0, refusals };
}

export interface DecideServiceFacts {
  readonly mayDecide: boolean;
  readonly serviceFound: boolean;
  readonly intended: ServiceStatus;
  readonly currentStatus: ServiceStatus | null;
  readonly recordedByMembershipId: string | null;
  readonly decidingMembershipId: string | null;
  readonly renderedMonthIsClosed: boolean;
}

/**
 * Approving or rejecting a rendered line.
 *
 * The second-person rule applies to approval only. Rejecting a line you raised
 * yourself is withdrawing it, which needs no independent pair of eyes; approving
 * it is agreeing that money is owed, which does.
 */
export function evaluateDecideService(
  facts: DecideServiceFacts,
): ServiceDecision<DecisionRefusal> {
  const refusals: DecisionRefusal[] = [];

  if (facts.mayDecide === false) refusals.push(DecisionRefusal.NOT_AUTHORISED);
  if (facts.serviceFound === false) {
    refusals.push(DecisionRefusal.SERVICE_NOT_FOUND);
    return { permitted: false, refusals };
  }
  if (facts.currentStatus !== ServiceStatus.RENDERED) {
    refusals.push(DecisionRefusal.ALREADY_DECIDED);
  }
  if (
    facts.intended === ServiceStatus.APPROVED
    && facts.decidingMembershipId !== null
    && facts.decidingMembershipId === facts.recordedByMembershipId
  ) {
    refusals.push(DecisionRefusal.APPROVER_IS_RECORDER);
  }
  if (facts.intended === ServiceStatus.APPROVED && facts.renderedMonthIsClosed) {
    // A rejection in a closed month changes nothing that was reported: the line
    // was never approved, so it was never in the figures.
    refusals.push(DecisionRefusal.PERIOD_CLOSED);
  }

  return { permitted: refusals.length === 0, refusals };
}

export interface ReverseServiceFacts {
  readonly mayReverse: boolean;
  readonly originalFound: boolean;
  readonly originalStatus: ServiceStatus | null;
  readonly originalIsReversal: boolean;
  readonly originalAlreadyReversed: boolean;
  /**
   * The month the *reversal* falls in, not the original's.
   *
   * A correction is dated when it is made. Posting it back into the month being
   * corrected would move a figure that has already been reported as final, so a
   * reversal of a charge from a closed month lands in the open one — the deal's
   * net is right either way, and the closed month stays as it was reported.
   */
  readonly reversalMonthIsClosed: boolean;
  readonly idempotencyKey: string;
}

/**
 * Reversing an approved line.
 *
 * The reversal repeats the original's terms exactly, so nothing about the amount
 * is decided here — the repository copies them from the row it read under lock,
 * and the guard refuses a reversal that does not match. What is decided here is
 * whether the original is a thing that can be reversed at all.
 */
export function evaluateReverseService(
  facts: ReverseServiceFacts,
): ServiceDecision<ReversalRefusal> {
  const refusals: ReversalRefusal[] = [];

  if (facts.mayReverse === false) refusals.push(ReversalRefusal.NOT_AUTHORISED);
  if (blank(facts.idempotencyKey)) {
    refusals.push(ReversalRefusal.IDEMPOTENCY_KEY_MISSING);
  }
  if (facts.originalFound === false) {
    refusals.push(ReversalRefusal.ORIGINAL_NOT_FOUND);
    return { permitted: false, refusals };
  }
  if (facts.originalStatus !== ServiceStatus.APPROVED) {
    refusals.push(ReversalRefusal.ORIGINAL_NOT_APPROVED);
  }
  if (facts.originalIsReversal) refusals.push(ReversalRefusal.ORIGINAL_IS_REVERSAL);
  if (facts.originalAlreadyReversed) refusals.push(ReversalRefusal.ALREADY_REVERSED);
  if (facts.reversalMonthIsClosed) refusals.push(ReversalRefusal.PERIOD_CLOSED);

  return { permitted: refusals.length === 0, refusals };
}

export interface ServiceLineAmount {
  readonly status: ServiceStatus;
  readonly amountKopecks: bigint;
  readonly isReversal: boolean;
}

/**
 * What the deal actually owes for services.
 *
 * Approved lines count, reversals count against, and nothing else counts at all.
 * Derived on every read: a stored total is a second source of truth for the same
 * number, and the two only have to disagree once for somebody to be invoiced for
 * a charge that was reversed.
 */
export function netKopecks(lines: readonly ServiceLineAmount[]): bigint {
  return lines.reduce((total, line) => {
    if (line.status !== ServiceStatus.APPROVED) return total;
    return line.isReversal ? total - line.amountKopecks : total + line.amountKopecks;
  }, 0n);
}
