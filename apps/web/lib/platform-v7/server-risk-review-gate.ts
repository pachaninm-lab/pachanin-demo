import type { PlatformV7ServerActionContractResponse } from './server-action-contract-wrapper';
import type { PlatformV7ServerAuditBoundaryResult } from './server-audit-boundary';
import type { PlatformV7ServerIdempotencyBoundaryResult } from './server-idempotency-boundary';

export type PlatformV7RiskReviewStatus = 'clear' | 'review' | 'blocked' | 'unknown';

export type PlatformV7RiskReviewSnapshot = {
  readonly status: PlatformV7RiskReviewStatus;
  readonly score?: number;
  readonly source?: string;
};

export type PlatformV7ServerRiskReviewGateStatus =
  | 'not_risk_review_boundary'
  | 'blocked_missing_party_id'
  | 'blocked_missing_risk_snapshot'
  | 'blocked_party_requires_review'
  | 'blocked_idempotency_boundary'
  | 'blocked_audit_boundary'
  | 'ready_for_risk_review_boundary';

export type PlatformV7ServerRiskReviewGateInput = {
  readonly response: PlatformV7ServerActionContractResponse;
  readonly partyId?: string;
  readonly riskSnapshot?: PlatformV7RiskReviewSnapshot;
  readonly idempotencyBoundary: PlatformV7ServerIdempotencyBoundaryResult;
  readonly auditBoundary: PlatformV7ServerAuditBoundaryResult;
};

export type PlatformV7ServerRiskReviewGateResult = {
  readonly status: PlatformV7ServerRiskReviewGateStatus;
  readonly canReachRiskReviewBoundary: boolean;
  readonly canClaimPartyCleared: false;
  readonly requiresManualReview: boolean;
  readonly reason: string;
};

const hasText = (value: string | undefined): boolean => typeof value === 'string' && value.trim().length > 0;
const isRiskReviewBoundary = (boundaryId: string): boolean =>
  boundaryId === 'submit_proposal' ||
  boundaryId === 'accept_proposal' ||
  boundaryId === 'confirm_deal_terms' ||
  boundaryId === 'request_money_reserve';

export function checkPlatformV7ServerRiskReviewGate(
  input: PlatformV7ServerRiskReviewGateInput,
): PlatformV7ServerRiskReviewGateResult {
  const boundaryId = input.response.boundaryId;

  if (!isRiskReviewBoundary(boundaryId)) {
    return {
      status: 'not_risk_review_boundary',
      canReachRiskReviewBoundary: true,
      canClaimPartyCleared: false,
      requiresManualReview: false,
      reason: 'Boundary does not require party risk review.',
    };
  }

  if (!hasText(input.partyId)) {
    return {
      status: 'blocked_missing_party_id',
      canReachRiskReviewBoundary: false,
      canClaimPartyCleared: false,
      requiresManualReview: true,
      reason: 'Risk review boundary requires party id.',
    };
  }

  if (!input.riskSnapshot) {
    return {
      status: 'blocked_missing_risk_snapshot',
      canReachRiskReviewBoundary: false,
      canClaimPartyCleared: false,
      requiresManualReview: true,
      reason: 'Risk review boundary requires a party risk snapshot before deal-forming actions.',
    };
  }

  if (input.riskSnapshot.status === 'blocked') {
    return {
      status: 'blocked_party_requires_review',
      canReachRiskReviewBoundary: false,
      canClaimPartyCleared: false,
      requiresManualReview: true,
      reason: 'Party cannot reach deal-forming runtime boundary without operator review.',
    };
  }

  if (!input.idempotencyBoundary.canProceed) {
    return {
      status: 'blocked_idempotency_boundary',
      canReachRiskReviewBoundary: false,
      canClaimPartyCleared: false,
      requiresManualReview: true,
      reason: 'Risk review boundary cannot proceed until idempotency boundary is ready.',
    };
  }

  if (!input.auditBoundary.canProceed) {
    return {
      status: 'blocked_audit_boundary',
      canReachRiskReviewBoundary: false,
      canClaimPartyCleared: false,
      requiresManualReview: true,
      reason: 'Risk review boundary cannot proceed until append-only audit boundary is ready.',
    };
  }

  return {
    status: 'ready_for_risk_review_boundary',
    canReachRiskReviewBoundary: true,
    canClaimPartyCleared: false,
    requiresManualReview: input.riskSnapshot.status !== 'clear',
    reason: 'Risk review gate is ready for runtime boundary, but no party clearance is executed in this layer.',
  };
}

export function getPlatformV7ServerRiskReviewGateSummary(result: PlatformV7ServerRiskReviewGateResult) {
  return {
    status: result.status,
    canReachRiskReviewBoundary: result.canReachRiskReviewBoundary,
    canClaimPartyCleared: result.canClaimPartyCleared,
    requiresManualReview: result.requiresManualReview,
  };
}
