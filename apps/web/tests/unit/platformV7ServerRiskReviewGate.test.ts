import { describe, expect, it } from 'vitest';
import { checkPlatformV7ServerRiskReviewGate } from '@/lib/platform-v7/server-risk-review-gate';
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

describe('platform-v7 server risk review gate', () => {
  it('does not block non-risk-review boundaries', () => {
    const result = checkPlatformV7ServerRiskReviewGate({
      response: response('create_batch'),
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result).toMatchObject({
      status: 'not_risk_review_boundary',
      canReachRiskReviewBoundary: true,
      canClaimPartyCleared: false,
      requiresManualReview: false,
    });
  });

  it('blocks deal-forming boundaries without party id', () => {
    const result = checkPlatformV7ServerRiskReviewGate({
      response: response('accept_proposal'),
      riskSnapshot: { status: 'clear', score: 90, source: 'test' },
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result.status).toBe('blocked_missing_party_id');
    expect(result.canReachRiskReviewBoundary).toBe(false);
  });

  it('blocks deal-forming boundaries without risk snapshot', () => {
    const result = checkPlatformV7ServerRiskReviewGate({
      response: response('request_money_reserve'),
      partyId: 'buyer-1',
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result.status).toBe('blocked_missing_risk_snapshot');
    expect(result.requiresManualReview).toBe(true);
  });

  it('blocks blocked parties before deal-forming runtime boundary', () => {
    const result = checkPlatformV7ServerRiskReviewGate({
      response: response('confirm_deal_terms'),
      partyId: 'buyer-1',
      riskSnapshot: { status: 'blocked', score: 10, source: 'test' },
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result.status).toBe('blocked_party_requires_review');
    expect(result.canReachRiskReviewBoundary).toBe(false);
  });

  it('allows clear parties to reach risk review boundary without claiming clearance', () => {
    const result = checkPlatformV7ServerRiskReviewGate({
      response: response('submit_proposal'),
      partyId: 'buyer-1',
      riskSnapshot: { status: 'clear', score: 92, source: 'test' },
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result).toMatchObject({
      status: 'ready_for_risk_review_boundary',
      canReachRiskReviewBoundary: true,
      canClaimPartyCleared: false,
      requiresManualReview: false,
    });
  });

  it('requires manual review for review status but still reaches boundary', () => {
    const result = checkPlatformV7ServerRiskReviewGate({
      response: response('accept_proposal'),
      partyId: 'buyer-1',
      riskSnapshot: { status: 'review', score: 55, source: 'test' },
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result).toMatchObject({
      status: 'ready_for_risk_review_boundary',
      canReachRiskReviewBoundary: true,
      canClaimPartyCleared: false,
      requiresManualReview: true,
    });
  });
});
