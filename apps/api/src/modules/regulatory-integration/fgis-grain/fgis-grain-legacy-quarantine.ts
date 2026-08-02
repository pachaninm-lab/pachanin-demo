import { ForbiddenException, GoneException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';

/**
 * P0.2-1A — one denial shape for every retired legacy ФГИС «Зерно» path.
 *
 * Before this slice the platform exposed several routes that looked like a
 * working ФГИС integration but could not produce a regulatory result: a REST
 * adapter over invented paths, a mock deal push, staff-driven saga steps, and
 * two JSON webhooks that no official contract defines. Each of them could move
 * platform state — or report success — on evidence that never came from the
 * external register.
 *
 * They now fail closed through the helpers below. A denial:
 *   - changes no business state;
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
} as const;

export type FgisLegacyErrorCode =
  (typeof FGIS_LEGACY_ERROR_CODES)[keyof typeof FGIS_LEGACY_ERROR_CODES];

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
}

export interface DenyLegacyFgisParams {
  readonly code: FgisLegacyErrorCode;
  /** Short RU message for the operator or seller. No provider detail. */
  readonly message: string;
  /** What the caller should do instead. */
  readonly nextStep: string;
  /** Route or command being refused, for the audit line only. */
  readonly route: string;
  /** Server-derived actor id, if the request was authenticated. Never a name. */
  readonly actorUserId?: string | null;
  readonly logger?: Logger;
}

const auditLogger = new Logger('FgisLegacyQuarantine');

/**
 * Builds the denial body and writes one audit line. Kept separate from the
 * throwing helpers so a caller that must return a body (rather than raise) gets
 * exactly the same shape and the same audit trail.
 */
export function recordLegacyFgisDenial(params: DenyLegacyFgisParams): FgisLegacyDenial {
  const correlationCode = newFgisCorrelationCode();
  const log = params.logger ?? auditLogger;

  // Deliberately minimal: code, route, actor id and correlation code. No body,
  // no headers, no signature, no provider endpoint — a denial must not become a
  // new leak channel.
  log.warn(
    `FGIS legacy path denied: code=${params.code} route=${params.route} ` +
      `actor=${params.actorUserId ?? 'anonymous'} correlation=${correlationCode}`,
  );

  return {
    code: params.code,
    message: params.message,
    correlationCode,
    stateChanged: false,
    nextStep: params.nextStep,
    attestation: 'NOT_ATTESTED',
  };
}

/**
 * Refuses a retired legacy route with `410 Gone`: the endpoint existed, was
 * withdrawn, and no equivalent request will be accepted on it again.
 */
export function denyRetiredLegacyFgisRoute(params: DenyLegacyFgisParams): never {
  throw new GoneException(recordLegacyFgisDenial(params));
}

/**
 * Refuses a legally significant action that the platform must never perform on
 * a client's behalf. `403` rather than `410`: the operation is not withdrawn,
 * the caller is simply not the party entitled to perform it.
 */
export function denyLegacyFgisActionOnBehalfOfClient(
  params: DenyLegacyFgisParams,
): never {
  throw new ForbiddenException(recordLegacyFgisDenial(params));
}
