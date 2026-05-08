import { describe, expect, it } from 'vitest';
import {
  buildPlatformV7ServerActionRouteResult,
  buildPlatformV7ServerActionRouteSummary,
  type PlatformV7ServerActionRouteSummaryInput,
} from '@/lib/platform-v7/server-action-route-result';
import type { PlatformV7ServerActionContractResponse } from '@/lib/platform-v7/server-action-contract-wrapper';

const baseInput: PlatformV7ServerActionRouteSummaryInput = {
  idempotencyBoundary: { canProceed: true, status: 'ready_for_idempotency_record', reason: 'ready' },
  auditBoundary: { canProceed: true, status: 'ready_for_append_only_audit_record', reason: 'ready' },
  documentGate: { canReachDocumentRuntimeBoundary: true, status: 'not_document_boundary', reason: 'not document' },
  tripGate: { canReachTripRuntimeBoundary: true, status: 'not_trip_boundary', reason: 'not trip' },
  disputeGate: { canReachDisputeRuntimeBoundary: true, status: 'not_dispute_boundary', reason: 'not dispute' },
  supportGate: { canReachSupportRuntimeBoundary: true, status: 'not_support_boundary', reason: 'not support' },
  riskReviewGate: {
    canReachRiskReviewBoundary: true,
    requiresManualReview: false,
    status: 'not_risk_review_boundary',
    reason: 'not risk review',
  },
  moneyGuard: {
    canReachMoneyRuntimeBoundary: true,
    requiresBankOrExternalConfirmation: false,
    status: 'not_money_boundary',
    reason: 'not money',
  },
  persistenceBoundary: { canAttemptRuntimeWrite: false, repositoryDurable: false },
};

const response = (status: PlatformV7ServerActionContractResponse['status']): PlatformV7ServerActionContractResponse => ({
  boundaryId: 'submit_proposal',
  status,
  httpStatus: status === 'not_accepted' ? 400 : 202,
  message: 'checked',
  nextAction: 'next',
  canClaimExecuted: false,
  persisted: false,
  attemptedRuntimeWrite: false,
  issueCount: 0,
  signalCount: 1,
  repositoryDurable: false,
});

describe('platform-v7 blocked route result http meaning', () => {
  it('marks not-accepted responses explicitly', () => {
    const routeSummary = buildPlatformV7ServerActionRouteSummary(baseInput);
    const result = buildPlatformV7ServerActionRouteResult({
      response: response('not_accepted'),
      routeSummary,
      body: {},
    });

    expect(result).toMatchObject({
      ok: false,
      status: 400,
      httpMeaning: 'not_accepted',
      body: { httpMeaning: 'not_accepted' },
    });
  });

  it('marks server-boundary stops explicitly', () => {
    const routeSummary = buildPlatformV7ServerActionRouteSummary({
      ...baseInput,
      idempotencyBoundary: {
        canProceed: false,
        status: 'blocked_missing_idempotency_key',
        reason: 'missing key',
      },
    });
    const result = buildPlatformV7ServerActionRouteResult({
      response: response('contract_checked'),
      routeSummary,
      body: {},
    });

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      httpMeaning: 'stopped_by_server_boundary',
      body: { httpMeaning: 'stopped_by_server_boundary' },
    });
  });
});
