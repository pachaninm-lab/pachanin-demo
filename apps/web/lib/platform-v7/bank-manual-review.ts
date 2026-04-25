import type { PlatformV7BankReconciliationModel } from './bank-reconciliation';

export type PlatformV7BankManualReviewReason =
  | 'ledger-mismatch'
  | 'webhook-pending'
  | 'webhook-failed'
  | 'release-over-limit'
  | 'active-dispute'
  | 'aml-review';

export type PlatformV7BankManualReviewPriority = 'low' | 'medium' | 'high' | 'critical';
export type PlatformV7BankManualReviewDecision = 'approve' | 'hold' | 'reject' | 'escalate';

export interface PlatformV7BankManualReviewCase {
  id: string;
  dealId: string;
  reason: PlatformV7BankManualReviewReason;
  priority: PlatformV7BankManualReviewPriority;
  amount: number;
  assignedTo: string;
  openedAt: string;
  slaHours: number;
}

export interface PlatformV7BankManualReviewModel {
  requiresReview: boolean;
  reasons: PlatformV7BankManualReviewReason[];
  priority: PlatformV7BankManualReviewPriority;
  recommendedDecision: PlatformV7BankManualReviewDecision;
}

export function platformV7BankManualReviewModel(input: {
  reconciliation: PlatformV7BankReconciliationModel;
  releaseAmount: number;
  releaseLimit: number;
  disputeOpen: boolean;
  amlFlag: boolean;
}): PlatformV7BankManualReviewModel {
  const reasons: PlatformV7BankManualReviewReason[] = [];

  if (input.reconciliation.status === 'mismatch') reasons.push('ledger-mismatch');
  if (input.reconciliation.status === 'pending') reasons.push('webhook-pending');
  if (input.reconciliation.status === 'failed') reasons.push('webhook-failed');
  if (input.releaseAmount > input.releaseLimit) reasons.push('release-over-limit');
  if (input.disputeOpen) reasons.push('active-dispute');
  if (input.amlFlag) reasons.push('aml-review');

  const priority = platformV7BankManualReviewPriority(reasons);

  return {
    requiresReview: reasons.length > 0,
    reasons,
    priority,
    recommendedDecision: platformV7BankManualReviewDecision(reasons),
  };
}

export function platformV7BankManualReviewPriority(
  reasons: PlatformV7BankManualReviewReason[],
): PlatformV7BankManualReviewPriority {
  if (reasons.includes('webhook-failed') || reasons.includes('active-dispute') || reasons.includes('aml-review')) return 'critical';
  if (reasons.includes('ledger-mismatch') || reasons.includes('release-over-limit')) return 'high';
  if (reasons.includes('webhook-pending')) return 'medium';
  return 'low';
}

export function platformV7BankManualReviewDecision(
  reasons: PlatformV7BankManualReviewReason[],
): PlatformV7BankManualReviewDecision {
  if (reasons.includes('webhook-failed') || reasons.includes('aml-review')) return 'escalate';
  if (reasons.includes('active-dispute') || reasons.includes('ledger-mismatch')) return 'hold';
  if (reasons.includes('webhook-pending') || reasons.includes('release-over-limit')) return 'hold';
  return 'approve';
}

export function platformV7BankManualReviewCaseIsOverdue(
  reviewCase: PlatformV7BankManualReviewCase,
  nowIso: string,
): boolean {
  const openedAt = new Date(reviewCase.openedAt).getTime();
  const now = new Date(nowIso).getTime();
  return now - openedAt > reviewCase.slaHours * 60 * 60 * 1000;
}
