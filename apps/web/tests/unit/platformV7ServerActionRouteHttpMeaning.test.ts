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

const response: PlatformV7ServerActionContractResponse = {
  boundaryId: 'submit_proposal',
  status: 'contract_checked',
  httpStatus: 202,
  message: 'checked',
  nextAction: 'next',
  canClaimExecuted: false,
  persisted: false,
  attemptedRuntimeWrite: false,
  issueCount: 0,
  signalCount: 1,
  repositoryDurable: false,
};

describe('platform-v7 route result http meaning', () => {
  it('marks manual review responses explicitly', () => {
    const routeSummary = buildPlatformV7ServerActionRouteSummary(baseInput);
    const result = buildPlatformV7ServerActionRouteResult({ response, routeSummary, body: {} });

    expect(result).toMatchObject({
      ok: true,
      status: 202,
      httpMeaning: 'accepted_for_manual_review',
      body: { httpMeaning: 'accepted_for_manual_review' },
    });
  });

  it('marks runtime-ready responses explicitly', () => {
    const routeSummary = buildPlatformV7ServerActionRouteSummary({
      ...baseInput,
      persistenceBoundary: { canAttemptRuntimeWrite: true, repositoryDurable: true },
    });
    const result = buildPlatformV7ServerActionRouteResult({ response, routeSummary, body: {} });

    expect(result).toMatchObject({
      ok: true,
      status: 200,
      httpMeaning: 'ready_for_runtime_write',
      body: { httpMeaning: 'ready_for_runtime_write' },
    });
  });
});
