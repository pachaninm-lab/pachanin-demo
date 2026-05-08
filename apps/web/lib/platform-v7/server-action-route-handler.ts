import { buildPlatformV7AuditEvent } from './audit-event-helper';
import { createPlatformV7MemoryPersistenceRepository } from './persistence-repository';
import {
  buildPlatformV7ServerActionContractResponse,
  getPlatformV7ServerActionContractSummary,
} from './server-action-contract-wrapper';
import {
  buildPlatformV7ServerActionInputFromRouteBody,
  readPlatformV7RouteDocumentId,
  readPlatformV7RouteDisputeId,
  readPlatformV7RouteExternalConfirmationReady,
  readPlatformV7RouteOptionalString,
  readPlatformV7RoutePartyId,
  readPlatformV7RoutePayload,
  readPlatformV7RouteRiskSnapshotFromBody,
  readPlatformV7RouteSupportCaseId,
  readPlatformV7RouteTripId,
  type PlatformV7ServerActionRouteBody,
} from './server-action-route-body-reader';
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
import { buildPlatformV7ServerActionRouteResult, buildPlatformV7ServerActionRouteSummary } from './server-action-route-result';
import type { PlatformV7ServerActionRouteResult } from './server-action-route-result';
import {
  checkPlatformV7ServerRiskReviewGate,
  getPlatformV7ServerRiskReviewGateSummary,
} from './server-risk-review-gate';
import {
  checkPlatformV7ServerSupportGate,
  getPlatformV7ServerSupportGateSummary,
} from './server-support-gate';
import {
  checkPlatformV7ServerTripGate,
  getPlatformV7ServerTripGateSummary,
} from './server-trip-gate';

export type { PlatformV7ServerActionRouteBody } from './server-action-route-body-reader';
export type { PlatformV7ServerActionRouteResult } from './server-action-route-result';
export { buildPlatformV7ServerActionInputFromRouteBody } from './server-action-route-body-reader';

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

  const payload = readPlatformV7RoutePayload(input.payload);
  const externalConfirmationReady = readPlatformV7RouteExternalConfirmationReady(body, payload);
  const repository = createPlatformV7MemoryPersistenceRepository();
  const response = buildPlatformV7ServerActionContractResponse(input, repository);
  const idempotencyKey = readPlatformV7RouteOptionalString(body.idempotencyKey);
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
    documentId: readPlatformV7RouteDocumentId(body, payload),
    externalConfirmationReady,
    idempotencyBoundary,
    auditBoundary,
  });
  const tripGate = checkPlatformV7ServerTripGate({
    response,
    dealId: input.dealId,
    tripId: readPlatformV7RouteTripId(body, payload),
    idempotencyBoundary,
    auditBoundary,
  });
  const disputeGate = checkPlatformV7ServerDisputeGate({
    response,
    dealId: input.dealId,
    disputeId: readPlatformV7RouteDisputeId(body, payload),
    evidenceRefs: input.evidenceRefs,
    idempotencyBoundary,
    auditBoundary,
  });
  const supportGate = checkPlatformV7ServerSupportGate({
    response,
    relatedEntityId: input.entityId,
    relatedEntityType: input.entityType,
    supportCaseId: readPlatformV7RouteSupportCaseId(body, payload),
    idempotencyBoundary,
    auditBoundary,
  });
  const riskReviewGate = checkPlatformV7ServerRiskReviewGate({
    response,
    partyId: readPlatformV7RoutePartyId(body, payload),
    riskSnapshot: readPlatformV7RouteRiskSnapshotFromBody(body, payload),
    idempotencyBoundary,
    auditBoundary,
  });
  const moneyGuard = checkPlatformV7ServerMoneyOperationGuard({
    response,
    dealId: input.dealId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    externalConfirmationReady,
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
  const responseBody = {
    ok: routeSummary.canReachRuntimeBoundary && response.status !== 'not_accepted',
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
  };

  return buildPlatformV7ServerActionRouteResult({ response, routeSummary, body: responseBody });
}
