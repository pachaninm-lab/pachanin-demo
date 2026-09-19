import {
  P7_RECONCILIATION_LABELS,
  P7_RELEASE_BLOCKER_LABELS,
  decideMoneyRelease,
  reconcileMoneyEventWithLedger,
  type P7LedgerEntry,
  type P7MoneyEvent,
  type P7MoneyReconciliationDecision,
  type P7ReleaseDecision,
  type P7ReleaseGuardInput,
} from './money-safety';

export type P7MoneySafetyTone = 'safe' | 'blocked' | 'review';

export interface P7MoneySafetyAuditInput extends P7ReleaseGuardInput {
  readonly ledger?: readonly P7LedgerEntry[];
  readonly latestBankEvent?: P7MoneyEvent;
}

export interface P7MoneySafetyAuditRow {
  readonly dealId: string;
  readonly tone: P7MoneySafetyTone;
  readonly primaryLabel: string;
  readonly reasonLabels: string[];
  readonly idempotencyKey: string;
  readonly releaseDecision: P7ReleaseDecision;
  readonly reconciliationDecision?: P7MoneyReconciliationDecision;
}

function releaseLabels(decision: P7ReleaseDecision): string[] {
  if (decision.state === 'releasable') return ['Резерв, документы, банк и gates чистые'];
  return decision.blockers.map((code) => P7_RELEASE_BLOCKER_LABELS[code]);
}

function primaryReleaseLabel(decision: P7ReleaseDecision): string {
  if (decision.state === 'releasable') return 'Деньги готовы к выпуску';
  return P7_RELEASE_BLOCKER_LABELS[decision.reasonCode];
}

function reconciliationLabels(decision: P7MoneyReconciliationDecision): string[] {
  if (decision.state === 'matched') return [P7_RECONCILIATION_LABELS.MATCHED];
  return [P7_RECONCILIATION_LABELS[decision.reasonCode]];
}

export function buildMoneySafetyAuditRow(input: P7MoneySafetyAuditInput): P7MoneySafetyAuditRow {
  const releaseDecision = decideMoneyRelease(input);
  const reconciliationDecision = input.latestBankEvent
    ? reconcileMoneyEventWithLedger(input.ledger ?? [], input.latestBankEvent)
    : undefined;

  if (reconciliationDecision?.state === 'manual_review') {
    return {
      dealId: input.dealId,
      tone: 'review',
      primaryLabel: P7_RECONCILIATION_LABELS[reconciliationDecision.reasonCode],
      reasonLabels: [...reconciliationLabels(reconciliationDecision), ...releaseLabels(releaseDecision)],
      idempotencyKey: reconciliationDecision.idempotencyKey,
      releaseDecision,
      reconciliationDecision,
    };
  }

  if (releaseDecision.state === 'blocked') {
    return {
      dealId: input.dealId,
      tone: 'blocked',
      primaryLabel: primaryReleaseLabel(releaseDecision),
      reasonLabels: releaseLabels(releaseDecision),
      idempotencyKey: releaseDecision.idempotencyKey,
      releaseDecision,
      reconciliationDecision,
    };
  }

  return {
    dealId: input.dealId,
    tone: 'safe',
    primaryLabel: primaryReleaseLabel(releaseDecision),
    reasonLabels: reconciliationDecision ? reconciliationLabels(reconciliationDecision) : releaseLabels(releaseDecision),
    idempotencyKey: reconciliationDecision?.idempotencyKey ?? releaseDecision.idempotencyKey,
    releaseDecision,
    reconciliationDecision,
  };
}
