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
import { buildPlatformV7ServerActionRouteResult, buildPlatformV7ServerActionRouteSummary } from './server-action-route-result';
import type { PlatformV7ServerActionRouteResult } from './server-action-route-result';
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
  readonly documentId?: unknown;
  readonly disputeId?: unknown;
  readonly externalConfirmationReady?: unknown;
  readonly partyId?: unknown;
  readonly riskSnapshot?: unknown;
  readonly supportCaseId?: unknown;
  readonly tripId?: unknown;
  readonly payload?: unknown;
};

export type { PlatformV7ServerActionRouteResult } from './server-action-route-result';

const isString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

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

function readPayloadBoolean(payload: Record<string, unknown>, key: string): boolean | undefined {
  return readOptionalBoolean(payload[key]);
}

function readPayloadString(payload: Record<string, unknown>, key: string): string | undefined {
  return readOptionalString(payload[key]);
}

function readDocumentId(body: PlatformV7ServerActionRouteBody, payload: Record<string, unknown>): string | undefined {
  return readOptionalString(body.documentId) ?? readPayloadString(payload, 'documentId');
}

function readDocumentExternalConfirmationReady(
  body: PlatformV7ServerActionRouteBody,
  payload: Record<string, unknown>,
): boolean | undefined {
  return readOptionalBoolean(body.externalConfirmationReady) ?? readPayloadBoolean(payload, 'externalConfirmationReady');
}

function readDisputeId(body: PlatformV7ServerActionRouteBody, payload: Record<string, unknown>): string | undefined {
  return readOptionalString(body.disputeId) ?? readPayloadString(payload, 'disputeId');
}

function readPartyId(body: PlatformV7ServerActionRouteBody, payload: Record<string, unknown>): string | undefined {
  return readOptionalString(body.partyId) ?? readPayloadString(payload, 'partyId');
}

function readRouteRiskSnapshot(
  body: PlatformV7ServerActionRouteBody,
  payload: Record<string, unknown>,
): PlatformV7RiskReviewSnapshot | undefined {
  return readRiskSnapshot(body.riskSnapshot) ?? readRiskSnapshot(payload.riskSnapshot);
}

function readSupportCaseId(body: PlatformV7ServerActionRouteBody, payload: Record<string, unknown>): string | undefined {
  return readOptionalString(body.supportCaseId) ?? readPayloadString(payload, 'supportCaseId');
}

function readTripId(body: PlatformV7ServerActionRouteBody, payload: Record<string, unknown>): string | undefined {
  return readOptionalString(body.tripId) ?? readPayloadString(payload, 'tripId');
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

  const payload = isRecord(input.payload) ? input.payload : {};
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
    documentId: readDocumentId(body, payload),
    externalConfirmationReady: readDocumentExternalConfirmationReady(body, payload),
    idempotencyBoundary,
    auditBoundary,
  });
  const tripGate = checkPlatformV7ServerTripGate({
    response,
    dealId: input.dealId,
    tripId: readTripId(body, payload),
    idempotencyBoundary,
    auditBoundary,
  });
  const disputeGate = checkPlatformV7ServerDisputeGate({
    response,
    dealId: input.dealId,
    disputeId: readDisputeId(body, payload),
    evidenceRefs: input.evidenceRefs,
    idempotencyBoundary,
    auditBoundary,
  });
  const supportGate = checkPlatformV7ServerSupportGate({
    response,
    relatedEntityId: input.entityId,
    relatedEntityType: input.entityType,
    supportCaseId: readSupportCaseId(body, payload),
    idempotencyBoundary,
    auditBoundary,
  });
  const riskReviewGate = checkPlatformV7ServerRiskReviewGate({
    response,
    partyId: readPartyId(body, payload),
    riskSnapshot: readRouteRiskSnapshot(body, payload),
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
