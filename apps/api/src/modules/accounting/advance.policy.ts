/**
 * What may be recorded as an advance, and what may be offset against one.
 *
 * Pure decisions. The numbers the decisions rest on — how much of the advance
 * is already spent, whether the bank operation is confirmed, whether the month
 * is closed — are read by the repository and passed in, never accepted from the
 * caller. An offset is exactly the moment somebody would like the remaining
 * balance to be larger than it is.
 *
 * The database enforces all of this again, and deliberately so. This layer
 * exists to answer "why not" in words a person can act on; the guards exist so
 * that a script bypassing this layer still cannot spend an advance twice.
 */

export const AdvanceRefusal = {
  /** The actor holds no accounting capability for this organization. */
  NOT_AUTHORISED: 'NOT_AUTHORISED',
  /** Zero or negative money. */
  AMOUNT_IS_NOT_MONEY: 'AMOUNT_IS_NOT_MONEY',
  /** No bank operation cited, or a blank reference. */
  EVIDENCE_MISSING: 'EVIDENCE_MISSING',
  /** The cited operation has not been confirmed by the bank. */
  EVIDENCE_NOT_CONFIRMED: 'EVIDENCE_NOT_CONFIRMED',
  /** The operation is for another deal, another amount or another currency. */
  EVIDENCE_DISAGREES: 'EVIDENCE_DISAGREES',
  /** The month the money arrived in is closed. */
  PERIOD_CLOSED: 'PERIOD_CLOSED',
  /** The counterparty is the organization itself. */
  COUNTERPARTY_IS_SELF: 'COUNTERPARTY_IS_SELF',
} as const;
export type AdvanceRefusal = (typeof AdvanceRefusal)[keyof typeof AdvanceRefusal];

export const OffsetRefusal = {
  NOT_AUTHORISED: 'NOT_AUTHORISED',
  AMOUNT_IS_NOT_MONEY: 'AMOUNT_IS_NOT_MONEY',
  /** The advance does not exist, or belongs to another organization. */
  ADVANCE_NOT_FOUND: 'ADVANCE_NOT_FOUND',
  /** Applying this would take the total past what actually arrived. */
  EXCEEDS_REMAINING: 'EXCEEDS_REMAINING',
  /** The month the offset would fall in is closed. */
  PERIOD_CLOSED: 'PERIOD_CLOSED',
  /** No reason given for the offset. */
  REASON_MISSING: 'REASON_MISSING',
  /** No idempotency key, so a retry could not be told from a second offset. */
  IDEMPOTENCY_KEY_MISSING: 'IDEMPOTENCY_KEY_MISSING',
} as const;
export type OffsetRefusal = (typeof OffsetRefusal)[keyof typeof OffsetRefusal];

export interface AdvanceDecision<TRefusal> {
  readonly permitted: boolean;
  readonly refusals: readonly TRefusal[];
}

export interface EvidenceFacts {
  readonly found: boolean;
  readonly confirmed: boolean;
  readonly dealId: string | null;
  readonly amountKopecks: bigint | null;
  readonly currency: string | null;
}

export interface RecordAdvanceFacts {
  readonly mayRecord: boolean;
  readonly organizationId: string;
  readonly counterpartyOrgId: string;
  readonly dealId: string;
  readonly amountKopecks: bigint;
  readonly currency: string;
  readonly bankOperationId: string;
  readonly evidence: EvidenceFacts;
  readonly arrivalMonthIsClosed: boolean;
}

function blank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === '';
}

export function evaluateRecordAdvance(
  facts: RecordAdvanceFacts,
): AdvanceDecision<AdvanceRefusal> {
  const refusals: AdvanceRefusal[] = [];

  if (facts.mayRecord === false) refusals.push(AdvanceRefusal.NOT_AUTHORISED);
  if (facts.amountKopecks <= 0n) refusals.push(AdvanceRefusal.AMOUNT_IS_NOT_MONEY);
  if (blank(facts.bankOperationId)) refusals.push(AdvanceRefusal.EVIDENCE_MISSING);
  if (facts.counterpartyOrgId === facts.organizationId) {
    refusals.push(AdvanceRefusal.COUNTERPARTY_IS_SELF);
  }

  if (blank(facts.bankOperationId) === false) {
    if (facts.evidence.found === false) {
      refusals.push(AdvanceRefusal.EVIDENCE_MISSING);
    } else if (facts.evidence.confirmed === false) {
      refusals.push(AdvanceRefusal.EVIDENCE_NOT_CONFIRMED);
    } else if (
      facts.evidence.dealId !== facts.dealId
      || facts.evidence.amountKopecks !== facts.amountKopecks
      || facts.evidence.currency !== facts.currency
    ) {
      // One refusal for all three, because the useful thing to say is "the
      // operation you cited is not this money", and naming which field differs
      // is the repository's job when it reports the numbers.
      refusals.push(AdvanceRefusal.EVIDENCE_DISAGREES);
    }
  }

  if (facts.arrivalMonthIsClosed) refusals.push(AdvanceRefusal.PERIOD_CLOSED);

  return { permitted: refusals.length === 0, refusals };
}

export interface ApplyOffsetFacts {
  readonly mayApply: boolean;
  readonly advanceFound: boolean;
  readonly amountKopecks: bigint;
  /** What the advance received, as recorded. */
  readonly advanceAmountKopecks: bigint;
  /** The sum of the offsets already applied. */
  readonly alreadyAppliedKopecks: bigint;
  readonly applicationMonthIsClosed: boolean;
  readonly reason: string;
  readonly idempotencyKey: string;
}

export function evaluateApplyOffset(
  facts: ApplyOffsetFacts,
): AdvanceDecision<OffsetRefusal> {
  const refusals: OffsetRefusal[] = [];

  if (facts.mayApply === false) refusals.push(OffsetRefusal.NOT_AUTHORISED);
  if (facts.advanceFound === false) {
    refusals.push(OffsetRefusal.ADVANCE_NOT_FOUND);
    // Nothing below can be judged without the advance, and guessing would turn
    // "no such advance" into a list of unrelated complaints.
    return { permitted: false, refusals };
  }
  if (facts.amountKopecks <= 0n) refusals.push(OffsetRefusal.AMOUNT_IS_NOT_MONEY);
  if (blank(facts.reason)) refusals.push(OffsetRefusal.REASON_MISSING);
  if (blank(facts.idempotencyKey)) {
    refusals.push(OffsetRefusal.IDEMPOTENCY_KEY_MISSING);
  }
  if (facts.alreadyAppliedKopecks + facts.amountKopecks > facts.advanceAmountKopecks) {
    refusals.push(OffsetRefusal.EXCEEDS_REMAINING);
  }
  if (facts.applicationMonthIsClosed) refusals.push(OffsetRefusal.PERIOD_CLOSED);

  return { permitted: refusals.length === 0, refusals };
}

/**
 * What is left of an advance.
 *
 * Derived every time from the offsets, never stored. A cached remaining balance
 * is a second source of truth for the same number, and the two only have to
 * disagree once for a person to be told an advance has money in it that it does
 * not.
 */
export function remainingKopecks(
  advanceAmountKopecks: bigint,
  appliedKopecks: bigint,
): bigint {
  const remaining = advanceAmountKopecks - appliedKopecks;
  return remaining > 0n ? remaining : 0n;
}
