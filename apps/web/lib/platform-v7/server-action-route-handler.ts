import type { PlatformV7ApiBoundaryId } from './api-boundary-contracts';
import { buildPlatformV7AuditEvent } from './audit-event-helper';
import type { PlatformV7ExecutionEnvelopeInput } from './execution-envelope-helper';
import { createPlatformV7MemoryPersistenceRepository } from './persistence-repository';
import {
  buildPlatformV7ServerActionContractResponse,
  getPlatformV7ServerActionContractSummary,
} from './server-action-contract-wrapper';
import {
  checkPlatformV7ServerAuditBoundary,
  getPlatformV7ServerAuditBoundarySummary,
} from './server-audit-boundary';
import {
  checkPlatformV7ServerDisputeGate,
  getPlatformV7ServerDisputeGateSummary,
} from './server-dispute-gate';
import {
  checkPlatformV7ServerDocumentGate,
  getPlatformV7ServerDocumentGateSummary,
} from './server-document-gate';
import {
  checkPlatformV7ServerIdempotencyBoundary,
  getPlatformV7ServerIdempotencyBoundarySummary,
} from './server-idempotency-boundary';
import {
  checkPlatformV7ServerMoneyOperationGuard,
  getPlatformV7ServerMoneyOperationGuardSummary,
} from './server-money-operation-guard';
import {
  checkPlatformV7ServerPersistenceBoundary,
  getPlatformV7ServerPersistenceBoundarySummary,
} from './server-persistence-boundary';
import {
  checkPlatformV7ServerRiskReviewGate,
  getPlatformV7ServerRiskReviewGateSummary,
  type PlatformV7RiskReviewSnapshot,
} from './server-risk-review-gate';
import {
  checkPlatformV7ServerSupportGate,
  getPlatformV7ServerSupportGateSummary,
} from './server-support-gate';
import {
  checkPlatformV7ServerTripGate,
  getPlatformV7ServerTripGateSummary,
} from './server-trip-gate';

export type PlatformV7ServerActionRouteBody = {
  readonly boundaryId?: unknown;
  readonly actorId?: unknown;
  readonly actorRole?: unknown;
  readonly entityId?: unknown;
  readonly entityType?: unknown;
  readonly dealId?: unknown;
  readonly amountMinor?: unknown;
  readonly currency?: unknown;
  readonly attemptId?: unknown;
  readonly idempotencyKey?: unknown;
  readonly occurredAt?: unknown;
  readonly summary?: unknown;
  readonly evidenceRefs?: unknown;
  readonly payload?: unknown;
};

export type PlatformV7ServerActionRouteResult = {
  readonly ok: boolean;
  readonly status: number;
  readonly body: Record<string, unknown>;
};

export type PlatformV7ServerActionRouteSummary = {
  readonly status: 'ready_for_manual_runtime_review' | 'ready_for_runtime_write' | 'stopped_by_server_boundary';
  readonly canReachRuntimeBoundary: boolean;
  readonly canAttemptRuntimeWrite: boolean;
  readonly canClaimExecuted: false;
  readonly persisted: false;
  readonly requiresManualReview: boolean;
  readonly issueCount: number;
  readonly issues: readonly {
    readonly boundary: string;
    readonly status: string;
    readonly reason: string;
  }[];
};

const isString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readOptionalString(value: unknown): string | undefined {
  return isString(value) ? value : undefined;
}

function readEvidenceRefs(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const refs = value.filter(isString);
  return refs.length > 0 ? refs : undefined;
}

function readRiskSnapshot(value: unknown): PlatformV7RiskReviewSnapshot | undefined {
  if (!isRecord(value)) return undefined;
  const status = value.status;
  if (status !== 'clear' && status !== 'review' && status !== 'blocked' && status !== 'unknown') return undefined;
  return {
    status,
    score: readOptionalNumber(value.score),
    source: readOptionalString(value.source),
  };
}

function buildPlatformV7ServerActionRouteSummary(input: {
  readonly idempotencyBoundary: ReturnType<typeof checkPlatformV7ServerIdempotencyBoundary>;
  readonly auditBoundary: ReturnType<typeof checkPlatformV7ServerAuditBoundary>;
  readonly documentGate: ReturnType<typeof checkPlatformV7ServerDocumentGate>;
  readonly tripGate: ReturnType<typeof checkPlatformV7ServerTripGate>;
  readonly disputeGate: ReturnType<typeof checkPlatformV7ServerDisputeGate>;
  readonly supportGate: ReturnType<typeof checkPlatformV7ServerSupportGate>;
  readonly riskReviewGate: ReturnType<typeof checkPlatformV7ServerRiskReviewGate>;
  readonly moneyGuard: ReturnType<typeof checkPlatformV7ServerMoneyOperationGuard>;
  readonly persistenceBoundary: ReturnType<typeof checkPlatformV7ServerPersistenceBoundary>;
}): PlatformV7ServerActionRouteSummary {
  const issues = [
    !input.idempotencyBoundary.canProceed
      ? { boundary: 'idempotency', status: input.idempotencyBoundary.status, reason: input.idempotencyBoundary.reason }
      : undefined,
    !input.auditBoundary.canProceed
      ? { boundary: 'audit', status: input.auditBoundary.status, reason: input.auditBoundary.reason }
      : undefined,
    !input.documentGate.canReachDocumentRuntimeBoundary
      ? { boundary: 'document', status: input.documentGate.status, reason: input.documentGate.reason }
      : undefined,
    !input.tripGate.canReachTripRuntimeBoundary
      ? { boundary: 'trip', status: input.tripGate.status, reason: input.tripGate.reason }
      : undefined,
    !input.disputeGate.canReachDisputeRuntimeBoundary
      ? { boundary: 'dispute', status: input.disputeGate.status, reason: input.disputeGate.reason }
      : undefined,
    !input.supportGate.canReachSupportRuntimeBoundary
      ? { boundary: 'support', status: input.supportGate.status, reason: input.supportGate.reason }
      : undefined,
    !input.riskReviewGate.canReachRiskReviewBoundary
      ? { boundary: 'risk_review', status: input.riskReviewGate.status, reason: input.riskReviewGate.reason }
      : undefined,
    !input.moneyGuard.canReachMoneyRuntimeBoundary
      ? { boundary: 'money', status: input.moneyGuard.status, reason: input.moneyGuard.reason }
      : undefined,
  ].filter((issue): issue is { boundary: string; status: string; reason: string } => issue !== undefined);

  const canReachRuntimeBoundary = issues.length === 0;
  const canAttemptRuntimeWrite = canReachRuntimeBoundary && input.persistenceBoundary.canAttemptRuntimeWrite;

  return {
    status: canReachRuntimeBoundary
      ? canAttemptRuntimeWrite
        ? 'ready_for_runtime_write'
        : 'ready_for_manual_runtime_review'
      : 'stopped_by_server_boundary',
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

export function buildPlatformV7ServerActionInputFromRouteBody(
  body: PlatformV7ServerActionRouteBody,
): PlatformV7ExecutionEnvelopeInput | undefined {
  if (!isString(body.boundaryId) || !isString(body.actorId) || !isString(body.actorRole)) return undefined;
  if (!isString(body.entityId) || !isString(body.entityType)) return undefined;

  return {
    boundaryId: body.boundaryId as PlatformV7ApiBoundaryId,
    actorId: body.actorId,
    actorRole: body.actorRole,
    entityId: body.entityId,
    entityType: body.entityType,
    dealId: readOptionalString(body.dealId),
    amountMinor: readOptionalNumber(body.amountMinor),
    currency: readOptionalString(body.currency),
    attemptId: readOptionalString(body.attemptId),
    occurredAt: readOptionalString(body.occurredAt) ?? new Date(0).toISOString(),
    summary: readOptionalString(body.summary) ?? 'Platform-v7 action boundary checked.',
    evidenceRefs: readEvidenceRefs(body.evidenceRefs),
    payload: isRecord(body.payload) ? body.payload : {},
  };
}

export function handlePlatformV7ServerActionRouteBody(
  body: PlatformV7ServerActionRouteBody,
): PlatformV7ServerActionRouteResult {
  const input = buildPlatformV7ServerActionInputFromRouteBody(body);

  if (!input) {
    return {
      ok: false,
      status: 400,
      body: {
        ok: false,
        status: 'not_accepted',
        message: 'Недостаточно данных для проверки действия.',
        canClaimExecuted: false,
        persisted: false,
        attemptedRuntimeWrite: false,
      },
    };
  }

  const repository = createPlatformV7MemoryPersistenceRepository();
  const response = buildPlatformV7ServerActionContractResponse(input, repository);
  const idempotencyKey = readOptionalString(body.idempotencyKey);
  const idempotencyBoundary = checkPlatformV7ServerIdempotencyBoundary(response, idempotencyKey);
  const auditEvent = buildPlatformV7AuditEvent({
    boundaryId: input.boundaryId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    entityId: input.entityId,
    entityType: input.entityType,
    dealId: input.dealId,
    idempotencyKey,
    occurredAt: input.occurredAt,
    summary: input.summary,
    evidenceRefs: input.evidenceRefs,
    moneyAmountMinor: input.amountMinor,
    currency: input.currency,
  });
  const auditBoundary = checkPlatformV7ServerAuditBoundary(response, auditEvent);
  const documentGate = checkPlatformV7ServerDocumentGate({
    response,
    dealId: input.dealId,
    documentId: input.entityId,
    idempotencyBoundary,
    auditBoundary,
  });
  const tripGate = checkPlatformV7ServerTripGate({
    response,
    dealId: input.dealId,
    tripId: input.entityId,
    idempotencyBoundary,
    auditBoundary,
  });
  const disputeGate = checkPlatformV7ServerDisputeGate({
    response,
    dealId: input.dealId,
    disputeId: input.entityId,
    evidenceRefs: input.evidenceRefs,
    idempotencyBoundary,
    auditBoundary,
  });
  const supportGate = checkPlatformV7ServerSupportGate({
    response,
    relatedEntityId: input.entityId,
    relatedEntityType: input.entityType,
    supportCaseId: input.entityId,
    idempotencyBoundary,
    auditBoundary,
  });
  const riskReviewGate = checkPlatformV7ServerRiskReviewGate({
    response,
    partyId: readOptionalString(isRecord(input.payload) ? input.payload.partyId : undefined),
    riskSnapshot: readRiskSnapshot(isRecord(input.payload) ? input.payload.riskSnapshot : undefined),
    idempotencyBoundary,
    auditBoundary,
  });
  const moneyGuard = checkPlatformV7ServerMoneyOperationGuard({
    response,
    dealId: input.dealId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    idempotencyBoundary,
    auditBoundary,
  });
  const persistenceBoundary = checkPlatformV7ServerPersistenceBoundary(response, repository);
  const routeSummary = buildPlatformV7ServerActionRouteSummary({
    idempotencyBoundary,
    auditBoundary,
    documentGate,
    tripGate,
    disputeGate,
    supportGate,
    riskReviewGate,
    moneyGuard,
    persistenceBoundary,
  });

  return {
    ok: response.status !== 'not_accepted',
    status: response.httpStatus,
    body: {
      ok: response.status !== 'not_accepted',
      response,
      summary: getPlatformV7ServerActionContractSummary(response),
      routeSummary,
      idempotencyBoundary,
      idempotencySummary: getPlatformV7ServerIdempotencyBoundarySummary(idempotencyBoundary),
      auditBoundary,
      auditSummary: getPlatformV7ServerAuditBoundarySummary(auditBoundary),
      documentGate,
      documentGateSummary: getPlatformV7ServerDocumentGateSummary(documentGate),
      tripGate,
      tripGateSummary: getPlatformV7ServerTripGateSummary(tripGate),
      disputeGate,
      disputeGateSummary: getPlatformV7ServerDisputeGateSummary(disputeGate),
      supportGate,
      supportGateSummary: getPlatformV7ServerSupportGateSummary(supportGate),
      riskReviewGate,
      riskReviewGateSummary: getPlatformV7ServerRiskReviewGateSummary(riskReviewGate),
      moneyGuard,
      moneyGuardSummary: getPlatformV7ServerMoneyOperationGuardSummary(moneyGuard),
      persistenceBoundary,
      persistenceSummary: getPlatformV7ServerPersistenceBoundarySummary(persistenceBoundary),
    },
  };
}
