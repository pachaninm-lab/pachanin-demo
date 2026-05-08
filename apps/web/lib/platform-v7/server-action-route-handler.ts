import type { PlatformV7ApiBoundaryId } from './api-boundary-contracts';
import type { PlatformV7ExecutionEnvelopeInput } from './execution-envelope-helper';
import { createPlatformV7MemoryPersistenceRepository } from './persistence-repository';
import {
  buildPlatformV7ServerActionContractResponse,
  getPlatformV7ServerActionContractSummary,
} from './server-action-contract-wrapper';
import {
  checkPlatformV7ServerIdempotencyBoundary,
  getPlatformV7ServerIdempotencyBoundarySummary,
} from './server-idempotency-boundary';
import {
  checkPlatformV7ServerPersistenceBoundary,
  getPlatformV7ServerPersistenceBoundarySummary,
} from './server-persistence-boundary';

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
  const idempotencyBoundary = checkPlatformV7ServerIdempotencyBoundary(
    response,
    readOptionalString(body.idempotencyKey),
  );
  const persistenceBoundary = checkPlatformV7ServerPersistenceBoundary(response, repository);

  return {
    ok: response.status !== 'not_accepted',
    status: response.httpStatus,
    body: {
      ok: response.status !== 'not_accepted',
      response,
      summary: getPlatformV7ServerActionContractSummary(response),
      idempotencyBoundary,
      idempotencySummary: getPlatformV7ServerIdempotencyBoundarySummary(idempotencyBoundary),
      persistenceBoundary,
      persistenceSummary: getPlatformV7ServerPersistenceBoundarySummary(persistenceBoundary),
    },
  };
}
