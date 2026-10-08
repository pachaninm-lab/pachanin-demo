import { createHash } from 'node:crypto';

/**
 * What a statement of mutual settlements comes to, and what may be done to one.
 *
 * The figures are not decided here and they are not accepted from a caller
 * either: the repository reads them from the rows. What this module owns is the
 * arithmetic that turns them into a bottom line, and the hash that lets somebody
 * check a statement against those rows later instead of trusting it.
 */

export const ReconciliationStatus = {
  PREPARED: 'PREPARED',
  AGREED: 'AGREED',
  DISPUTED: 'DISPUTED',
} as const;
export type ReconciliationStatus =
  (typeof ReconciliationStatus)[keyof typeof ReconciliationStatus];

export const ReconciliationRefusal = {
  NOT_AUTHORISED: 'NOT_AUTHORISED',
  WINDOW_IS_NOT_A_WINDOW: 'WINDOW_IS_NOT_A_WINDOW',
  COUNTERPARTY_IS_SELF: 'COUNTERPARTY_IS_SELF',
  CURRENCY_UNKNOWN: 'CURRENCY_UNKNOWN',
  /** Another statement for this counterparty already covers part of it. */
  WINDOW_OVERLAPS: 'WINDOW_OVERLAPS',
} as const;
export type ReconciliationRefusal =
  (typeof ReconciliationRefusal)[keyof typeof ReconciliationRefusal];

export const AnswerRefusal = {
  NOT_AUTHORISED: 'NOT_AUTHORISED',
  STATEMENT_NOT_FOUND: 'STATEMENT_NOT_FOUND',
  ALREADY_ANSWERED: 'ALREADY_ANSWERED',
  /** Agreeing with your own arithmetic is not agreement. */
  ANSWERER_IS_PREPARER: 'ANSWERER_IS_PREPARER',
  INTENT_UNKNOWN: 'INTENT_UNKNOWN',
} as const;
export type AnswerRefusal = (typeof AnswerRefusal)[keyof typeof AnswerRefusal];

export interface ReconciliationDecision<TRefusal> {
  readonly permitted: boolean;
  readonly refusals: readonly TRefusal[];
}

export const KNOWN_CURRENCIES: readonly string[] = Object.freeze([
  'RUB',
  'USD',
  'EUR',
  'CNY',
]);

export interface ReconciliationFigures {
  readonly openingBalanceKopecks: bigint;
  readonly chargedKopecks: bigint;
  readonly reversedKopecks: bigint;
  readonly paidKopecks: bigint;
  readonly advanceAppliedKopecks: bigint;
}

/**
 * The bottom line.
 *
 * What was owed, plus what was charged, less what was reversed, what was paid
 * and what was taken off an advance. The same expression is a CHECK constraint,
 * so a statement whose closing balance does not follow from its own figures
 * cannot be stored.
 */
export function closingBalanceKopecks(figures: ReconciliationFigures): bigint {
  return (
    figures.openingBalanceKopecks
    + figures.chargedKopecks
    - figures.reversedKopecks
    - figures.paidKopecks
    - figures.advanceAppliedKopecks
  );
}

/**
 * A hash over exactly the figures the counterparty was shown.
 *
 * Canonical by construction — fixed field order, decimal integers, no
 * formatting — so the same statement hashes the same way on both sides. Its
 * purpose is not secrecy: it is that a party holding a printed statement can ask
 * the platform whether this is still the statement it issued.
 */
export function payloadHash(input: {
  readonly dealId: string;
  readonly counterpartyOrgId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly currency: string;
  readonly figures: ReconciliationFigures;
}): string {
  const canonical = [
    input.dealId,
    input.counterpartyOrgId,
    input.periodStart.toISOString(),
    input.periodEnd.toISOString(),
    input.currency,
    input.figures.openingBalanceKopecks.toString(),
    input.figures.chargedKopecks.toString(),
    input.figures.reversedKopecks.toString(),
    input.figures.paidKopecks.toString(),
    input.figures.advanceAppliedKopecks.toString(),
    closingBalanceKopecks(input.figures).toString(),
  ].join('\n');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export interface PrepareReconciliationFacts {
  readonly mayPrepare: boolean;
  readonly organizationId: string;
  readonly counterpartyOrgId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly currency: string;
  readonly windowOverlapsAnother: boolean;
}

export function evaluatePrepareReconciliation(
  facts: PrepareReconciliationFacts,
): ReconciliationDecision<ReconciliationRefusal> {
  const refusals: ReconciliationRefusal[] = [];

  if (facts.mayPrepare === false) {
    refusals.push(ReconciliationRefusal.NOT_AUTHORISED);
  }
  if (facts.periodEnd.getTime() <= facts.periodStart.getTime()) {
    refusals.push(ReconciliationRefusal.WINDOW_IS_NOT_A_WINDOW);
  }
  if (facts.counterpartyOrgId === facts.organizationId) {
    refusals.push(ReconciliationRefusal.COUNTERPARTY_IS_SELF);
  }
  if (KNOWN_CURRENCIES.includes(facts.currency) === false) {
    refusals.push(ReconciliationRefusal.CURRENCY_UNKNOWN);
  }
  if (facts.windowOverlapsAnother) {
    refusals.push(ReconciliationRefusal.WINDOW_OVERLAPS);
  }

  return { permitted: refusals.length === 0, refusals };
}

export interface AnswerReconciliationFacts {
  readonly mayAnswer: boolean;
  readonly statementFound: boolean;
  readonly currentStatus: ReconciliationStatus | null;
  readonly intended: string;
  readonly preparedByMembershipId: string | null;
  readonly answeringMembershipId: string | null;
}

export function evaluateAnswerReconciliation(
  facts: AnswerReconciliationFacts,
): ReconciliationDecision<AnswerRefusal> {
  const refusals: AnswerRefusal[] = [];

  if (facts.mayAnswer === false) refusals.push(AnswerRefusal.NOT_AUTHORISED);
  if (facts.statementFound === false) {
    refusals.push(AnswerRefusal.STATEMENT_NOT_FOUND);
    return { permitted: false, refusals };
  }
  if (
    facts.intended !== ReconciliationStatus.AGREED
    && facts.intended !== ReconciliationStatus.DISPUTED
  ) {
    refusals.push(AnswerRefusal.INTENT_UNKNOWN);
  }
  if (facts.currentStatus !== ReconciliationStatus.PREPARED) {
    refusals.push(AnswerRefusal.ALREADY_ANSWERED);
  }
  if (
    facts.answeringMembershipId !== null
    && facts.answeringMembershipId === facts.preparedByMembershipId
  ) {
    refusals.push(AnswerRefusal.ANSWERER_IS_PREPARER);
  }

  return { permitted: refusals.length === 0, refusals };
}
