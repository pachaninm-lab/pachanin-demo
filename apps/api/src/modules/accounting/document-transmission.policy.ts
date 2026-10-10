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
 * on evidence rather than on optimism, and CONFIRMED_LIVE cannot be reached by
 * any argument that does not include a receipt from the far side.
 */

import {
  DocumentFreshness,
  type FreshnessAssessment,
} from '../auth/accounting-document-staleness.policy';
import type { FormatDenyReason } from '../auth/document-format.policy';

export const AdapterMaturity = {
  /** Nobody has attested anything. The default, and not a failure state. */
  NOT_ATTESTED: 'NOT_ATTESTED',
  /** The code exists and satisfies its contract against a fake. */
  ADAPTER_READY: 'ADAPTER_READY',
  /** It has spoken to the vendor's test environment and been answered. */
  TEST: 'TEST',
  /**
   * A real document reached a real counterparty and the far side said so.
   * Reachable only with a receipt carrying the external system's own
   * identifier — never by inference, and never by a successful request.
   */
  CONFIRMED_LIVE: 'CONFIRMED_LIVE',
} as const;
export type AdapterMaturity = (typeof AdapterMaturity)[keyof typeof AdapterMaturity];

/** Maturities that may carry a real document belonging to a real deal. */
const MAY_CARRY_REAL_TRAFFIC: readonly AdapterMaturity[] = [
  AdapterMaturity.CONFIRMED_LIVE,
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
  readonly adapterMaturity: AdapterMaturity;
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

  if (!MAY_CARRY_REAL_TRAFFIC.includes(request.adapterMaturity)) {
    refusals.push(TransmissionRefusal.ADAPTER_NOT_LIVE);
  }

  return {
    permitted: refusals.length === 0,
    refusals,
    formatReasons: request.formatAllowed === false ? request.formatReasons : [],
  };
}

export const MaturityRefusal = {
  BACKWARDS: 'BACKWARDS',
  SKIPS_A_STAGE: 'SKIPS_A_STAGE',
  NO_CONTRACT_EVIDENCE: 'NO_CONTRACT_EVIDENCE',
  NO_VENDOR_TEST_EVIDENCE: 'NO_VENDOR_TEST_EVIDENCE',
  NO_EXTERNAL_RECEIPT: 'NO_EXTERNAL_RECEIPT',
  RECEIPT_IS_OUR_OWN: 'RECEIPT_IS_OUR_OWN',
} as const;
export type MaturityRefusal = (typeof MaturityRefusal)[keyof typeof MaturityRefusal];

const ORDER: readonly AdapterMaturity[] = [
  AdapterMaturity.NOT_ATTESTED,
  AdapterMaturity.ADAPTER_READY,
  AdapterMaturity.TEST,
  AdapterMaturity.CONFIRMED_LIVE,
];

export interface MaturityClaim {
  readonly from: AdapterMaturity;
  readonly to: AdapterMaturity;
  /** A passing run of the adapter's contract suite against a fake. */
  readonly contractSuiteRunId: string | null;
  /** A response from the vendor's own test environment. */
  readonly vendorTestCorrelationId: string | null;
  /**
   * The identifier the external system assigned to a real document. Ours do
   * not count: a receipt we generated is a record of our own intention.
   */
  readonly externalReceiptId: string | null;
  /** Which system issued that receipt. */
  readonly externalReceiptIssuer: string | null;
}

export interface MaturityDecision {
  readonly permitted: boolean;
  readonly refusals: readonly MaturityRefusal[];
}

/**
 * Whether an adapter may be recorded at a higher maturity.
 *
 * One stage at a time, forwards only, each stage paid for with the evidence
 * that stage is about. The owner's instruction was to take integrations as far
 * as they honestly go without vendor credentials — which is exactly TEST, and
 * saying so is the point of having a stage that is not CONFIRMED_LIVE.
 */
export function evaluateMaturityClaim(claim: MaturityClaim): MaturityDecision {
  const refusals: MaturityRefusal[] = [];
  const from = ORDER.indexOf(claim.from);
  const to = ORDER.indexOf(claim.to);

  if (to <= from) {
    // Demotion is a different act with different evidence — an adapter that
    // stopped working is an incident, not a claim — and it is not this.
    return { permitted: false, refusals: [MaturityRefusal.BACKWARDS] };
  }
  if (to - from > 1) refusals.push(MaturityRefusal.SKIPS_A_STAGE);

  if (claim.to === AdapterMaturity.ADAPTER_READY) {
    if (isBlank(claim.contractSuiteRunId)) {
      refusals.push(MaturityRefusal.NO_CONTRACT_EVIDENCE);
    }
  }

  if (claim.to === AdapterMaturity.TEST) {
    if (isBlank(claim.vendorTestCorrelationId)) {
      refusals.push(MaturityRefusal.NO_VENDOR_TEST_EVIDENCE);
    }
  }

  if (claim.to === AdapterMaturity.CONFIRMED_LIVE) {
    if (isBlank(claim.externalReceiptId)) {
      refusals.push(MaturityRefusal.NO_EXTERNAL_RECEIPT);
    } else if (isOurOwn(claim.externalReceiptIssuer)) {
      // The failure mode this exists for: a receipt the platform wrote about
      // its own request, presented as confirmation from the far side.
      refusals.push(MaturityRefusal.RECEIPT_IS_OUR_OWN);
    }
  }

  return { permitted: refusals.length === 0, refusals };
}

function isBlank(value: string | null): boolean {
  return value === null || value.trim() === '';
}

/** Issuers that are this platform under one name or another. */
const OUR_OWN_ISSUERS: readonly string[] = [
  'PC_CROP',
  'PLATFORM',
  'SELF',
  'INTERNAL',
];

function isOurOwn(issuer: string | null): boolean {
  if (issuer === null || issuer.trim() === '') return true;
  return OUR_OWN_ISSUERS.includes(issuer.trim().toUpperCase());
}
