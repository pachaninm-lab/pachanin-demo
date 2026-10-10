/**
 * What may be recorded as a payment, and what it may be allocated to.
 *
 * Pure decisions. Every number they rest on — what the bank says the operation
 * was, how much of the payment is already allocated, how much of the obligation
 * is already settled — is read by the repository and passed in. A command that
 * could state its own unallocated remainder is a command that can pay one debt
 * twice.
 *
 * The database enforces all of this again. This layer exists to answer "why not"
 * in words somebody can act on; the guards exist so that a script bypassing this
 * layer still cannot allocate more than was paid.
 */

export const PaymentDirection = {
  /** Money into this organization. */
  INCOMING: 'INCOMING',
  /** Money out of it. */
  OUTGOING: 'OUTGOING',
} as const;
export type PaymentDirection =
  (typeof PaymentDirection)[keyof typeof PaymentDirection];

export const KNOWN_CURRENCIES: readonly string[] = Object.freeze([
  'RUB',
  'USD',
  'EUR',
  'CNY',
]);

export const PaymentRefusal = {
  NOT_AUTHORISED: 'NOT_AUTHORISED',
  AMOUNT_IS_NOT_MONEY: 'AMOUNT_IS_NOT_MONEY',
  DIRECTION_UNKNOWN: 'DIRECTION_UNKNOWN',
  CURRENCY_UNKNOWN: 'CURRENCY_UNKNOWN',
  EVIDENCE_MISSING: 'EVIDENCE_MISSING',
  EVIDENCE_NOT_CONFIRMED: 'EVIDENCE_NOT_CONFIRMED',
  /** The operation is for another deal, another amount or another currency. */
  EVIDENCE_DISAGREES: 'EVIDENCE_DISAGREES',
  /** The same transfer is already an advance, or already another payment. */
  EVIDENCE_ALREADY_USED: 'EVIDENCE_ALREADY_USED',
  COUNTERPARTY_IS_SELF: 'COUNTERPARTY_IS_SELF',
  PERIOD_CLOSED: 'PERIOD_CLOSED',
  IDEMPOTENCY_KEY_MISSING: 'IDEMPOTENCY_KEY_MISSING',
} as const;
export type PaymentRefusal =
  (typeof PaymentRefusal)[keyof typeof PaymentRefusal];

export const AllocationRefusal = {
  NOT_AUTHORISED: 'NOT_AUTHORISED',
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  AMOUNT_IS_NOT_MONEY: 'AMOUNT_IS_NOT_MONEY',
  /** Neither obligation named, or both. */
  TARGET_IS_NOT_ONE: 'TARGET_IS_NOT_ONE',
  OBLIGATION_NOT_FOUND: 'OBLIGATION_NOT_FOUND',
  /** Not approved, a reversal, or reversed since. Nothing is owed on it. */
  OBLIGATION_NOT_OWED: 'OBLIGATION_NOT_OWED',
  DEAL_MISMATCH: 'DEAL_MISMATCH',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  /** More than was paid. */
  EXCEEDS_PAYMENT: 'EXCEEDS_PAYMENT',
  /** More than the obligation is for. */
  EXCEEDS_OBLIGATION: 'EXCEEDS_OBLIGATION',
  PERIOD_CLOSED: 'PERIOD_CLOSED',
  REASON_MISSING: 'REASON_MISSING',
  IDEMPOTENCY_KEY_MISSING: 'IDEMPOTENCY_KEY_MISSING',
} as const;
export type AllocationRefusal =
  (typeof AllocationRefusal)[keyof typeof AllocationRefusal];

export interface PaymentDecision<TRefusal> {
  readonly permitted: boolean;
  readonly refusals: readonly TRefusal[];
}

export interface BankEvidenceFacts {
  readonly found: boolean;
  readonly confirmed: boolean;
  readonly dealId: string | null;
  readonly amountKopecks: bigint | null;
  readonly currency: string | null;
  /** Already cited by an advance or another payment in this organization. */
  readonly alreadyUsed: boolean;
}

function blank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === '';
}

export interface RecordPaymentFacts {
  readonly mayRecord: boolean;
  readonly organizationId: string;
  readonly counterpartyOrgId: string;
  readonly dealId: string;
  readonly direction: string;
  readonly amountKopecks: bigint;
  readonly currency: string;
  readonly bankOperationId: string;
  readonly idempotencyKey: string;
  readonly evidence: BankEvidenceFacts;
  readonly paidMonthIsClosed: boolean;
}

export function evaluateRecordPayment(
  facts: RecordPaymentFacts,
): PaymentDecision<PaymentRefusal> {
  const refusals: PaymentRefusal[] = [];

  if (facts.mayRecord === false) refusals.push(PaymentRefusal.NOT_AUTHORISED);
  if (facts.amountKopecks <= 0n) refusals.push(PaymentRefusal.AMOUNT_IS_NOT_MONEY);
  if (blank(facts.idempotencyKey)) {
    refusals.push(PaymentRefusal.IDEMPOTENCY_KEY_MISSING);
  }
  if (
    facts.direction !== PaymentDirection.INCOMING
    && facts.direction !== PaymentDirection.OUTGOING
  ) {
    refusals.push(PaymentRefusal.DIRECTION_UNKNOWN);
  }
  if (KNOWN_CURRENCIES.includes(facts.currency) === false) {
    refusals.push(PaymentRefusal.CURRENCY_UNKNOWN);
  }
  if (facts.counterpartyOrgId === facts.organizationId) {
    refusals.push(PaymentRefusal.COUNTERPARTY_IS_SELF);
  }
  if (blank(facts.bankOperationId)) refusals.push(PaymentRefusal.EVIDENCE_MISSING);

  if (blank(facts.bankOperationId) === false) {
    if (facts.evidence.found === false) {
      refusals.push(PaymentRefusal.EVIDENCE_MISSING);
    } else if (facts.evidence.confirmed === false) {
      refusals.push(PaymentRefusal.EVIDENCE_NOT_CONFIRMED);
    } else if (
      facts.evidence.dealId !== facts.dealId
      || facts.evidence.amountKopecks !== facts.amountKopecks
      || facts.evidence.currency !== facts.currency
    ) {
      refusals.push(PaymentRefusal.EVIDENCE_DISAGREES);
    } else if (facts.evidence.alreadyUsed) {
      // Checked last on purpose: an operation that disagrees is a different
      // complaint, and reporting both would send somebody looking for a
      // duplicate of a transfer they never actually cited.
      refusals.push(PaymentRefusal.EVIDENCE_ALREADY_USED);
    }
  }

  if (facts.paidMonthIsClosed) refusals.push(PaymentRefusal.PERIOD_CLOSED);

  return { permitted: refusals.length === 0, refusals };
}

export interface ObligationFacts {
  readonly found: boolean;
  /** Approved, not itself a reversal, and not reversed since. */
  readonly owed: boolean;
  readonly dealId: string | null;
  readonly currency: string | null;
  readonly amountKopecks: bigint | null;
  readonly alreadySettledKopecks: bigint;
}

export interface AllocatePaymentFacts {
  readonly mayAllocate: boolean;
  readonly paymentFound: boolean;
  readonly paymentDealId: string | null;
  readonly paymentCurrency: string | null;
  readonly paymentAmountKopecks: bigint;
  readonly alreadyAllocatedKopecks: bigint;
  readonly amountKopecks: bigint;
  readonly documentVersionId: string | null;
  readonly dealServiceId: string | null;
  /** Null when the target is a document version, which this slice does not
   * verify beyond its existence — see the repository. */
  readonly obligation: ObligationFacts | null;
  readonly allocationMonthIsClosed: boolean;
  readonly reason: string;
  readonly idempotencyKey: string;
}

export function evaluateAllocatePayment(
  facts: AllocatePaymentFacts,
): PaymentDecision<AllocationRefusal> {
  const refusals: AllocationRefusal[] = [];

  if (facts.mayAllocate === false) refusals.push(AllocationRefusal.NOT_AUTHORISED);
  if (facts.paymentFound === false) {
    refusals.push(AllocationRefusal.PAYMENT_NOT_FOUND);
    // Nothing below can be judged without the payment, and guessing would turn
    // "no such payment" into a list of unrelated complaints.
    return { permitted: false, refusals };
  }
  if (facts.amountKopecks <= 0n) {
    refusals.push(AllocationRefusal.AMOUNT_IS_NOT_MONEY);
  }
  if (blank(facts.reason)) refusals.push(AllocationRefusal.REASON_MISSING);
  if (blank(facts.idempotencyKey)) {
    refusals.push(AllocationRefusal.IDEMPOTENCY_KEY_MISSING);
  }

  const named =
    (facts.documentVersionId === null ? 0 : 1)
    + (facts.dealServiceId === null ? 0 : 1);
  if (named !== 1) refusals.push(AllocationRefusal.TARGET_IS_NOT_ONE);

  if (
    facts.alreadyAllocatedKopecks + facts.amountKopecks
    > facts.paymentAmountKopecks
  ) {
    refusals.push(AllocationRefusal.EXCEEDS_PAYMENT);
  }
  if (facts.allocationMonthIsClosed) refusals.push(AllocationRefusal.PERIOD_CLOSED);

  const obligation = facts.obligation;
  if (obligation !== null) {
    if (obligation.found === false) {
      refusals.push(AllocationRefusal.OBLIGATION_NOT_FOUND);
      return { permitted: false, refusals };
    }
    if (obligation.owed === false) refusals.push(AllocationRefusal.OBLIGATION_NOT_OWED);
    if (obligation.dealId !== facts.paymentDealId) {
      refusals.push(AllocationRefusal.DEAL_MISMATCH);
    }
    if (obligation.currency !== facts.paymentCurrency) {
      refusals.push(AllocationRefusal.CURRENCY_MISMATCH);
    }
    if (
      obligation.amountKopecks !== null
      && obligation.alreadySettledKopecks + facts.amountKopecks
        > obligation.amountKopecks
    ) {
      refusals.push(AllocationRefusal.EXCEEDS_OBLIGATION);
    }
  }

  return { permitted: refusals.length === 0, refusals };
}

/**
 * What is left of a payment to allocate.
 *
 * Derived every time from the allocations, never stored. A cached remainder is a
 * second source of truth for the same number, and the two only have to disagree
 * once for a debt to be settled from money that was already spent elsewhere.
 */
export function unallocatedKopecks(
  paymentAmountKopecks: bigint,
  allocatedKopecks: bigint,
): bigint {
  const left = paymentAmountKopecks - allocatedKopecks;
  return left > 0n ? left : 0n;
}
