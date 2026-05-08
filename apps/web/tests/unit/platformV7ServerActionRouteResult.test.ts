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

describe('platform-v7 server action route result helper', () => {
  it('returns manual review summary when gates pass but durable write is unavailable', () => {
    const summary = buildPlatformV7ServerActionRouteSummary(baseInput);

    expect(summary).toMatchObject({
      status: 'ready_for_manual_runtime_review',
      runtimeStage: 'manual_runtime_review_required',
      runtimeReason: 'Runtime boundary reached, but durable repository is not connected.',
      executionClaim: {
        executed: false,
        persisted: false,
        moneyMoved: false,
        externalConfirmed: false,
        stage: 'manual_runtime_review_required',
        reason: 'Runtime boundary reached, but durable repository is not connected.',
      },
      canReachRuntimeBoundary: true,
      canAttemptRuntimeWrite: false,
      canClaimExecuted: false,
      persisted: false,
      requiresManualReview: true,
      issueCount: 0,
    });
  });

  it('marks runtime write readiness without claiming execution', () => {
    const summary = buildPlatformV7ServerActionRouteSummary({
      ...baseInput,
      persistenceBoundary: { canAttemptRuntimeWrite: true, repositoryDurable: true },
    });

    expect(summary).toMatchObject({
      status: 'ready_for_runtime_write',
      runtimeStage: 'runtime_write_ready',
      executionClaim: {
        executed: false,
        persisted: false,
        moneyMoved: false,
        externalConfirmed: false,
        stage: 'runtime_write_ready',
      },
      canReachRuntimeBoundary: true,
      canAttemptRuntimeWrite: true,
      canClaimExecuted: false,
      persisted: false,
      requiresManualReview: false,
    });
  });

  it('collects the first server boundary issue without claiming execution', () => {
    const summary = buildPlatformV7ServerActionRouteSummary({
      ...baseInput,
      idempotencyBoundary: {
        canProceed: false,
        status: 'blocked_missing_idempotency_key',
        reason: 'missing key',
      },
    });

    expect(summary).toMatchObject({
      status: 'stopped_by_server_boundary',
      runtimeStage: 'stopped_by_server_boundary',
      executionClaim: {
        executed: false,
        persisted: false,
        moneyMoved: false,
        externalConfirmed: false,
        stage: 'stopped_by_server_boundary',
      },
      canReachRuntimeBoundary: false,
      canAttemptRuntimeWrite: false,
      canClaimExecuted: false,
      persisted: false,
      issueCount: 1,
    });
    expect(summary.issues[0]).toEqual({
      boundary: 'idempotency',
      status: 'blocked_missing_idempotency_key',
      reason: 'missing key',
    });
  });

  it('maps stopped summary to 409 response', () => {
    const routeSummary = buildPlatformV7ServerActionRouteSummary({
      ...baseInput,
      moneyGuard: {
        canReachMoneyRuntimeBoundary: false,
        requiresBankOrExternalConfirmation: true,
        status: 'blocked_missing_amount_or_currency',
        reason: 'missing amount',
      },
    });

    const result = buildPlatformV7ServerActionRouteResult({
      response: response('contract_checked'),
      routeSummary,
      body: { routeSummary },
    });

    expect(result).toMatchObject({ ok: false, status: 409 });
  });

  it('preserves not accepted response status', () => {
    const routeSummary = buildPlatformV7ServerActionRouteSummary(baseInput);
    const result = buildPlatformV7ServerActionRouteResult({
      response: response('not_accepted'),
      routeSummary,
      body: { routeSummary },
    });

    expect(result).toMatchObject({ ok: false, status: 400 });
  });
});
