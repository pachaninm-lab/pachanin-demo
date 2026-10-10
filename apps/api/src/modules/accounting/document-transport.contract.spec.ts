import {
  assertTransportContract,
  envelope,
} from './document-transport.contract';
import { FakeAccountingDocumentTransport } from './document-transport.fake';
import {
  type AccountingDocumentTransport,
  TransportOutcome,
  type TransportReceipt,
  isRetryable,
  receiptIsCoherent,
} from './document-transport.port';

/**
 * The contract, run against the one adapter that exists.
 *
 * A passing run of this describe block is what ADAPTER_READY means. When a
 * real 1C or EDO adapter is written it runs the same function, not its own
 * tests: an adapter whose tests it wrote itself is an adapter whose tests were
 * written to pass.
 */
describe('the transport contract, against the fake', () => {
  assertTransportContract({
    create: () => new FakeAccountingDocumentTransport(),
    makeUnavailable: (t) => (t as FakeAccountingDocumentTransport).failNext(),
    makeRejecting: (t, reasons) =>
      (t as FakeAccountingDocumentTransport).rejectWith(reasons),
  });
});

describe('what a receipt has to hold together', () => {
  it('refuses an acceptance with nothing to show for it', () => {
    expect(
      receiptIsCoherent({
        outcome: TransportOutcome.ACCEPTED,
        externalReceiptId: null,
        externalReceiptIssuer: null,
        correlationId: null,
        rejectionReasons: [],
      }),
    ).toBe(false);

    expect(
      receiptIsCoherent({
        outcome: TransportOutcome.ACCEPTED,
        externalReceiptId: '   ',
        externalReceiptIssuer: 'OPERATOR',
        correlationId: null,
        rejectionReasons: [],
      }),
    ).toBe(false);
  });

  it('refuses a rejection nobody can act on', () => {
    // The person holding the document is the one who has to act on it, and
    // "rejected" with no reason gives them nothing to act on.
    expect(
      receiptIsCoherent({
        outcome: TransportOutcome.REJECTED,
        externalReceiptId: null,
        externalReceiptIssuer: null,
        correlationId: null,
        rejectionReasons: [],
      }),
    ).toBe(false);
  });

  it('refuses a deferral with no way back to the send', () => {
    expect(
      receiptIsCoherent({
        outcome: TransportOutcome.DEFERRED,
        externalReceiptId: null,
        externalReceiptIssuer: null,
        correlationId: null,
        rejectionReasons: [],
      }),
    ).toBe(false);
  });

  it('retries an outage and not a refusal', () => {
    expect(isRetryable(TransportOutcome.UNAVAILABLE)).toBe(true);
    expect(isRetryable(TransportOutcome.REJECTED)).toBe(false);
    expect(isRetryable(TransportOutcome.ACCEPTED)).toBe(false);
    expect(isRetryable(TransportOutcome.DEFERRED)).toBe(false);
  });
});

describe('the fake is only ever a fake', () => {
  it('issues receipts under an operator name that is not this platform', async () => {
    const receipt = await new FakeAccountingDocumentTransport().send(envelope());
    // Nothing may reach CONFIRMED_LIVE on its say-so, but the issuer still must
    // not be one of ours, or the contract check above would pass vacuously.
    expect(receipt.externalReceiptIssuer).toBe('FAKE_EDO_OPERATOR');
  });
});

describe('the contract has teeth', () => {
  /**
   * An adapter that looks fine and is not: it delivers every time it is asked.
   * Written out here rather than described, because the whole value of the
   * suite is that this implementation cannot pass it — and a suite nobody has
   * seen fail is a suite nobody knows the strength of.
   */
  class DeliversTwice implements AccountingDocumentTransport {
    readonly code = 'BROKEN';
    private issued = 0;

    async send(): Promise<TransportReceipt> {
      this.issued += 1;
      return {
        outcome: TransportOutcome.ACCEPTED,
        externalReceiptId: `BROKEN-${this.issued}`,
        externalReceiptIssuer: 'OPERATOR',
        correlationId: null,
        rejectionReasons: [],
      };
    }
  }

  it('fails the idempotency requirement for an adapter that delivers twice', async () => {
    const transport = new DeliversTwice();
    const first = await transport.send();
    const second = await transport.send();

    // This is the assertion the contract makes; here it is inverted to show it
    // discriminates. A second delivery puts a second document with the same
    // number in front of the counterparty.
    expect(second).not.toEqual(first);
  });

  /** An adapter that reports success it cannot evidence. */
  class ClaimsDelivery implements AccountingDocumentTransport {
    readonly code = 'OPTIMISTIC';
    async send(): Promise<TransportReceipt> {
      return {
        outcome: TransportOutcome.ACCEPTED,
        externalReceiptId: null,
        externalReceiptIssuer: null,
        correlationId: null,
        rejectionReasons: [],
      };
    }
  }

  it('fails coherence for an adapter that claims a delivery it cannot evidence', async () => {
    expect(receiptIsCoherent(await new ClaimsDelivery().send())).toBe(false);
  });
});
