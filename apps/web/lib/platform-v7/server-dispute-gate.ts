import type { PlatformV7ServerActionContractResponse } from './server-action-contract-wrapper';
import type { PlatformV7ServerAuditBoundaryResult } from './server-audit-boundary';
import type { PlatformV7ServerIdempotencyBoundaryResult } from './server-idempotency-boundary';

export type PlatformV7ServerDisputeGateStatus =
  | 'not_dispute_boundary'
  | 'blocked_missing_deal_id'
  | 'blocked_missing_dispute_id'
  | 'blocked_missing_evidence_refs'
  | 'blocked_idempotency_boundary'
  | 'blocked_audit_boundary'
  | 'ready_for_dispute_runtime_boundary';

export type PlatformV7ServerDisputeGateInput = {
  readonly response: PlatformV7ServerActionContractResponse;
  readonly dealId?: string;
  readonly disputeId?: string;
  readonly evidenceRefs?: readonly string[];
  readonly idempotencyBoundary: PlatformV7ServerIdempotencyBoundaryResult;
  readonly auditBoundary: PlatformV7ServerAuditBoundaryResult;
};

export type PlatformV7ServerDisputeGateResult = {
  readonly status: PlatformV7ServerDisputeGateStatus;
  readonly canReachDisputeRuntimeBoundary: boolean;
  readonly canClaimDisputeOpened: false;
  readonly canClaimDisputeResolved: false;
  readonly mayAffectMoney: boolean;
  readonly reason: string;
};

const hasText = (value: string | undefined): boolean => typeof value === 'string' && value.trim().length > 0;
const hasEvidence = (refs: readonly string[] | undefined): boolean =>
  Array.isArray(refs) && refs.some((ref) => typeof ref === 'string' && ref.trim().length > 0);
const isDisputeBoundary = (boundaryId: string): boolean =>
  boundaryId === 'open_dispute' || boundaryId === 'resolve_dispute';

export function checkPlatformV7ServerDisputeGate(
  input: PlatformV7ServerDisputeGateInput,
): PlatformV7ServerDisputeGateResult {
  const boundaryId = input.response.boundaryId;
  const mayAffectMoney = boundaryId === 'open_dispute' || boundaryId === 'resolve_dispute';

  if (!isDisputeBoundary(boundaryId)) {
    return {
      status: 'not_dispute_boundary',
      canReachDisputeRuntimeBoundary: true,
      canClaimDisputeOpened: false,
      canClaimDisputeResolved: false,
      mayAffectMoney: false,
      reason: 'Boundary does not change dispute state.',
    };
  }

  if (!hasText(input.dealId)) {
    return {
      status: 'blocked_missing_deal_id',
      canReachDisputeRuntimeBoundary: false,
      canClaimDisputeOpened: false,
      canClaimDisputeResolved: false,
      mayAffectMoney,
      reason: 'Dispute boundary requires deal id.',
    };
  }

  if (boundaryId === 'resolve_dispute' && !hasText(input.disputeId)) {
    return {
      status: 'blocked_missing_dispute_id',
      canReachDisputeRuntimeBoundary: false,
      canClaimDisputeOpened: false,
      canClaimDisputeResolved: false,
      mayAffectMoney,
      reason: 'Dispute resolution boundary requires dispute id.',
    };
  }

  if (!hasEvidence(input.evidenceRefs)) {
    return {
      status: 'blocked_missing_evidence_refs',
      canReachDisputeRuntimeBoundary: false,
      canClaimDisputeOpened: false,
      canClaimDisputeResolved: false,
      mayAffectMoney,
      reason: 'Dispute boundary requires evidence references before it may affect money.',
    };
  }

  if (!input.idempotencyBoundary.canProceed) {
    return {
      status: 'blocked_idempotency_boundary',
      canReachDisputeRuntimeBoundary: false,
      canClaimDisputeOpened: false,
      canClaimDisputeResolved: false,
      mayAffectMoney,
      reason: 'Dispute boundary cannot proceed until idempotency boundary is ready.',
    };
  }

  if (!input.auditBoundary.canProceed) {
    return {
      status: 'blocked_audit_boundary',
      canReachDisputeRuntimeBoundary: false,
      canClaimDisputeOpened: false,
      canClaimDisputeResolved: false,
      mayAffectMoney,
      reason: 'Dispute boundary cannot proceed until append-only audit boundary is ready.',
    };
  }

  return {
    status: 'ready_for_dispute_runtime_boundary',
    canReachDisputeRuntimeBoundary: true,
    canClaimDisputeOpened: false,
    canClaimDisputeResolved: false,
    mayAffectMoney,
    reason: 'Dispute gate is ready for runtime boundary, but no dispute state change is executed in this layer.',
  };
}

export function getPlatformV7ServerDisputeGateSummary(result: PlatformV7ServerDisputeGateResult) {
  return {
    status: result.status,
    canReachDisputeRuntimeBoundary: result.canReachDisputeRuntimeBoundary,
    canClaimDisputeOpened: result.canClaimDisputeOpened,
    canClaimDisputeResolved: result.canClaimDisputeResolved,
    mayAffectMoney: result.mayAffectMoney,
  };
}
