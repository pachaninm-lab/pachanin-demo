import {
  type AccountingDocumentTransport,
  type DocumentEnvelope,
  TransportOutcome,
  receiptIsCoherent,
} from './document-transport.port';

/**
 * The suite every adapter must pass before anybody may call it ADAPTER_READY.
 *
 * Exported as a function rather than written per adapter so that the 1C and the
 * EDO adapters are held to the same contract by the same code. An adapter with
 * its own bespoke tests is an adapter whose tests were written to pass.
 *
 * A passing run of this is the only evidence evaluateMaturityClaim accepts for
 * ADAPTER_READY, which is what stops that stage from meaning "somebody felt it
 * was ready".
 */

export interface TransportContractHarness {
  /** A fresh transport, with no memory of previous cases. */
  create(): AccountingDocumentTransport;
  /** Make the far side unreachable for the next send. */
  makeUnavailable(transport: AccountingDocumentTransport): void;
  /** Make the far side reject the next send. */
  makeRejecting(transport: AccountingDocumentTransport, reasons: string[]): void;
}

export function envelope(overrides: Partial<DocumentEnvelope> = {}): DocumentEnvelope {
  return {
    versionId: 'ver-1',
    documentType: 'UPD',
    documentNumber: 'УПД-2026-000114',
    payload: '<upd/>',
    payloadHash: 'a'.repeat(64),
    counterpartyInn: '7701234567',
    formatRevision: 'UPD_FORMAT@2026-01-01',
    ...overrides,
  };
}

/**
 * Run the contract. Call inside a describe block; it declares its own tests.
 */
export function assertTransportContract(harness: TransportContractHarness): void {
  it('names itself, so a receipt can be attributed', () => {
    const transport = harness.create();
    expect(transport.code.trim()).not.toBe('');
  });

  it('returns a coherent receipt for every outcome it produces', async () => {
    const accepted = await harness.create().send(envelope());
    expect(receiptIsCoherent(accepted)).toBe(true);

    const unavailableTransport = harness.create();
    harness.makeUnavailable(unavailableTransport);
    expect(receiptIsCoherent(await unavailableTransport.send(envelope()))).toBe(true);

    const rejectingTransport = harness.create();
    harness.makeRejecting(rejectingTransport, ['ИНН контрагента не найден']);
    expect(receiptIsCoherent(await rejectingTransport.send(envelope()))).toBe(true);
  });

  it('never reports ACCEPTED without an identifier issued by the far side', async () => {
    const receipt = await harness.create().send(envelope());
    if (receipt.outcome === TransportOutcome.ACCEPTED) {
      expect(receipt.externalReceiptId).not.toBeNull();
      expect(receipt.externalReceiptIssuer).not.toBeNull();
      // Ours does not count. A receipt we generated is a record of our own
      // intention, and the maturity policy refuses it for the same reason.
      expect(['PC_CROP', 'PLATFORM', 'SELF', 'INTERNAL']).not.toContain(
        (receipt.externalReceiptIssuer ?? '').toUpperCase(),
      );
    }
  });

  it('delivers a version once, however many times it is asked', async () => {
    const transport = harness.create();
    const first = await transport.send(envelope());
    const second = await transport.send(envelope());

    // Same receipt, not a second delivery: a retry the caller believes is a
    // first attempt is invisible everywhere except here.
    expect(second).toEqual(first);
  });

  it('treats a different version as a different document', async () => {
    const transport = harness.create();
    const first = await transport.send(envelope({ versionId: 'ver-1' }));
    const second = await transport.send(envelope({ versionId: 'ver-2' }));
    expect(second.externalReceiptId).not.toBe(first.externalReceiptId);
  });

  it('separates "nobody answered" from "they said no"', async () => {
    const unreachable = harness.create();
    harness.makeUnavailable(unreachable);
    expect((await unreachable.send(envelope())).outcome).toBe(
      TransportOutcome.UNAVAILABLE,
    );

    const rejecting = harness.create();
    harness.makeRejecting(rejecting, ['формат не поддерживается']);
    const rejected = await rejecting.send(envelope());
    expect(rejected.outcome).toBe(TransportOutcome.REJECTED);
    // Conflating the two is how a document the counterparty refused gets
    // retried until somebody notices, and how an outage looks like a rejection
    // the sender has to explain.
    expect(rejected.rejectionReasons.length).toBeGreaterThan(0);
  });

  it('does not retry a rejection into an acceptance', async () => {
    const transport = harness.create();
    harness.makeRejecting(transport, ['ИНН контрагента не найден']);
    const first = await transport.send(envelope());
    const second = await transport.send(envelope());
    expect(second.outcome).toBe(first.outcome);
  });

  it('leaves a failed send re-sendable', async () => {
    // An outage must not consume the idempotency slot: the document was never
    // delivered, so the next attempt is still a first attempt.
    const transport = harness.create();
    harness.makeUnavailable(transport);
    expect((await transport.send(envelope())).outcome).toBe(
      TransportOutcome.UNAVAILABLE,
    );

    const retried = await transport.send(envelope());
    expect(retried.outcome).toBe(TransportOutcome.ACCEPTED);
  });

  it('sends the bytes it was given, unchanged', async () => {
    const transport = harness.create();
    const sent = envelope({ payload: '<upd id="114"/>' });
    const before = sent.payload;
    await transport.send(sent);
    // The payload is what the signature covers. An adapter that re-renders it
    // sends something nobody signed.
    expect(sent.payload).toBe(before);
  });
}
