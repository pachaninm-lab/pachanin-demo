import { getPlatformV7ApiBoundary } from './api-boundary-contracts';
import type { PlatformV7ServerActionContractResponse } from './server-action-contract-wrapper';
import type { PlatformV7ServerAuditBoundaryResult } from './server-audit-boundary';
import type { PlatformV7ServerIdempotencyBoundaryResult } from './server-idempotency-boundary';

export type PlatformV7ServerTripGateStatus =
  | 'not_trip_boundary'
  | 'blocked_missing_deal_id'
  | 'blocked_missing_trip_id'
  | 'blocked_idempotency_boundary'
  | 'blocked_audit_boundary'
  | 'ready_for_trip_runtime_boundary';

export type PlatformV7ServerTripGateInput = {
  readonly response: PlatformV7ServerActionContractResponse;
  readonly dealId?: string;
  readonly tripId?: string;
  readonly idempotencyBoundary: PlatformV7ServerIdempotencyBoundaryResult;
  readonly auditBoundary: PlatformV7ServerAuditBoundaryResult;
};

export type PlatformV7ServerTripGateResult = {
  readonly status: PlatformV7ServerTripGateStatus;
  readonly canReachTripRuntimeBoundary: boolean;
  readonly canClaimTripStateChanged: false;
  readonly mayAffectMoney: boolean;
  readonly reason: string;
};

const hasText = (value: string | undefined): boolean => typeof value === 'string' && value.trim().length > 0;
const isTripBoundary = (boundaryId: string): boolean =>
  boundaryId === 'assign_driver' ||
  boundaryId === 'mark_trip_arrived' ||
  boundaryId === 'accept_trip' ||
  boundaryId === 'open_incident';

export function checkPlatformV7ServerTripGate(input: PlatformV7ServerTripGateInput): PlatformV7ServerTripGateResult {
  const boundary = getPlatformV7ApiBoundary(input.response.boundaryId);
  const mayAffectMoney = boundary?.affectsMoney === true;

  if (!isTripBoundary(input.response.boundaryId)) {
    return {
      status: 'not_trip_boundary',
      canReachTripRuntimeBoundary: true,
      canClaimTripStateChanged: false,
      mayAffectMoney: false,
      reason: 'Boundary does not change trip state.',
    };
  }

  if (!hasText(input.dealId)) {
    return {
      status: 'blocked_missing_deal_id',
      canReachTripRuntimeBoundary: false,
      canClaimTripStateChanged: false,
      mayAffectMoney,
      reason: 'Trip boundary requires deal id.',
    };
  }

  if (!hasText(input.tripId)) {
    return {
      status: 'blocked_missing_trip_id',
      canReachTripRuntimeBoundary: false,
      canClaimTripStateChanged: false,
      mayAffectMoney,
      reason: 'Trip boundary requires trip id.',
    };
  }

  if (!input.idempotencyBoundary.canProceed) {
    return {
      status: 'blocked_idempotency_boundary',
      canReachTripRuntimeBoundary: false,
      canClaimTripStateChanged: false,
      mayAffectMoney,
      reason: 'Trip boundary cannot proceed until idempotency boundary is ready.',
    };
  }

  if (!input.auditBoundary.canProceed) {
    return {
      status: 'blocked_audit_boundary',
      canReachTripRuntimeBoundary: false,
      canClaimTripStateChanged: false,
      mayAffectMoney,
      reason: 'Trip boundary cannot proceed until append-only audit boundary is ready.',
    };
  }

  return {
    status: 'ready_for_trip_runtime_boundary',
    canReachTripRuntimeBoundary: true,
    canClaimTripStateChanged: false,
    mayAffectMoney,
    reason: 'Trip gate is ready for runtime boundary, but no trip state change is executed in this layer.',
  };
}

export function getPlatformV7ServerTripGateSummary(result: PlatformV7ServerTripGateResult) {
  return {
    status: result.status,
    canReachTripRuntimeBoundary: result.canReachTripRuntimeBoundary,
    canClaimTripStateChanged: result.canClaimTripStateChanged,
    mayAffectMoney: result.mayAffectMoney,
  };
}
