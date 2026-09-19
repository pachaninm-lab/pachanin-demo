import type { PlatformV7ServerActionContractResponse } from './server-action-contract-wrapper';
import type { PlatformV7ServerAuditBoundaryResult } from './server-audit-boundary';
import type { PlatformV7ServerIdempotencyBoundaryResult } from './server-idempotency-boundary';

export type PlatformV7ServerSupportGateStatus =
  | 'not_support_boundary'
  | 'blocked_missing_related_entity'
  | 'blocked_missing_support_case_id'
  | 'blocked_idempotency_boundary'
  | 'blocked_audit_boundary'
  | 'ready_for_support_runtime_boundary';

export type PlatformV7ServerSupportGateInput = {
  readonly response: PlatformV7ServerActionContractResponse;
  readonly relatedEntityId?: string;
  readonly relatedEntityType?: string;
  readonly supportCaseId?: string;
  readonly idempotencyBoundary: PlatformV7ServerIdempotencyBoundaryResult;
  readonly auditBoundary: PlatformV7ServerAuditBoundaryResult;
};

export type PlatformV7ServerSupportGateResult = {
  readonly status: PlatformV7ServerSupportGateStatus;
  readonly canReachSupportRuntimeBoundary: boolean;
  readonly canClaimSupportCaseCreated: false;
  readonly canClaimSupportMessageAppended: false;
  readonly reason: string;
};

const hasText = (value: string | undefined): boolean => typeof value === 'string' && value.trim().length > 0;
const isSupportBoundary = (boundaryId: string): boolean =>
  boundaryId === 'create_support_case' || boundaryId === 'append_support_message';

export function checkPlatformV7ServerSupportGate(
  input: PlatformV7ServerSupportGateInput,
): PlatformV7ServerSupportGateResult {
  const boundaryId = input.response.boundaryId;

  if (!isSupportBoundary(boundaryId)) {
    return {
      status: 'not_support_boundary',
      canReachSupportRuntimeBoundary: true,
      canClaimSupportCaseCreated: false,
      canClaimSupportMessageAppended: false,
      reason: 'Boundary does not change support state.',
    };
  }

  if (!hasText(input.relatedEntityId) || !hasText(input.relatedEntityType)) {
    return {
      status: 'blocked_missing_related_entity',
      canReachSupportRuntimeBoundary: false,
      canClaimSupportCaseCreated: false,
      canClaimSupportMessageAppended: false,
      reason: 'Support boundary requires related entity id and type.',
    };
  }

  if (boundaryId === 'append_support_message' && !hasText(input.supportCaseId)) {
    return {
      status: 'blocked_missing_support_case_id',
      canReachSupportRuntimeBoundary: false,
      canClaimSupportCaseCreated: false,
      canClaimSupportMessageAppended: false,
      reason: 'Support message boundary requires support case id.',
    };
  }

  if (!input.idempotencyBoundary.canProceed) {
    return {
      status: 'blocked_idempotency_boundary',
      canReachSupportRuntimeBoundary: false,
      canClaimSupportCaseCreated: false,
      canClaimSupportMessageAppended: false,
      reason: 'Support boundary cannot proceed until idempotency boundary is ready.',
    };
  }

  if (!input.auditBoundary.canProceed) {
    return {
      status: 'blocked_audit_boundary',
      canReachSupportRuntimeBoundary: false,
      canClaimSupportCaseCreated: false,
      canClaimSupportMessageAppended: false,
      reason: 'Support boundary cannot proceed until append-only audit boundary is ready.',
    };
  }

  return {
    status: 'ready_for_support_runtime_boundary',
    canReachSupportRuntimeBoundary: true,
    canClaimSupportCaseCreated: false,
    canClaimSupportMessageAppended: false,
    reason: 'Support gate is ready for runtime boundary, but no support state change is executed in this layer.',
  };
}

export function getPlatformV7ServerSupportGateSummary(result: PlatformV7ServerSupportGateResult) {
  return {
    status: result.status,
    canReachSupportRuntimeBoundary: result.canReachSupportRuntimeBoundary,
    canClaimSupportCaseCreated: result.canClaimSupportCaseCreated,
    canClaimSupportMessageAppended: result.canClaimSupportMessageAppended,
  };
}
