/**
 * Handing a document to somebody else's system.
 *
 * This composes the decisions the contour already makes — is the version
 * signed, is it stale, is its envelope the one in force — and adds the two that
 * only matter at the moment of transmission: whether the adapter is in a state
 * that may carry real traffic, and whether the platform is entitled to say the
 * transfer happened.
 *
 * The second is the one that gets fudged. An HTTP 200 from an operator's
 * sandbox is not a delivered document, and neither is a green CI run. So the
 * maturity vocabulary here is deliberately blunt, the transitions are one-way
 * on evidence rather than on optimism, and LIVE_ACCEPTED cannot be reached by
 * any argument that does not include a receipt from the far side.
 */

import {
  DocumentFreshness,
  type FreshnessAssessment,
} from '../auth/accounting-document-staleness.policy';
import type { FormatDenyReason } from '../auth/document-format.policy';
import {
  IntegrationCapabilityMaturity,
  type IntegrationCapabilityMaturity as IntegrationCapabilityMaturityValue,
} from '../../../../../packages/domain-core/src';

/** Maturities that may carry a real document belonging to a real deal. */
const MAY_CARRY_REAL_TRAFFIC: readonly IntegrationCapabilityMaturityValue[] = [
  IntegrationCapabilityMaturity.LIVE_ACCEPTED,
];

export const TransmissionRefusal = {
  VERSION_NOT_SIGNED: 'VERSION_NOT_SIGNED',
  VERSION_STALE: 'VERSION_STALE',
  VERSION_UNVERIFIABLE: 'VERSION_UNVERIFIABLE',
  FORMAT_REFUSED: 'FORMAT_REFUSED',
  ADAPTER_NOT_LIVE: 'ADAPTER_NOT_LIVE',
  ALREADY_ACCEPTED: 'ALREADY_ACCEPTED',
} as const;
export type TransmissionRefusal =
  (typeof TransmissionRefusal)[keyof typeof TransmissionRefusal];

export interface TransmissionRequest {
  readonly signedAt: Date | null;
  readonly freshness: FreshnessAssessment;
  readonly formatAllowed: boolean;
  readonly formatReasons: readonly FormatDenyReason[];
  readonly integrationMaturity: IntegrationCapabilityMaturityValue;
  /** A receipt already recorded for this version from the far side. */
  readonly acceptedExternalId: string | null;
}

export interface TransmissionDecision {
  readonly permitted: boolean;
  readonly refusals: readonly TransmissionRefusal[];
  readonly formatReasons: readonly FormatDenyReason[];
}

/**
 * May this version be handed over right now?
 *
 * A closed accounting period is deliberately not consulted. Closing freezes
 * what the platform may still change about a month; a document signed inside it
 * is finished and sending it onward is not a change. Refusing here would make
 * the close a reason documents never reach the counterparty they were made for.
 */
export function evaluateTransmission(
  request: TransmissionRequest,
): TransmissionDecision {
  const refusals: TransmissionRefusal[] = [];

  if (request.acceptedExternalId !== null) {
    // Already delivered. Sending again would produce a second document at the
    // counterparty with the same number, which is precisely the thing a
    // numbered sequence exists to make impossible.
    return {
      permitted: false,
      refusals: [TransmissionRefusal.ALREADY_ACCEPTED],
      formatReasons: [],
    };
  }

  if (request.signedAt === null) refusals.push(TransmissionRefusal.VERSION_NOT_SIGNED);

  if (request.freshness.freshness === DocumentFreshness.STALE) {
    refusals.push(TransmissionRefusal.VERSION_STALE);
  }
  if (request.freshness.freshness === DocumentFreshness.UNVERIFIABLE) {
    // Not the same as stale. Unverifiable means the platform cannot tell, and
    // sending something it cannot vouch for is worse than sending something it
    // knows to be out of date, because nobody downstream will know either.
    refusals.push(TransmissionRefusal.VERSION_UNVERIFIABLE);
  }

  if (request.formatAllowed === false) refusals.push(TransmissionRefusal.FORMAT_REFUSED);

  if (!MAY_CARRY_REAL_TRAFFIC.includes(request.integrationMaturity)) {
    refusals.push(TransmissionRefusal.ADAPTER_NOT_LIVE);
  }

  return {
    permitted: refusals.length === 0,
    refusals,
    formatReasons: request.formatAllowed === false ? request.formatReasons : [],
  };
}
