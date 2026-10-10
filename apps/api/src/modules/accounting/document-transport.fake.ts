import {
  type AccountingDocumentTransport,
  type DocumentEnvelope,
  TransportOutcome,
  type TransportReceipt,
} from './document-transport.port';

/**
 * An adapter that satisfies the contract without talking to anybody.
 *
 * Its purpose is not to stand in for a vendor. It is to make the contract
 * suite executable, so ADAPTER_READY is a stage something can actually be in
 * before credentials exist — which is what the owner asked for: take the
 * integrations as far as they honestly go and stop there rather than claiming
 * further.
 *
 * It issues receipts under a made-up operator name on purpose. Nothing may be
 * promoted to CONFIRMED_LIVE on its say-so, and the maturity policy would
 * refuse a receipt issued by this platform anyway.
 */
export class FakeAccountingDocumentTransport implements AccountingDocumentTransport {
  readonly code = 'FAKE_EDO';

  private readonly delivered = new Map<string, TransportReceipt>();
  private unavailable = false;
  private rejectionReasons: string[] | null = null;
  private issued = 0;

  /** The next send finds nobody home. Cleared after one attempt. */
  failNext(): void {
    this.unavailable = true;
  }

  /** The far side refuses, with reasons, until told otherwise. */
  rejectWith(reasons: string[]): void {
    this.rejectionReasons = reasons;
  }

  async send(envelope: DocumentEnvelope): Promise<TransportReceipt> {
    const already = this.delivered.get(envelope.versionId);
    if (already !== undefined) return already;

    if (this.unavailable) {
      // Cleared without recording anything: the document was never delivered,
      // so the next attempt is still a first attempt.
      this.unavailable = false;
      return {
        outcome: TransportOutcome.UNAVAILABLE,
        externalReceiptId: null,
        externalReceiptIssuer: null,
        correlationId: null,
        rejectionReasons: [],
      };
    }

    if (this.rejectionReasons !== null) {
      const receipt: TransportReceipt = {
        outcome: TransportOutcome.REJECTED,
        externalReceiptId: null,
        externalReceiptIssuer: null,
        correlationId: null,
        rejectionReasons: [...this.rejectionReasons],
      };
      // Recorded, because a rejection is an answer: asking again gets the same
      // answer rather than a different one.
      this.delivered.set(envelope.versionId, receipt);
      return receipt;
    }

    this.issued += 1;
    const receipt: TransportReceipt = {
      outcome: TransportOutcome.ACCEPTED,
      externalReceiptId: `FAKE-${String(this.issued).padStart(6, '0')}`,
      externalReceiptIssuer: 'FAKE_EDO_OPERATOR',
      correlationId: null,
      rejectionReasons: [],
    };
    this.delivered.set(envelope.versionId, receipt);
    return receipt;
  }
}
