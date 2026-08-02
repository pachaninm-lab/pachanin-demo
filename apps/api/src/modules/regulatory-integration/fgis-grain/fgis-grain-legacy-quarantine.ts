import { ForbiddenException, GoneException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { RequestUser } from '../../../common/types/request-user';
import type {
  FgisLegacyQuarantineAuditService,
  FgisQuarantineAuditFact,
} from './fgis-grain-legacy-quarantine.audit';

/**
 * P0.2-1A — one denial shape for every retired legacy ФГИС «Зерно» path.
 *
 * Before this slice the platform exposed several routes that looked like a
 * working ФГИС integration but could not produce a regulatory result: a REST
 * adapter over invented paths, a mock deal push, staff-driven saga steps, two
 * JSON webhooks that no official contract defines, and an in-memory lot store.
 * Each of them could move platform state — or report success — on evidence that
 * never came from the external register.
 *
 * They now fail closed through the helpers below. A denial:
 *   - changes no business state;
 *   - is committed to `public.audit_events` before the refusal is returned;
 *   - carries a stable machine-readable code;
 *   - carries a correlation code the caller can quote to support;
 *   - never carries a credential, endpoint, certificate or request payload.
 *
 * Real exchange is served only by the canonical contour in this directory.
 */

export const FGIS_LEGACY_ERROR_CODES = {
  /** `POST /integrations/fgis-zerno/deals/:dealId/push` — mock deal push. */
  PUSH_RETIRED: 'LEGACY_FGIS_PUSH_RETIRED',
  /** Saga register/shipment/acceptance/certificate steps driven by staff. */
  SAGA_RETIRED: 'LEGACY_FGIS_SAGA_RETIRED',
  /** `POST /integrations/fgis/webhook` and `POST /api/webhooks/fgis`. */
  WEBHOOK_RETIRED: 'LEGACY_FGIS_WEBHOOK_RETIRED',
  /** Any other retired legacy route. */
  ROUTE_RETIRED: 'FGIS_LEGACY_ROUTE_RETIRED',
  /** Confirmed-grain publication before the canonical passport path exists. */
  VERIFIED_LOT_PATH_NOT_READY: 'FGIS_VERIFIED_LOT_PATH_NOT_READY',
  /** Legacy in-memory lot contour, withdrawn in production. */
  LEGACY_LOT_CONTOUR_RETIRED: 'LEGACY_FGIS_LOT_CONTOUR_RETIRED',
} as const;

export type FgisLegacyErrorCode =
  (typeof FGIS_LEGACY_ERROR_CODES)[keyof typeof FGIS_LEGACY_ERROR_CODES];

export const FGIS_QUARANTINE_BOUNDARY = 'LEGACY_FGIS_QUARANTINE';

export const FGIS_CANONICAL_CONTOUR =
  'apps/api/src/modules/regulatory-integration/fgis-grain';

/**
 * Support-facing reference for one denial. Random, not derived from tenant,
 * user, deal or payload, so quoting it leaks nothing.
 */
export function newFgisCorrelationCode(): string {
  return `FGIS-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export interface FgisLegacyDenial {
  readonly code: FgisLegacyErrorCode;
  readonly message: string;
  readonly correlationCode: string;
  readonly stateChanged: false;
  readonly nextStep: string;
  readonly attestation: 'NOT_ATTESTED';
  readonly boundary: typeof FGIS_QUARANTINE_BOUNDARY;
}

export interface DenyLegacyFgisParams {
  readonly code: FgisLegacyErrorCode;
  /** Short RU message for the operator or seller. No provider detail. */
  readonly message: string;
  /** What the caller should do instead. */
  readonly nextStep: string;
  /** Route or command being refused. Stored as the audited object id. */
  readonly route: string;
  /**
   * Authenticated principal, as the server resolved it. Never a browser-supplied
   * tenant, organization or role. Absent for anonymous routes.
   */
  readonly actor?: Partial<RequestUser> | null;
  /** Durable audit authority. Required — a denial that cannot be recorded fails. */
  readonly audit: FgisLegacyQuarantineAuditService;
}

function auditFactFrom(
  params: DenyLegacyFgisParams,
  correlationId: string,
): FgisQuarantineAuditFact {
  const actor = params.actor ?? null;
  return {
    tenantId: actor?.tenantId ?? null,
    organizationId: actor?.orgId ?? null,
    actorUserId: actor?.id ?? null,
    actorRole: actor?.role ?? null,
    sessionId: actor?.sessionId ?? null,
    route: params.route,
    denialCode: params.code,
    correlationId,
  };
}

function denialBody(
  params: DenyLegacyFgisParams,
  correlationCode: string,
): FgisLegacyDenial {
  return {
    code: params.code,
    message: params.message,
    correlationCode,
    stateChanged: false,
    nextStep: params.nextStep,
    attestation: 'NOT_ATTESTED',
    boundary: FGIS_QUARANTINE_BOUNDARY,
  };
}

/**
 * Commits the attempt, then builds the denial body. Separate from the throwing
 * helpers so a caller that must return a body rather than raise gets the same
 * shape and the same durable trail.
 */
export async function recordLegacyFgisDenial(
  params: DenyLegacyFgisParams,
): Promise<FgisLegacyDenial> {
  const correlationCode = newFgisCorrelationCode();
  // Throws FgisQuarantineAuditUnavailableError when PostgreSQL is unreachable.
  // That is the intended outcome: no unrecorded refusal, no business mutation.
  await params.audit.recordDenial(auditFactFrom(params, correlationCode));
  return denialBody(params, correlationCode);
}

/**
 * Refuses a retired legacy route with `410 Gone`: the endpoint existed, was
 * withdrawn, and no equivalent request will be accepted on it again.
 */
export async function denyRetiredLegacyFgisRoute(
  params: DenyLegacyFgisParams,
): Promise<never> {
  throw new GoneException(await recordLegacyFgisDenial(params));
}

/**
 * Refuses a legally significant action that the platform must never perform on
 * a client's behalf. `403` rather than `410`: the operation is not withdrawn,
 * the caller is simply not the party entitled to perform it.
 */
export async function denyLegacyFgisActionOnBehalfOfClient(
  params: DenyLegacyFgisParams,
): Promise<never> {
  throw new ForbiddenException(await recordLegacyFgisDenial(params));
}
