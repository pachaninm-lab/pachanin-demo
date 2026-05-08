import { describe, expect, it } from 'vitest';
import { checkPlatformV7ServerDisputeGate } from '@/lib/platform-v7/server-dispute-gate';
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

const auditReady: PlatformV7ServerAuditBoundaryResult = {
  status: 'ready_for_append_only_audit_record',
  canProceed: true,
  requiresAuditRecord: true,
  auditEventValid: true,
  appendOnly: true,
  moneyAuditComplete: true,
  reason: 'ready',
};

describe('platform-v7 server dispute gate', () => {
  it('does not block non-dispute boundaries', () => {
    const result = checkPlatformV7ServerDisputeGate({
      response: response('create_batch'),
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result).toMatchObject({
      status: 'not_dispute_boundary',
      canReachDisputeRuntimeBoundary: true,
      canClaimDisputeOpened: false,
      canClaimDisputeResolved: false,
      mayAffectMoney: false,
    });
  });

  it('blocks dispute boundaries without evidence references', () => {
    const result = checkPlatformV7ServerDisputeGate({
      response: response('open_dispute'),
      dealId: 'deal-1',
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result.status).toBe('blocked_missing_evidence_refs');
    expect(result.canReachDisputeRuntimeBoundary).toBe(false);
  });

  it('blocks dispute resolution without dispute id', () => {
    const result = checkPlatformV7ServerDisputeGate({
      response: response('resolve_dispute'),
      dealId: 'deal-1',
      evidenceRefs: ['evidence-1'],
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result.status).toBe('blocked_missing_dispute_id');
    expect(result.canReachDisputeRuntimeBoundary).toBe(false);
  });

  it('allows dispute opening to reach runtime boundary without claiming it opened', () => {
    const result = checkPlatformV7ServerDisputeGate({
      response: response('open_dispute'),
      dealId: 'deal-1',
      evidenceRefs: ['evidence-1'],
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result).toMatchObject({
      status: 'ready_for_dispute_runtime_boundary',
      canReachDisputeRuntimeBoundary: true,
      canClaimDisputeOpened: false,
      mayAffectMoney: true,
    });
  });

  it('allows dispute resolution to reach runtime boundary without claiming it resolved', () => {
    const result = checkPlatformV7ServerDisputeGate({
      response: response('resolve_dispute'),
      dealId: 'deal-1',
      disputeId: 'dispute-1',
      evidenceRefs: ['evidence-1'],
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result).toMatchObject({
      status: 'ready_for_dispute_runtime_boundary',
      canReachDisputeRuntimeBoundary: true,
      canClaimDisputeResolved: false,
      mayAffectMoney: true,
    });
  });
});
