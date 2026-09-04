import { AdapterMaturity } from './document-transmission.policy';

/**
 * What the platform can honestly say about its connections to somebody else's
 * systems.
 *
 * The temptation this module exists to refuse is the green tick. A screen that
 * shows "1С — подключено" because a configuration row exists, or "ЭДО — работает"
 * because a request returned 200, is a screen somebody files on the strength of.
 * So maturity here is never stored and never declared: it is derived from
 * evidence that already exists elsewhere in the contour, and every level above
 * the lowest has to be earned by a row somebody else wrote.
 *
 * The vocabulary is the transmission contour's own `AdapterMaturity`, unchanged.
 * A second ladder with different rungs would be two answers to "is this live",
 * and the whole point is that there is one.
 */

export const ConnectionKind = {
  /** Handing documents to an EDO operator. */
  EDO: 'EDO',
  /** Exchanging accounting facts with 1С. */
  ONE_C: 'ONE_C',
  /** Pulling statements from a bank. */
  BANK_STATEMENT: 'BANK_STATEMENT',
} as const;
export type ConnectionKind = (typeof ConnectionKind)[keyof typeof ConnectionKind];

/**
 * What a connection is waiting for.
 *
 * Named as things a person can go and obtain, not as internal state. "Vendor
 * credentials have not been issued to this organization" is actionable;
 * "configuration incomplete" is not.
 */
export const MissingPrerequisite = {
  /** No adapter code exists in the platform for this kind at all. */
  ADAPTER_NOT_IMPLEMENTED: 'ADAPTER_NOT_IMPLEMENTED',
  /** The adapter exists but nothing points it at an environment. */
  ENDPOINT_NOT_CONFIGURED: 'ENDPOINT_NOT_CONFIGURED',
  /** The vendor has not issued credentials for this organization. */
  VENDOR_CREDENTIALS_NOT_ISSUED: 'VENDOR_CREDENTIALS_NOT_ISSUED',
  /** Nobody has attested the adapter against a fake. */
  CONTRACT_NOT_ATTESTED: 'CONTRACT_NOT_ATTESTED',
  /** It has never been answered by the vendor's test environment. */
  TEST_EXCHANGE_NOT_PERFORMED: 'TEST_EXCHANGE_NOT_PERFORMED',
  /** No receipt from a real counterparty carrying their own identifier. */
  LIVE_RECEIPT_NOT_OBTAINED: 'LIVE_RECEIPT_NOT_OBTAINED',
} as const;
export type MissingPrerequisite =
  (typeof MissingPrerequisite)[keyof typeof MissingPrerequisite];

/**
 * The facts a connection's state is derived from.
 *
 * Every one of them is something the platform can read from its own rows. None
 * of them is an opinion, and none is supplied by the caller asking about the
 * connection.
 */
export interface ConnectionEvidence {
  readonly kind: ConnectionKind;
  /** Code for this kind exists and is wired into the module graph. */
  readonly adapterImplemented: boolean;
  /** Something in the platform names an environment for it. */
  readonly endpointConfigured: boolean;
  /** A credential reference exists — the reference, never the secret. */
  readonly credentialIssued: boolean;
  /** The adapter satisfies its contract against a fake, and that was recorded. */
  readonly contractAttested: boolean;
  /** The vendor's test environment answered it, and that was recorded. */
  readonly testExchangeRecorded: boolean;
  /**
   * A receipt from a real counterparty carrying the far side's own identifier.
   * Nothing else reaches CONFIRMED_LIVE — not a 200, not a green CI run, not a
   * successful send with no receipt.
   */
  readonly liveReceiptExternalId: string | null;
}

export interface ConnectionState {
  readonly kind: ConnectionKind;
  readonly maturity: AdapterMaturity;
  /** In order: the next thing to obtain comes first. */
  readonly missing: readonly MissingPrerequisite[];
  /** True only at CONFIRMED_LIVE. Never inferred from anything else. */
  readonly mayCarryRealTraffic: boolean;
}

/**
 * The state of one connection, derived.
 *
 * The ladder is walked from the bottom and stops at the first rung whose
 * evidence is absent. Reporting a higher level with a gap below it is how a
 * connection comes to be described as working while resting on something nobody
 * ever did.
 */
export function describeConnection(evidence: ConnectionEvidence): ConnectionState {
  const missing: MissingPrerequisite[] = [];

  if (evidence.adapterImplemented === false) {
    missing.push(MissingPrerequisite.ADAPTER_NOT_IMPLEMENTED);
  }
  if (evidence.endpointConfigured === false) {
    missing.push(MissingPrerequisite.ENDPOINT_NOT_CONFIGURED);
  }
  if (evidence.credentialIssued === false) {
    missing.push(MissingPrerequisite.VENDOR_CREDENTIALS_NOT_ISSUED);
  }
  if (evidence.contractAttested === false) {
    missing.push(MissingPrerequisite.CONTRACT_NOT_ATTESTED);
  }
  if (evidence.testExchangeRecorded === false) {
    missing.push(MissingPrerequisite.TEST_EXCHANGE_NOT_PERFORMED);
  }
  if (evidence.liveReceiptExternalId === null) {
    missing.push(MissingPrerequisite.LIVE_RECEIPT_NOT_OBTAINED);
  }

  const maturity = deriveMaturity(evidence);
  return {
    kind: evidence.kind,
    maturity,
    missing,
    mayCarryRealTraffic: maturity === AdapterMaturity.CONFIRMED_LIVE,
  };
}

function deriveMaturity(evidence: ConnectionEvidence): AdapterMaturity {
  // A receipt is the only thing that makes it live, and it only counts on top of
  // everything below it: a receipt without an attested contract means somebody
  // sent real traffic through an unattested adapter, which is a finding rather
  // than a level.
  if (
    evidence.liveReceiptExternalId !== null
    && evidence.testExchangeRecorded
    && evidence.contractAttested
    && evidence.credentialIssued
    && evidence.endpointConfigured
    && evidence.adapterImplemented
  ) {
    return AdapterMaturity.CONFIRMED_LIVE;
  }
  if (
    evidence.testExchangeRecorded
    && evidence.contractAttested
    && evidence.credentialIssued
    && evidence.endpointConfigured
    && evidence.adapterImplemented
  ) {
    return AdapterMaturity.TEST;
  }
  if (evidence.contractAttested && evidence.adapterImplemented) {
    return AdapterMaturity.ADAPTER_READY;
  }
  return AdapterMaturity.NOT_ATTESTED;
}

/**
 * Everything the platform knows about, whether or not it has been started.
 *
 * A connection absent from the answer would read as one that does not apply. A
 * connection reported as NOT_ATTESTED with its missing prerequisites listed is
 * the honest version of "not done yet".
 */
export const KNOWN_CONNECTION_KINDS: readonly ConnectionKind[] = Object.freeze([
  ConnectionKind.EDO,
  ConnectionKind.ONE_C,
  ConnectionKind.BANK_STATEMENT,
]);
