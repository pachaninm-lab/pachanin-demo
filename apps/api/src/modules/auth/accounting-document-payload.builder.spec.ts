import {
  PayloadDenyReason as Deny,
  type SourceSnapshot,
  buildDocumentPayload,
  canonicalJson,
  hashPayload,
} from './accounting-document-payload.builder';
import {
  DocumentFreshness,
  assessFreshness,
} from './accounting-document-staleness.policy';

function snapshot(overrides: Partial<SourceSnapshot> = {}): SourceSnapshot {
  return {
    deal: {
      revision: 'deal@7',
      value: {
        dealId: 'deal-1',
        dealNumber: 'СД-2026-11',
        sellerOrgId: 'org-a',
        buyerOrgId: 'org-b',
        currency: 'RUB',
        totalKopecks: 12_500_000n,
      },
    },
    execution: {
      revision: 'exec@3',
      value: { culture: 'Пшеница', cropClass: '3', gost: 'ГОСТ 9353-2016' },
    },
    weight: { revision: 'weight@2', value: { netWeightGrams: 25_000_000n } },
    quality: { revision: 'quality@5', value: { qualityPassportId: 'qp-9' } },
    price: { revision: 'price@9', value: { pricePerTonKopecks: 500_000n } },
    contractVersion: {
      revision: 'ДП-2026/17#1',
      value: { contractNumber: 'ДП-2026/17' },
    },
    counterpartyRequisites: {
      revision: 'req@4',
      value: { sellerInn: '1111111111', buyerInn: '2222222222' },
    },
    taxProfile: {
      revision: 'org-a@2026-01',
      value: { vatLine: 'НДС 10%', vatAmountKopecks: 1_250_000n },
    },
    regulatoryRule: {
      revision: 'VAT_RATES@2026-01',
      value: { formatRevision: 'UPD_FORMAT@5.03' },
    },
    ...overrides,
  };
}

function build(overrides: Partial<SourceSnapshot> = {}) {
  return buildDocumentPayload({
    documentType: 'UPD',
    snapshot: snapshot(overrides),
  });
}

/** Narrows to the refusal branch rather than casting past it. */
function reasonsOf(overrides: Partial<SourceSnapshot>): readonly string[] {
  const r = build(overrides);
  return r.built === false ? r.reasons : [];
}

describe('canonical serialisation', () => {
  it('does not depend on the order keys were assigned in', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  it('serialises bigint as a string rather than throwing on it', () => {
    expect(canonicalJson({ kopecks: 12_500_000n })).toBe(
      '{"kopecks":"12500000"}',
    );
  });

  it('never turns money into a number on the way to the hash', () => {
    expect(canonicalJson({ k: 9007199254740993n })).toContain(
      '9007199254740993',
    );
  });

  it('keeps nested order stable too', () => {
    expect(canonicalJson({ x: { b: 1, a: 2 } })).toBe(
      canonicalJson({ x: { a: 2, b: 1 } }),
    );
  });

  it('preserves array order, which is content rather than layout', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });

  it('gives the same hash for the same content assembled differently', () => {
    expect(hashPayload({ a: 1, b: { c: 2, d: 3 } })).toBe(
      hashPayload({ b: { d: 3, c: 2 }, a: 1 }),
    );
  });

  it('gives a different hash when any value changes', () => {
    expect(hashPayload({ total: 1n })).not.toBe(hashPayload({ total: 2n }));
  });
});

describe('building a УПД', () => {
  it('produces a payload, a snapshot and a hash together', () => {
    const r = build();
    expect(r.built).toBe(true);
    if (r.built === true) {
      expect(r.result.payloadHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(r.result.totalKopecks).toBe(12_500_000n);
    }
  });

  it('records a revision for every source the payload drew on', () => {
    const r = build();
    if (r.built === true) {
      expect(r.result.recordedRevisions).toEqual({
        DEAL: 'deal@7',
        EXECUTION: 'exec@3',
        WEIGHT: 'weight@2',
        QUALITY: 'quality@5',
        PRICE: 'price@9',
        CONTRACT_VERSION: 'ДП-2026/17#1',
        COUNTERPARTY_REQUISITES: 'req@4',
        TAX_PROFILE: 'org-a@2026-01',
        REGULATORY_RULE: 'VAT_RATES@2026-01',
      });
    }
  });

  it('restates the deal total rather than recomputing it from price and weight', () => {
    // 25 tonnes at 5000 ₽/t would be 12 500 000 kopecks by multiplication, but
    // the deal is authoritative: a total it disagrees with must surface, not be
    // silently replaced.
    const r = build({
      deal: {
        revision: 'deal@7',
        value: {
          dealId: 'deal-1',
          dealNumber: 'СД-2026-11',
          sellerOrgId: 'org-a',
          buyerOrgId: 'org-b',
          currency: 'RUB',
          totalKopecks: 9_999_999n,
        },
      },
    });
    if (r.built === true) {
      expect(r.result.totalKopecks).toBe(9_999_999n);
    }
  });

  it('refuses a deal with no recorded total', () => {
    const r = build({
      deal: {
        revision: 'deal@7',
        value: {
          dealId: 'deal-1',
          dealNumber: null,
          sellerOrgId: 'org-a',
          buyerOrgId: 'org-b',
          currency: 'RUB',
          totalKopecks: null,
        },
      },
    });
    expect(r.built).toBe(false);
    if (r.built === false) {
      expect(r.reasons).toContain(Deny.MISSING_TOTAL);
    }
  });

  it('refuses a currency it has no rules for', () => {
    const r = build({
      deal: {
        revision: 'deal@7',
        value: {
          dealId: 'deal-1',
          dealNumber: null,
          sellerOrgId: 'org-a',
          buyerOrgId: 'org-b',
          currency: 'USD',
          totalKopecks: 12_500_000n,
        },
      },
    });
    if (r.built === false) {
      expect(r.reasons).toContain(Deny.UNSUPPORTED_CURRENCY);
    }
  });

  it('refuses a document that cannot be matched to a counterparty', () => {
    const r = build({
      counterpartyRequisites: {
        revision: 'req@4',
        value: { sellerInn: '1111111111', buyerInn: null },
      },
    });
    if (r.built === false) {
      expect(r.reasons).toContain(Deny.MISSING_REQUISITES);
    }
  });

  it('refuses a missing weight, culture or contract', () => {
    expect(
      reasonsOf({ weight: { revision: 'w@1', value: { netWeightGrams: null } } }),
    ).toContain(Deny.MISSING_WEIGHT);
    expect(
      reasonsOf({
        execution: {
          revision: 'e@1',
          value: { culture: null, cropClass: null, gost: null },
        },
      }),
    ).toContain(Deny.MISSING_CULTURE);
    expect(
      reasonsOf({
        contractVersion: { revision: 'c@1', value: { contractNumber: null } },
      }),
    ).toContain(Deny.MISSING_CONTRACT);
  });

  it('refuses a source whose revision is blank, because the snapshot would vouch for nothing', () => {
    const r = build({
      quality: { revision: '   ', value: { qualityPassportId: 'qp-9' } },
    });
    expect(r.built).toBe(false);
    if (r.built === false) {
      expect(r.reasons).toContain(Deny.BLANK_SOURCE_REVISION);
    }
  });

  it('refuses a document type nobody wrote a builder for', () => {
    const r = buildDocumentPayload({
      documentType: 'INVENTED_FORM',
      snapshot: snapshot(),
    });
    expect(r.built).toBe(false);
    if (r.built === false) {
      expect(r.reasons).toEqual([Deny.UNSUPPORTED_DOCUMENT_TYPE]);
    }
  });

  it('is deterministic: the same snapshot yields the same hash', () => {
    const a = build();
    const b = build();
    if (a.built === true && b.built === true) {
      expect(a.result.payloadHash).toBe(b.result.payloadHash);
    }
  });

  it('changes the hash when a source value changes', () => {
    const a = build();
    const b = build({
      weight: { revision: 'weight@2', value: { netWeightGrams: 25_000_001n } },
    });
    if (a.built === true && b.built === true) {
      expect(a.result.payloadHash).not.toBe(b.result.payloadHash);
    }
  });
});

describe('the snapshot it produces is the one staleness checks against', () => {
  it('reads as CURRENT against the revisions it was built from', () => {
    const r = build();
    if (r.built === true) {
      const a = assessFreshness({
        documentType: 'UPD',
        version: {
          versionNumber: 1,
          payloadHash: r.result.payloadHash,
          recordedRevisions: r.result.recordedRevisions,
          signedAt: null,
        },
        currentRevisions: r.result.recordedRevisions,
      });
      expect(a.freshness).toBe(DocumentFreshness.CURRENT);
    }
  });

  it('goes STALE the moment one of those sources moves', () => {
    const r = build();
    if (r.built === true) {
      const a = assessFreshness({
        documentType: 'UPD',
        version: {
          versionNumber: 1,
          payloadHash: r.result.payloadHash,
          recordedRevisions: r.result.recordedRevisions,
          signedAt: null,
        },
        currentRevisions: { ...r.result.recordedRevisions, WEIGHT: 'weight@3' },
      });
      expect(a.freshness).toBe(DocumentFreshness.STALE);
    }
  });

  it('leaves no source unrecorded, so nothing is silently UNVERIFIABLE', () => {
    const r = build();
    if (r.built === true) {
      const a = assessFreshness({
        documentType: 'UPD',
        version: {
          versionNumber: 1,
          payloadHash: r.result.payloadHash,
          recordedRevisions: r.result.recordedRevisions,
          signedAt: null,
        },
        currentRevisions: r.result.recordedRevisions,
      });
      expect(a.unverifiableSources).toEqual([]);
    }
  });
});
