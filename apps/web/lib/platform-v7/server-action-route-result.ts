import type { PlatformV7ServerActionContractResponse } from './server-action-contract-wrapper';

export type PlatformV7ServerActionRouteResult = {
  readonly ok: boolean;
  readonly status: number;
  readonly body: Record<string, unknown>;
};

export type PlatformV7ServerActionRouteIssue = {
  readonly boundary: string;
  readonly status: string;
  readonly reason: string;
};

export type PlatformV7ServerActionRouteRuntimeStage =
  | 'stopped_by_server_boundary'
  | 'manual_runtime_review_required'
  | 'runtime_write_ready';

export type PlatformV7ServerActionRouteSummary = {
  readonly status: 'ready_for_manual_runtime_review' | 'ready_for_runtime_write' | 'stopped_by_server_boundary';
  readonly runtimeStage: PlatformV7ServerActionRouteRuntimeStage;
  readonly runtimeReason: string;
  readonly canReachRuntimeBoundary: boolean;
  readonly canAttemptRuntimeWrite: boolean;
  readonly canClaimExecuted: false;
  readonly persisted: false;
  readonly requiresManualReview: boolean;
  readonly issueCount: number;
  readonly issues: readonly PlatformV7ServerActionRouteIssue[];
};

type IdempotencySnapshot = {
  readonly canProceed: boolean;
  readonly status: string;
  readonly reason: string;
};

type AuditSnapshot = {
  readonly canProceed: boolean;
  readonly status: string;
  readonly reason: string;
};

type RuntimeGateSnapshot = {
  readonly canReachDocumentRuntimeBoundary: boolean;
  readonly status: string;
  readonly reason: string;
};

type TripGateSnapshot = {
  readonly canReachTripRuntimeBoundary: boolean;
  readonly status: string;
  readonly reason: string;
};

type DisputeGateSnapshot = {
  readonly canReachDisputeRuntimeBoundary: boolean;
  readonly status: string;
  readonly reason: string;
};

type SupportGateSnapshot = {
  readonly canReachSupportRuntimeBoundary: boolean;
  readonly status: string;
  readonly reason: string;
};

type RiskReviewGateSnapshot = {
  readonly canReachRiskReviewBoundary: boolean;
  readonly requiresManualReview: boolean;
  readonly status: string;
  readonly reason: string;
};

type MoneyGateSnapshot = {
  readonly canReachMoneyRuntimeBoundary: boolean;
  readonly requiresBankOrExternalConfirmation: boolean;
  readonly status: string;
  readonly reason: string;
};

type PersistenceSnapshot = {
  readonly canAttemptRuntimeWrite: boolean;
  readonly repositoryDurable: boolean;
};

export type PlatformV7ServerActionRouteSummaryInput = {
  readonly idempotencyBoundary: IdempotencySnapshot;
  readonly auditBoundary: AuditSnapshot;
  readonly documentGate: RuntimeGateSnapshot;
  readonly tripGate: TripGateSnapshot;
  readonly disputeGate: DisputeGateSnapshot;
  readonly supportGate: SupportGateSnapshot;
  readonly riskReviewGate: RiskReviewGateSnapshot;
  readonly moneyGuard: MoneyGateSnapshot;
  readonly persistenceBoundary: PersistenceSnapshot;
};

function routeIssue(boundary: string, status: string, reason: string): PlatformV7ServerActionRouteIssue {
  return { boundary, status, reason };
}

function isRouteIssue(issue: PlatformV7ServerActionRouteIssue | undefined): issue is PlatformV7ServerActionRouteIssue {
  return issue !== undefined;
}

function getRuntimeStage(input: {
  readonly canReachRuntimeBoundary: boolean;
  readonly canAttemptRuntimeWrite: boolean;
  readonly repositoryDurable: boolean;
}): { readonly runtimeStage: PlatformV7ServerActionRouteRuntimeStage; readonly runtimeReason: string } {
  if (!input.canReachRuntimeBoundary) {
    return {
      runtimeStage: 'stopped_by_server_boundary',
      runtimeReason: 'Server boundary stopped the action before runtime write readiness.',
    };
  }

  if (!input.canAttemptRuntimeWrite) {
    return {
      runtimeStage: 'manual_runtime_review_required',
      runtimeReason: input.repositoryDurable
        ? 'Runtime boundary reached, but manual review is still required before execution claim.'
        : 'Runtime boundary reached, but durable repository is not connected.',
    };
  }

  return {
    runtimeStage: 'runtime_write_ready',
    runtimeReason: 'Runtime write boundary is ready, but execution still must be confirmed by the server boundary.',
  };
}

export function buildPlatformV7ServerActionRouteSummary(
  input: PlatformV7ServerActionRouteSummaryInput,
): PlatformV7ServerActionRouteSummary {
  const issues = [
    !input.idempotencyBoundary.canProceed
      ? routeIssue('idempotency', input.idempotencyBoundary.status, input.idempotencyBoundary.reason)
      : undefined,
    !input.auditBoundary.canProceed ? routeIssue('audit', input.auditBoundary.status, input.auditBoundary.reason) : undefined,
    !input.documentGate.canReachDocumentRuntimeBoundary
      ? routeIssue('document', input.documentGate.status, input.documentGate.reason)
      : undefined,
    !input.tripGate.canReachTripRuntimeBoundary ? routeIssue('trip', input.tripGate.status, input.tripGate.reason) : undefined,
    !input.disputeGate.canReachDisputeRuntimeBoundary
      ? routeIssue('dispute', input.disputeGate.status, input.disputeGate.reason)
      : undefined,
    !input.supportGate.canReachSupportRuntimeBoundary
      ? routeIssue('support', input.supportGate.status, input.supportGate.reason)
      : undefined,
    !input.riskReviewGate.canReachRiskReviewBoundary
      ? routeIssue('risk_review', input.riskReviewGate.status, input.riskReviewGate.reason)
      : undefined,
    !input.moneyGuard.canReachMoneyRuntimeBoundary ? routeIssue('money', input.moneyGuard.status, input.moneyGuard.reason) : undefined,
  ].filter(isRouteIssue);

  const canReachRuntimeBoundary = issues.length === 0;
  const canAttemptRuntimeWrite = canReachRuntimeBoundary && input.persistenceBoundary.canAttemptRuntimeWrite;
  const runtime = getRuntimeStage({
    canReachRuntimeBoundary,
    canAttemptRuntimeWrite,
    repositoryDurable: input.persistenceBoundary.repositoryDurable,
  });

  return {
    status: canReachRuntimeBoundary
      ? canAttemptRuntimeWrite
        ? 'ready_for_runtime_write'
        : 'ready_for_manual_runtime_review'
      : 'stopped_by_server_boundary',
    runtimeStage: runtime.runtimeStage,
    runtimeReason: runtime.runtimeReason,
    canReachRuntimeBoundary,
    canAttemptRuntimeWrite,
    canClaimExecuted: false,
    persisted: false,
    requiresManualReview:
      !input.persistenceBoundary.repositoryDurable ||
      input.riskReviewGate.requiresManualReview ||
      input.moneyGuard.requiresBankOrExternalConfirmation,
    issueCount: issues.length,
    issues,
  };
}

export function buildPlatformV7ServerActionRouteResult(input: {
  readonly response: PlatformV7ServerActionContractResponse;
  readonly routeSummary: PlatformV7ServerActionRouteSummary;
  readonly body: Record<string, unknown>;
}): PlatformV7ServerActionRouteResult {
  if (input.response.status === 'not_accepted') {
    return { ok: false, status: input.response.httpStatus, body: input.body };
  }

  if (!input.routeSummary.canReachRuntimeBoundary) {
    return { ok: false, status: 409, body: input.body };
  }

  return {
    ok: true,
    status: input.routeSummary.canAttemptRuntimeWrite ? 200 : 202,
    body: input.body,
  };
}
