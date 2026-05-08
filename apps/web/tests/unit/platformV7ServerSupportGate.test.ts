import { describe, expect, it } from 'vitest';
import { checkPlatformV7ServerSupportGate } from '@/lib/platform-v7/server-support-gate';
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

describe('platform-v7 server support gate', () => {
  it('does not block non-support boundaries', () => {
    const result = checkPlatformV7ServerSupportGate({
      response: response('create_batch'),
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result).toMatchObject({
      status: 'not_support_boundary',
      canReachSupportRuntimeBoundary: true,
      canClaimSupportCaseCreated: false,
      canClaimSupportMessageAppended: false,
    });
  });

  it('blocks support boundaries without related entity', () => {
    const result = checkPlatformV7ServerSupportGate({
      response: response('create_support_case'),
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result.status).toBe('blocked_missing_related_entity');
    expect(result.canReachSupportRuntimeBoundary).toBe(false);
  });

  it('blocks support messages without support case id', () => {
    const result = checkPlatformV7ServerSupportGate({
      response: response('append_support_message'),
      relatedEntityId: 'deal-1',
      relatedEntityType: 'deal',
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result.status).toBe('blocked_missing_support_case_id');
    expect(result.canReachSupportRuntimeBoundary).toBe(false);
  });

  it('allows support case creation to reach runtime boundary without claiming creation', () => {
    const result = checkPlatformV7ServerSupportGate({
      response: response('create_support_case'),
      relatedEntityId: 'deal-1',
      relatedEntityType: 'deal',
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result).toMatchObject({
      status: 'ready_for_support_runtime_boundary',
      canReachSupportRuntimeBoundary: true,
      canClaimSupportCaseCreated: false,
      canClaimSupportMessageAppended: false,
    });
  });

  it('allows support message append to reach runtime boundary without claiming append', () => {
    const result = checkPlatformV7ServerSupportGate({
      response: response('append_support_message'),
      relatedEntityId: 'deal-1',
      relatedEntityType: 'deal',
      supportCaseId: 'support-1',
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result).toMatchObject({
      status: 'ready_for_support_runtime_boundary',
      canReachSupportRuntimeBoundary: true,
      canClaimSupportCaseCreated: false,
      canClaimSupportMessageAppended: false,
    });
  });
});
