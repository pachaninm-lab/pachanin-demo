import type { PlatformV7ApiBoundaryId } from './api-boundary-contracts';
import type { PlatformV7ExecutionEnvelopeInput } from './execution-envelope-helper';
import type { PlatformV7RiskReviewSnapshot } from './server-risk-review-gate';

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

export const isPlatformV7RouteString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const isPlatformV7RouteRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function readPlatformV7RouteOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export function readPlatformV7RouteOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function readPlatformV7RouteOptionalString(value: unknown): string | undefined {
  return isPlatformV7RouteString(value) ? value : undefined;
}

export function readPlatformV7RouteEvidenceRefs(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const refs = value.filter(isPlatformV7RouteString);
  return refs.length > 0 ? refs : undefined;
}

export function readPlatformV7RouteRiskSnapshot(value: unknown): PlatformV7RiskReviewSnapshot | undefined {
  if (!isPlatformV7RouteRecord(value)) return undefined;
  const status = value.status;
  if (status !== 'clear' && status !== 'review' && status !== 'blocked' && status !== 'unknown') return undefined;
  return {
    status,
    score: readPlatformV7RouteOptionalNumber(value.score),
    source: readPlatformV7RouteOptionalString(value.source),
  };
}

function readPayloadBoolean(payload: Record<string, unknown>, key: string): boolean | undefined {
  return readPlatformV7RouteOptionalBoolean(payload[key]);
}

function readPayloadNumber(payload: Record<string, unknown>, key: string): number | undefined {
  return readPlatformV7RouteOptionalNumber(payload[key]);
}

function readPayloadString(payload: Record<string, unknown>, key: string): string | undefined {
  return readPlatformV7RouteOptionalString(payload[key]);
}

export function readPlatformV7RoutePayload(inputPayload: unknown): Record<string, unknown> {
  return isPlatformV7RouteRecord(inputPayload) ? inputPayload : {};
}

export function readPlatformV7RouteDealId(
  body: PlatformV7ServerActionRouteBody,
  payload: Record<string, unknown>,
): string | undefined {
  return readPlatformV7RouteOptionalString(body.dealId) ?? readPayloadString(payload, 'dealId');
}

export function readPlatformV7RouteMoneyAmountMinor(
  body: PlatformV7ServerActionRouteBody,
  payload: Record<string, unknown>,
): number | undefined {
  return (
    readPlatformV7RouteOptionalNumber(body.amountMinor) ??
    readPayloadNumber(payload, 'amountMinor') ??
    readPayloadNumber(payload, 'claimAmountMinor')
  );
}

export function readPlatformV7RouteCurrency(
  body: PlatformV7ServerActionRouteBody,
  payload: Record<string, unknown>,
): string | undefined {
  return readPlatformV7RouteOptionalString(body.currency) ?? readPayloadString(payload, 'currency');
}

export function readPlatformV7RouteAttemptId(
  body: PlatformV7ServerActionRouteBody,
  payload: Record<string, unknown>,
): string | undefined {
  return readPlatformV7RouteOptionalString(body.attemptId) ?? readPayloadString(payload, 'attemptId');
}

export function readPlatformV7RouteOccurredAt(
  body: PlatformV7ServerActionRouteBody,
  payload: Record<string, unknown>,
): string {
  return (
    readPlatformV7RouteOptionalString(body.occurredAt) ??
    readPayloadString(payload, 'occurredAt') ??
    new Date(0).toISOString()
  );
}

export function readPlatformV7RouteSummary(
  body: PlatformV7ServerActionRouteBody,
  payload: Record<string, unknown>,
): string {
  return (
    readPlatformV7RouteOptionalString(body.summary) ??
    readPayloadString(payload, 'summary') ??
    'Platform-v7 action boundary checked.'
  );
}

export function readPlatformV7RouteEvidenceRefsFromBody(
  body: PlatformV7ServerActionRouteBody,
  payload: Record<string, unknown>,
): readonly string[] | undefined {
  return readPlatformV7RouteEvidenceRefs(body.evidenceRefs) ?? readPlatformV7RouteEvidenceRefs(payload.evidenceRefs);
}

export function readPlatformV7RouteIdempotencyKey(
  body: PlatformV7ServerActionRouteBody,
  payload: Record<string, unknown>,
): string | undefined {
  return readPlatformV7RouteOptionalString(body.idempotencyKey) ?? readPayloadString(payload, 'idempotencyKey');
}

export function readPlatformV7RouteExternalConfirmationReady(
  body: PlatformV7ServerActionRouteBody,
  payload: Record<string, unknown>,
): boolean | undefined {
  return readPlatformV7RouteOptionalBoolean(body.externalConfirmationReady) ?? readPayloadBoolean(payload, 'externalConfirmationReady');
}

export function readPlatformV7RouteDocumentId(
  body: PlatformV7ServerActionRouteBody,
  payload: Record<string, unknown>,
): string | undefined {
  return readPlatformV7RouteOptionalString(body.documentId) ?? readPayloadString(payload, 'documentId');
}

export function readPlatformV7RouteDisputeId(
  body: PlatformV7ServerActionRouteBody,
  payload: Record<string, unknown>,
): string | undefined {
  return readPlatformV7RouteOptionalString(body.disputeId) ?? readPayloadString(payload, 'disputeId');
}

export function readPlatformV7RoutePartyId(
  body: PlatformV7ServerActionRouteBody,
  payload: Record<string, unknown>,
): string | undefined {
  return readPlatformV7RouteOptionalString(body.partyId) ?? readPayloadString(payload, 'partyId');
}

export function readPlatformV7RouteRiskSnapshotFromBody(
  body: PlatformV7ServerActionRouteBody,
  payload: Record<string, unknown>,
): PlatformV7RiskReviewSnapshot | undefined {
  return readPlatformV7RouteRiskSnapshot(body.riskSnapshot) ?? readPlatformV7RouteRiskSnapshot(payload.riskSnapshot);
}

export function readPlatformV7RouteSupportCaseId(
  body: PlatformV7ServerActionRouteBody,
  payload: Record<string, unknown>,
): string | undefined {
  return readPlatformV7RouteOptionalString(body.supportCaseId) ?? readPayloadString(payload, 'supportCaseId');
}

export function readPlatformV7RouteTripId(
  body: PlatformV7ServerActionRouteBody,
  payload: Record<string, unknown>,
): string | undefined {
  return readPlatformV7RouteOptionalString(body.tripId) ?? readPayloadString(payload, 'tripId');
}

export function buildPlatformV7ServerActionInputFromRouteBody(
  body: PlatformV7ServerActionRouteBody,
): PlatformV7ExecutionEnvelopeInput | undefined {
  if (
    !isPlatformV7RouteString(body.boundaryId) ||
    !isPlatformV7RouteString(body.actorId) ||
    !isPlatformV7RouteString(body.actorRole)
  ) {
    return undefined;
  }
  if (!isPlatformV7RouteString(body.entityId) || !isPlatformV7RouteString(body.entityType)) return undefined;

  const payload = readPlatformV7RoutePayload(body.payload);

  return {
    boundaryId: body.boundaryId as PlatformV7ApiBoundaryId,
    actorId: body.actorId,
    actorRole: body.actorRole,
    entityId: body.entityId,
    entityType: body.entityType,
    dealId: readPlatformV7RouteDealId(body, payload),
    amountMinor: readPlatformV7RouteMoneyAmountMinor(body, payload),
    currency: readPlatformV7RouteCurrency(body, payload),
    attemptId: readPlatformV7RouteAttemptId(body, payload),
    occurredAt: readPlatformV7RouteOccurredAt(body, payload),
    summary: readPlatformV7RouteSummary(body, payload),
    evidenceRefs: readPlatformV7RouteEvidenceRefsFromBody(body, payload),
    payload,
  };
}
