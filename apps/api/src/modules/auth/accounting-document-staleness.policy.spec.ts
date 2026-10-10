import {
  ALL_DOCUMENT_SOURCES,
  DocumentActionDenyReason as Deny,
  DocumentFreshness,
  DocumentSource,
  type DocumentVersionSnapshot,
  type SourceRevisions,
  assessFreshness,
  documentTypeSources,
  evaluateVersionSendable,
  evaluateVersionSignable,
  isKnownDocumentType,
} from './accounting-document-staleness.policy';

const CURRENT: SourceRevisions = {
  DEAL: 'deal-7',
  EXECUTION: 'exec-3',
  WEIGHT: 'weight-2',
  QUALITY: 'quality-5',
  PRICE: 'price-9',
  CONTRACT_VERSION: 'contract-1',
  COUNTERPARTY_REQUISITES: 'req-4',
  TAX_PROFILE: 'tax-1',
  REGULATORY_RULE: 'rule-2026-1',
};

function version(
  overrides: Partial<DocumentVersionSnapshot> = {},
): DocumentVersionSnapshot {
  return {
    versionNumber: 1,
    payloadHash: 'hash-abc',
    recordedRevisions: { ...CURRENT },
    signedAt: null,
    ...overrides,
  };
}

describe('document source mapping', () => {
  it('makes a УПД depend on every commercial and regulatory source', () => {
    expect([...documentTypeSources('UPD')].sort()).toEqual(
      [...ALL_DOCUMENT_SOURCES].sort(),
    );
  });

  it('does not make a payment order depend on grain quality', () => {
    expect(documentTypeSources('PAYMENT_ORDER')).not.toContain(
      DocumentSource.QUALITY,
    );
  });

  it('reports an unknown document type as unknown', () => {
    expect(isKnownDocumentType('UPD')).toBe(true);
    expect(isKnownDocumentType('INVENTED_FORM')).toBe(false);
    expect(documentTypeSources('INVENTED_FORM')).toEqual([]);
  });
});

describe('freshness', () => {
  it('is current when every recorded revision still matches', () => {
    const a = assessFreshness({
      documentType: 'UPD',
      version: version(),
      currentRevisions: CURRENT,
    });
    expect(a.freshness).toBe(DocumentFreshness.CURRENT);
    expect(a.staleSources).toEqual([]);
  });

  it('goes stale when the weight is re-measured', () => {
    const a = assessFreshness({
      documentType: 'UPD',
      version: version(),
      currentRevisions: { ...CURRENT, WEIGHT: 'weight-3' },
    });
    expect(a.freshness).toBe(DocumentFreshness.STALE);
    expect(a.staleSources).toEqual([
      { source: DocumentSource.WEIGHT, recordedRevision: 'weight-2', currentRevision: 'weight-3' },
    ]);
  });

  it('names every source that moved, not only the first', () => {
    const a = assessFreshness({
      documentType: 'UPD',
      version: version(),
      currentRevisions: { ...CURRENT, WEIGHT: 'weight-3', PRICE: 'price-10' },
    });
    expect(a.staleSources.map((s) => s.source).sort()).toEqual(
      [DocumentSource.PRICE, DocumentSource.WEIGHT].sort(),
    );
  });

  it('ignores a source the document type does not depend on', () => {
    const a = assessFreshness({
      documentType: 'PAYMENT_ORDER',
      version: version(),
      currentRevisions: { ...CURRENT, QUALITY: 'quality-6' },
    });
    expect(a.freshness).toBe(DocumentFreshness.CURRENT);
  });

  it('notices a changed tax profile', () => {
    const a = assessFreshness({
      documentType: 'UPD',
      version: version(),
      currentRevisions: { ...CURRENT, TAX_PROFILE: 'tax-2' },
    });
    expect(a.freshness).toBe(DocumentFreshness.STALE);
  });

  it('notices a changed contract version', () => {
    const a = assessFreshness({
      documentType: 'UPD',
      version: version(),
      currentRevisions: { ...CURRENT, CONTRACT_VERSION: 'contract-2' },
    });
    expect(a.freshness).toBe(DocumentFreshness.STALE);
  });

  it('notices changed counterparty requisites', () => {
    const a = assessFreshness({
      documentType: 'UPD',
      version: version(),
      currentRevisions: { ...CURRENT, COUNTERPARTY_REQUISITES: 'req-5' },
    });
    expect(a.freshness).toBe(DocumentFreshness.STALE);
  });

  it('notices a changed regulatory rule', () => {
    const a = assessFreshness({
      documentType: 'UPD',
      version: version(),
      currentRevisions: { ...CURRENT, REGULATORY_RULE: 'rule-2026-2' },
    });
    expect(a.freshness).toBe(DocumentFreshness.STALE);
  });

  describe('what the version never recorded', () => {
    it('is unverifiable rather than current', () => {
      const partial = { ...CURRENT };
      delete (partial as Record<string, string>).QUALITY;
      const a = assessFreshness({
        documentType: 'UPD',
        version: version({ recordedRevisions: partial }),
        currentRevisions: CURRENT,
      });
      expect(a.freshness).toBe(DocumentFreshness.UNVERIFIABLE);
      expect(a.unverifiableSources).toContain(DocumentSource.QUALITY);
    });

    it('is unverifiable when the live revision is unknown', () => {
      const live = { ...CURRENT };
      delete (live as Record<string, string>).PRICE;
      const a = assessFreshness({
        documentType: 'UPD',
        version: version(),
        currentRevisions: live,
      });
      expect(a.freshness).toBe(DocumentFreshness.UNVERIFIABLE);
      expect(a.unverifiableSources).toContain(DocumentSource.PRICE);
    });

    it('still reports stale first when something also moved', () => {
      const partial = { ...CURRENT };
      delete (partial as Record<string, string>).QUALITY;
      const a = assessFreshness({
        documentType: 'UPD',
        version: version({ recordedRevisions: partial }),
        currentRevisions: { ...CURRENT, WEIGHT: 'weight-3' },
      });
      expect(a.freshness).toBe(DocumentFreshness.STALE);
      expect(a.unverifiableSources).toContain(DocumentSource.QUALITY);
    });

    it('treats an unknown document type as unverifiable, never as fresh', () => {
      const a = assessFreshness({
        documentType: 'INVENTED_FORM',
        version: version(),
        currentRevisions: CURRENT,
      });
      expect(a.freshness).toBe(DocumentFreshness.UNVERIFIABLE);
    });

    it('is unverifiable when the version recorded nothing at all', () => {
      const a = assessFreshness({
        documentType: 'UPD',
        version: version({ recordedRevisions: {} }),
        currentRevisions: CURRENT,
      });
      expect(a.freshness).toBe(DocumentFreshness.UNVERIFIABLE);
      expect(a.unverifiableSources.length).toBe(
        documentTypeSources('UPD').length,
      );
    });
  });
});

describe('signing a version', () => {
  it('allows a current, unsigned version whose bytes match', () => {
    const d = evaluateVersionSignable({
      documentType: 'UPD',
      version: version(),
      currentRevisions: CURRENT,
      payloadHashToSign: 'hash-abc',
    });
    expect(d.reasons).toEqual([]);
    expect(d.allowed).toBe(true);
  });

  it('refuses a stale version', () => {
    const d = evaluateVersionSignable({
      documentType: 'UPD',
      version: version(),
      currentRevisions: { ...CURRENT, WEIGHT: 'weight-3' },
      payloadHashToSign: 'hash-abc',
    });
    expect(d.reasons).toContain(Deny.DOCUMENT_STALE);
  });

  it('refuses a version that is already signed', () => {
    const d = evaluateVersionSignable({
      documentType: 'UPD',
      version: version({ signedAt: new Date('2026-08-14T00:00:00.000Z') }),
      currentRevisions: CURRENT,
      payloadHashToSign: 'hash-abc',
    });
    expect(d.reasons).toContain(Deny.VERSION_ALREADY_SIGNED);
  });

  it('refuses when the bytes about to be signed are not the assessed ones', () => {
    const d = evaluateVersionSignable({
      documentType: 'UPD',
      version: version(),
      currentRevisions: CURRENT,
      payloadHashToSign: 'hash-something-else',
    });
    expect(d.reasons).toContain(Deny.PAYLOAD_HASH_MISMATCH);
  });

  it('refuses an unverifiable version rather than assuming it is fine', () => {
    const d = evaluateVersionSignable({
      documentType: 'INVENTED_FORM',
      version: version(),
      currentRevisions: CURRENT,
      payloadHashToSign: 'hash-abc',
    });
    expect(d.reasons).toContain(Deny.DOCUMENT_FRESHNESS_UNVERIFIABLE);
  });

  it('reports a stale document and a mismatched hash together', () => {
    const d = evaluateVersionSignable({
      documentType: 'UPD',
      version: version(),
      currentRevisions: { ...CURRENT, PRICE: 'price-10' },
      payloadHashToSign: 'hash-other',
    });
    expect(d.reasons).toEqual(
      expect.arrayContaining([Deny.PAYLOAD_HASH_MISMATCH, Deny.DOCUMENT_STALE]),
    );
  });
});

describe('sending a version', () => {
  it('allows a signed, current version', () => {
    const d = evaluateVersionSendable({
      documentType: 'UPD',
      version: version({ signedAt: new Date('2026-08-14T00:00:00.000Z') }),
      currentRevisions: CURRENT,
    });
    expect(d.allowed).toBe(true);
  });

  it('refuses an unsigned draft', () => {
    const d = evaluateVersionSendable({
      documentType: 'UPD',
      version: version(),
      currentRevisions: CURRENT,
    });
    expect(d.reasons).toContain(Deny.VERSION_NOT_SIGNED);
  });

  it('refuses a signed version that has since gone stale', () => {
    const d = evaluateVersionSendable({
      documentType: 'UPD',
      version: version({ signedAt: new Date('2026-08-14T00:00:00.000Z') }),
      currentRevisions: { ...CURRENT, QUALITY: 'quality-6' },
    });
    expect(d.allowed).toBe(false);
    expect(d.reasons).toContain(Deny.DOCUMENT_STALE);
  });
});
