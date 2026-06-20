/**
 * RuntimeCore decomposition — Step 5: MoneyEngine (computation/decision only).
 *
 * Extracts the *pure money computations and the refreshDealRuntime decision
 * ladder* out of RuntimeCoreService. This is the sensitive core, so the split is
 * deliberately conservative and behavior-preserving:
 *
 *  - This engine is STATELESS. It does no I/O, allocates no ids, mutates no
 *    payment/deal. It only computes values and *decides* which runtime branch
 *    applies, returning a discriminated decision.
 *  - Payment/money-event STORAGE and id generation (ensurePayment,
 *    pushMoneyEvent, the payments[]/moneyEvents[] arrays and counters) stay in
 *    RuntimeCore on purpose — that is a repository/DB concern that a future
 *    DB-backed path will own, not this engine.
 *  - The money INVARIANTS are unchanged: release stays bank-callback driven and
 *    blocker-gated, the platform never self-confirms or self-releases, and the
 *    decision ladder's ordering/outputs are identical to the previous inline
 *    code (the settlement money-flow spec stays green). No idempotency or
 *    persistence is introduced here — those remain locked.
 *
 * Controlled-pilot / pre-integration.
 */

/** Per-failed-test quality penalty applied to a sample's money delta. */
export const FAILED_TEST_PENALTY_RUB = -125000;

/** Snapshot the decision ladder needs — all primitives, no live objects mutated. */
export interface MoneyRuntimeSnapshot {
  paymentStatus: string;
  dealStatus: string;
  releasedRub: number;
  callbackState?: string | null;
  reserveConfirmedAt?: unknown;
  reserveRequestedAt?: unknown;
  /** Blockers already filtered by the caller (callback-blocker dropped when RELEASED). */
  blockers: string[];
}

/**
 * The runtime branch the deal/payment resolves to. RuntimeCore applies the
 * matching field writes; the `HOLD_BLOCKERS` branch additionally resolves owner
 * / next-action *after* the status is set, preserving the original ordering.
 */
export type MoneyRuntimeDecision =
  | 'MISMATCH_HOLD'
  | 'DISPUTE_HOLD'
  | 'RELEASED'
  | 'READY_FOR_RELEASE'
  | 'RESERVE_PENDING'
  | 'HOLD_BLOCKERS'
  | 'REQUIRES_BANK';

/** Stateless money computation/decision engine. Holds no state; safe to reuse. */
export class RuntimeMoneyEngine {
  /** Quality money delta for a sample: -125000 per failed test. */
  sampleMoneyDelta(sample: { tests: { passed?: boolean }[] }): number {
    const failed = sample.tests.filter((test) => test.passed === false).length;
    return failed * FAILED_TEST_PENALTY_RUB;
  }

  /** Read-only money summary projection for a deal's payment + sample. */
  moneyImpact(payment: any, sample: any) {
    return {
      amountRub: payment.amountRub,
      disputedAmountRub: payment.disputedAmountRub ?? 0,
      undisputedAmountRub: payment.undisputedAmountRub ?? payment.amountRub,
      qualityDeltaRub: sample?.moneyDeltaRub ?? 0,
      bankEventId: payment.bankEventId,
    };
  }

  /**
   * Decides the runtime branch for refreshDealRuntime. Pure — same priority
   * ladder and conditions as the previous inline logic. RuntimeCore performs
   * the field mutations for the returned branch.
   */
  decideDealRuntime(s: MoneyRuntimeSnapshot): MoneyRuntimeDecision {
    if (s.paymentStatus === 'MISMATCH') return 'MISMATCH_HOLD';
    if (s.dealStatus === 'DISPUTE_OPEN') return 'DISPUTE_HOLD';
    if (s.releasedRub > 0 && s.callbackState === 'CONFIRMED') return 'RELEASED';
    if (s.reserveConfirmedAt && s.blockers.filter((item) => item !== 'Нет callback банка').length === 0) {
      return 'READY_FOR_RELEASE';
    }
    if (s.reserveRequestedAt && !s.reserveConfirmedAt) return 'RESERVE_PENDING';
    if (s.blockers.length > 0) return 'HOLD_BLOCKERS';
    return 'REQUIRES_BANK';
  }
}
