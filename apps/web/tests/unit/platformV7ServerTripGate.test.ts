import { describe, expect, it } from 'vitest';
import { checkPlatformV7ServerTripGate } from '@/lib/platform-v7/server-trip-gate';
import type { PlatformV7ApiBoundaryId } from '@/lib/platform-v7/api-boundary-contracts';
import type { PlatformV7ServerActionContractResponse } from '@/lib/platform-v7/server-action-contract-wrapper';
import type { PlatformV7ServerAuditBoundaryResult } from '@/lib/platform-v7/server-audit-boundary';
import type { PlatformV7ServerIdempotencyBoundaryResult } from '@/lib/platform-v7/server-idempotency-boundary';

const response = (boundaryId: PlatformV7ApiBoundaryId): PlatformV7ServerActionContractResponse => ({
  boundaryId,
  status: 'contract_checked',
  httpStatus: 202,
  message: 'checked',
  nextAction: 'next',
  canClaimExecuted: false,
  persisted: false,
  attemptedRuntimeWrite: false,
  issueCount: 1,
  signalCount: 1,
  repositoryDurable: false,
});

const idempotencyReady: PlatformV7ServerIdempotencyBoundaryResult = {
  status: 'ready_for_idempotency_record',
  canProceed: true,
  requiresIdempotencyRecord: true,
  keyValid: true,
  moneyKey: false,
  reason: 'ready',
};

const idempotencyBlocked: PlatformV7ServerIdempotencyBoundaryResult = {
  ...idempotencyReady,
  status: 'blocked_missing_idempotency_key',
  canProceed: false,
  keyValid: false,
};

const auditReady: PlatformV7ServerAuditBoundaryResult = {
  status: 'ready_for_append_only_audit_record',
  canProceed: true,
  requiresAuditRecord: true,
  auditEventValid: true,
  appendOnly: true,
  moneyAuditComplete: true,
  reason: 'ready',
};

describe('platform-v7 server trip gate', () => {
  it('does not block non-trip boundaries', () => {
    const result = checkPlatformV7ServerTripGate({
      response: response('create_batch'),
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result).toMatchObject({
      status: 'not_trip_boundary',
      canReachTripRuntimeBoundary: true,
      canClaimTripStateChanged: false,
      mayAffectMoney: false,
    });
  });

  it('blocks trip boundaries without trip id', () => {
    const result = checkPlatformV7ServerTripGate({
      response: response('assign_driver'),
      dealId: 'deal-1',
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result.status).toBe('blocked_missing_trip_id');
    expect(result.canReachTripRuntimeBoundary).toBe(false);
  });

  it('blocks trip boundaries when idempotency boundary is not ready', () => {
    const result = checkPlatformV7ServerTripGate({
      response: response('mark_trip_arrived'),
      dealId: 'deal-1',
      tripId: 'trip-1',
      idempotencyBoundary: idempotencyBlocked,
      auditBoundary: auditReady,
    });

    expect(result.status).toBe('blocked_idempotency_boundary');
    expect(result.canReachTripRuntimeBoundary).toBe(false);
  });

  it('allows trip boundary to reach runtime boundary without claiming trip state change', () => {
    const result = checkPlatformV7ServerTripGate({
      response: response('mark_trip_arrived'),
      dealId: 'deal-1',
      tripId: 'trip-1',
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result).toMatchObject({
      status: 'ready_for_trip_runtime_boundary',
      canReachTripRuntimeBoundary: true,
      canClaimTripStateChanged: false,
      mayAffectMoney: false,
    });
  });

  it('marks acceptance and incident trip boundaries as money-impacting', () => {
    const acceptTrip = checkPlatformV7ServerTripGate({
      response: response('accept_trip'),
      dealId: 'deal-1',
      tripId: 'trip-1',
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    const incident = checkPlatformV7ServerTripGate({
      response: response('open_incident'),
      dealId: 'deal-1',
      tripId: 'trip-1',
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(acceptTrip.mayAffectMoney).toBe(true);
    expect(incident.mayAffectMoney).toBe(true);
  });
});
