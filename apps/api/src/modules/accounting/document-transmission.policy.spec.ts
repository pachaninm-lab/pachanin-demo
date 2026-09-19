import {
  DocumentFreshness,
  type FreshnessAssessment,
} from '../auth/accounting-document-staleness.policy';
import { FormatDenyReason } from '../auth/document-format.policy';
import {
  AdapterMaturity,
  MaturityRefusal,
  TransmissionRefusal,
  evaluateMaturityClaim,
  evaluateTransmission,
} from './document-transmission.policy';

const SIGNED = new Date('2026-08-16T10:00:00.000Z');

function freshness(
  state: DocumentFreshness = DocumentFreshness.CURRENT,
): FreshnessAssessment {
  return { freshness: state, staleSources: [], unverifiableSources: [] };
}

function send(overrides: Record<string, unknown> = {}) {
  return evaluateTransmission({
    signedAt: SIGNED,
    freshness: freshness(),
    formatAllowed: true,
    formatReasons: [],
    adapterMaturity: AdapterMaturity.CONFIRMED_LIVE,
    acceptedExternalId: null,
    ...overrides,
  } as Parameters<typeof evaluateTransmission>[0]);
}

describe('handing a document over', () => {
  it('permits a signed, current document in a live adapter', () => {
    expect(send()).toEqual({ permitted: true, refusals: [], formatReasons: [] });
  });

  it('refuses an unsigned version', () => {
    expect(send({ signedAt: null }).refusals).toContain(
      TransmissionRefusal.VERSION_NOT_SIGNED,
    );
  });

  it('separates stale from unverifiable', () => {
    // Not the same refusal, because they are not the same problem: stale means
    // the platform knows the figures moved, unverifiable means it cannot tell.
    expect(
      send({ freshness: freshness(DocumentFreshness.STALE) }).refusals,
    ).toContain(TransmissionRefusal.VERSION_STALE);

    expect(
      send({ freshness: freshness(DocumentFreshness.UNVERIFIABLE) }).refusals,
    ).toContain(TransmissionRefusal.VERSION_UNVERIFIABLE);
  });

  it('carries the format reasons through rather than flattening them', () => {
    const decision = send({
      formatAllowed: false,
      formatReasons: [FormatDenyReason.FORMAT_SUPERSEDED],
    });
    expect(decision.refusals).toContain(TransmissionRefusal.FORMAT_REFUSED);
    expect(decision.formatReasons).toEqual([FormatDenyReason.FORMAT_SUPERSEDED]);
  });

  it('refuses every adapter maturity short of confirmed live', () => {
    for (const maturity of [
      AdapterMaturity.NOT_ATTESTED,
      AdapterMaturity.ADAPTER_READY,
      AdapterMaturity.TEST,
    ]) {
      expect(send({ adapterMaturity: maturity }).refusals).toContain(
        TransmissionRefusal.ADAPTER_NOT_LIVE,
      );
    }
  });

  it('refuses a second delivery and says only that', () => {
    // Sending again would put a second document with the same number in front
    // of the counterparty, which is what a numbered sequence exists to prevent.
    expect(send({ acceptedExternalId: 'edo-77', signedAt: null })).toEqual({
      permitted: false,
      refusals: [TransmissionRefusal.ALREADY_ACCEPTED],
      formatReasons: [],
    });
  });

  it('reports every blocker at once', () => {
    const decision = send({
      signedAt: null,
      freshness: freshness(DocumentFreshness.STALE),
      formatAllowed: false,
      formatReasons: [FormatDenyReason.NO_FORMAT_IN_FORCE],
      adapterMaturity: AdapterMaturity.TEST,
    });

    expect(decision.refusals).toEqual(
      expect.arrayContaining([
        TransmissionRefusal.VERSION_NOT_SIGNED,
        TransmissionRefusal.VERSION_STALE,
        TransmissionRefusal.FORMAT_REFUSED,
        TransmissionRefusal.ADAPTER_NOT_LIVE,
      ]),
    );
  });
});

function claim(overrides: Record<string, unknown> = {}) {
  return evaluateMaturityClaim({
    from: AdapterMaturity.NOT_ATTESTED,
    to: AdapterMaturity.ADAPTER_READY,
    contractSuiteRunId: 'run-1',
    vendorTestCorrelationId: null,
    externalReceiptId: null,
    externalReceiptIssuer: null,
    ...overrides,
  } as Parameters<typeof evaluateMaturityClaim>[0]);
}

describe('claiming an adapter is further along', () => {
  it('accepts adapter-ready on a contract suite run', () => {
    expect(claim()).toEqual({ permitted: true, refusals: [] });
  });

  it('refuses adapter-ready with nothing behind it', () => {
    expect(claim({ contractSuiteRunId: '   ' }).refusals).toContain(
      MaturityRefusal.NO_CONTRACT_EVIDENCE,
    );
  });

  it('accepts test only on an answer from the vendor’s own environment', () => {
    expect(
      claim({
        from: AdapterMaturity.ADAPTER_READY,
        to: AdapterMaturity.TEST,
        vendorTestCorrelationId: 'corr-9',
      }),
    ).toEqual({ permitted: true, refusals: [] });

    expect(
      claim({ from: AdapterMaturity.ADAPTER_READY, to: AdapterMaturity.TEST })
        .refusals,
    ).toContain(MaturityRefusal.NO_VENDOR_TEST_EVIDENCE);
  });

  it('refuses confirmed live without a receipt from the far side', () => {
    expect(
      claim({ from: AdapterMaturity.TEST, to: AdapterMaturity.CONFIRMED_LIVE })
        .refusals,
    ).toContain(MaturityRefusal.NO_EXTERNAL_RECEIPT);
  });

  it('refuses a receipt this platform wrote about its own request', () => {
    // The failure this whole enum exists for: a 200 from our own client,
    // recorded as if the counterparty had confirmed anything.
    for (const issuer of ['PC_CROP', 'platform', 'Internal', 'self', '']) {
      expect(
        claim({
          from: AdapterMaturity.TEST,
          to: AdapterMaturity.CONFIRMED_LIVE,
          externalReceiptId: 'x-1',
          externalReceiptIssuer: issuer,
        }).refusals,
      ).toContain(MaturityRefusal.RECEIPT_IS_OUR_OWN);
    }
  });

  it('accepts confirmed live on a receipt the operator issued', () => {
    expect(
      claim({
        from: AdapterMaturity.TEST,
        to: AdapterMaturity.CONFIRMED_LIVE,
        externalReceiptId: 'DIADOC-2026-000114',
        externalReceiptIssuer: 'DIADOC',
      }),
    ).toEqual({ permitted: true, refusals: [] });
  });

  it('refuses a jump from nothing to live', () => {
    expect(
      claim({
        from: AdapterMaturity.NOT_ATTESTED,
        to: AdapterMaturity.CONFIRMED_LIVE,
        externalReceiptId: 'DIADOC-1',
        externalReceiptIssuer: 'DIADOC',
      }).refusals,
    ).toContain(MaturityRefusal.SKIPS_A_STAGE);
  });

  it('refuses going backwards, because a broken adapter is an incident', () => {
    expect(
      claim({ from: AdapterMaturity.TEST, to: AdapterMaturity.ADAPTER_READY }),
    ).toEqual({ permitted: false, refusals: [MaturityRefusal.BACKWARDS] });

    expect(
      claim({ from: AdapterMaturity.TEST, to: AdapterMaturity.TEST }).refusals,
    ).toEqual([MaturityRefusal.BACKWARDS]);
  });
});
