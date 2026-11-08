/**
 * What an adapter to somebody else's system must do.
 *
 * Written as a port with a contract suite behind it rather than as an
 * interface alone, because "the adapter is ready" is a claim, and a claim
 * needs something that can fail. ADAPTER_READY in the maturity vocabulary
 * means exactly one thing: a run of the contract suite in
 * document-transport.contract.ts passed against this implementation.
 *
 * The port is deliberately narrow. It sends one already-signed version and
 * reports what the far side said. It does not decide whether the version may be
 * sent — evaluateTransmission does that — and it does not record anything: an
 * adapter that writes to the database is an adapter that can disagree with it.
 */

export const TransportOutcome = {
  /** The far side took it and gave an identifier for what it took. */
  ACCEPTED: 'ACCEPTED',
  /** The far side looked at it and said no. Retrying changes nothing. */
  REJECTED: 'REJECTED',
  /** Taken for processing; the answer arrives later, by callback. */
  DEFERRED: 'DEFERRED',
  /** Nobody answered. Retrying is the right thing to do. */
  UNAVAILABLE: 'UNAVAILABLE',
} as const;
export type TransportOutcome =
  (typeof TransportOutcome)[keyof typeof TransportOutcome];

export interface DocumentEnvelope {
  /** The version being sent. Idempotency is keyed on this and nothing else. */
  readonly versionId: string;
  readonly documentType: string;
  readonly documentNumber: string;
  /** The exact bytes that were signed. An adapter never re-renders them. */
  readonly payload: string;
  /** SHA-256 of those bytes, as recorded on the version. */
  readonly payloadHash: string;
  readonly counterpartyInn: string;
  /** Format version in force when the document was made. */
  readonly formatRevision: string;
}

export interface TransportReceipt {
  readonly outcome: TransportOutcome;
  /**
   * Present only on ACCEPTED, and issued by the far side. An adapter that
   * invents one is claiming a delivery nobody made — which is why the maturity
   * policy refuses a receipt whose issuer is this platform.
   */
  readonly externalReceiptId: string | null;
  readonly externalReceiptIssuer: string | null;
  /** Present on DEFERRED, so a later callback can be tied back to this send. */
  readonly correlationId: string | null;
  /** Present on REJECTED: what the far side objected to, in its own words. */
  readonly rejectionReasons: readonly string[];
}

export interface AccountingDocumentTransport {
  /** A stable code for this adapter, used to attribute receipts. */
  readonly code: string;

  /**
   * Send one version.
   *
   * Must be idempotent on versionId: sending the same version twice returns
   * the first receipt rather than delivering twice. A second delivery puts a
   * second document with the same number in front of the counterparty, which
   * is the failure a numbered sequence exists to prevent — and the adapter is
   * the only layer that can see a retry the caller believes is a first attempt.
   */
  send(envelope: DocumentEnvelope): Promise<TransportReceipt>;
}

/** Outcomes worth retrying. REJECTED is not one: the answer will not change. */
export function isRetryable(outcome: TransportOutcome): boolean {
  return outcome === TransportOutcome.UNAVAILABLE;
}

/**
 * Whether a receipt is internally coherent.
 *
 * Used by the contract suite and by the dispatcher, so an adapter that returns
 * ACCEPTED with nothing to show for it is caught in both places rather than
 * only in tests.
 */
export function receiptIsCoherent(receipt: TransportReceipt): boolean {
  if (receipt.outcome === TransportOutcome.ACCEPTED) {
    return (
      receipt.externalReceiptId !== null &&
      receipt.externalReceiptId.trim() !== '' &&
      receipt.externalReceiptIssuer !== null &&
      receipt.externalReceiptIssuer.trim() !== '' &&
      receipt.rejectionReasons.length === 0
    );
  }
  if (receipt.outcome === TransportOutcome.DEFERRED) {
    return (
      receipt.correlationId !== null &&
      receipt.correlationId.trim() !== '' &&
      receipt.externalReceiptId === null
    );
  }
  if (receipt.outcome === TransportOutcome.REJECTED) {
    // A rejection with no reason is one nobody can act on, and the person
    // holding the document is the one who has to act.
    return receipt.rejectionReasons.length > 0 && receipt.externalReceiptId === null;
  }
  return receipt.externalReceiptId === null;
}
