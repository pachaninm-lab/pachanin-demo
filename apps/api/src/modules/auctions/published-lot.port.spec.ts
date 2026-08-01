import {
  assertPublicationStillCurrent,
  deriveAuctionLotTerms,
  formatTons,
  parseTons,
  PublishedLotRejected,
  type PublishedLot,
} from './published-lot.port';

const NOW = new Date('2026-08-01T12:00:00.000Z');
const ACTOR = { organizationId: 'org-seller', tenantId: 'tenant-seller' } as const;

function publishedLot(overrides: Partial<PublishedLot> = {}): PublishedLot {
  return {
    publishedLotId: 'plot-1',
    organizationId: 'org-seller',
    tenantId: 'tenant-seller',
    sourceType: 'FGIS',
    sourceExternalId: 'FGIS-SDIZ-99',
    sourceCertificateId: 'CERT-99',
    sourceVerifiedAt: new Date('2026-08-01T09:00:00.000Z'),
    passportReference: 'PASSPORT-7',
    contentHash: 'a'.repeat(64),
    version: 4n,
    status: 'PUBLISHED',
    title: 'Wheat 3rd class',
    culture: 'WHEAT',
    grade: '3',
    region: 'Rostov',
    volumeTons: '500.000000',
    reservedTons: '120.500000',
    publishedUntil: new Date('2026-08-02T00:00:00.000Z'),
    ...overrides,
  };
}

function rejectionCode(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof PublishedLotRejected) {
      return error.code;
    }
    throw error;
  }
  throw new Error('expected a PublishedLotRejected');
}

describe('tonnage arithmetic', () => {
  it('round-trips 6-decimal values without float drift', () => {
    for (const value of ['0.1', '0.000001', '1', '500.000000', '999999.999999']) {
      expect(formatTons(parseTons(value, 'v'))).toBe(
        value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value,
      );
    }
  });

  it('subtracts exactly where floating point would not', () => {
    // 0.1 + 0.2 !== 0.3 in IEEE-754; in micro-tons it is exact.
    const remainder = parseTons('0.3', 'a') - parseTons('0.1', 'b') - parseTons('0.2', 'c');
    expect(remainder).toBe(0n);
  });

  it('rejects more than six decimal places', () => {
    expect(() => parseTons('1.0000001', 'v')).toThrow(RangeError);
  });

  it('rejects negative and non-numeric input', () => {
    expect(() => parseTons('-1', 'v')).toThrow(RangeError);
    expect(() => parseTons('1e6', 'v')).toThrow(RangeError);
  });
});

describe('deriveAuctionLotTerms', () => {
  it('derives available volume as published minus reserved', () => {
    const terms = deriveAuctionLotTerms(publishedLot(), ACTOR, NOW);
    expect(terms.volumeTons).toBe('379.5');
    expect(terms.sourceExternalId).toBe('FGIS-SDIZ-99');
    expect(terms.publishedLotVersion).toBe(4n);
  });

  it('refuses a publication owned by another organization', () => {
    expect(
      rejectionCode(() =>
        deriveAuctionLotTerms(publishedLot({ organizationId: 'org-other' }), ACTOR, NOW),
      ),
    ).toBe('PUBLISHED_LOT_NOT_OWNED');
  });

  it('refuses a publication from another tenant even when the org id matches', () => {
    expect(
      rejectionCode(() =>
        deriveAuctionLotTerms(publishedLot({ tenantId: 'tenant-other' }), ACTOR, NOW),
      ),
    ).toBe('PUBLISHED_LOT_NOT_OWNED');
  });

  it('refuses an unverified publication', () => {
    expect(
      rejectionCode(() =>
        deriveAuctionLotTerms(publishedLot({ sourceVerifiedAt: null }), ACTOR, NOW),
      ),
    ).toBe('PUBLISHED_LOT_NOT_VERIFIED');
  });

  it('refuses a blank source identifier', () => {
    expect(
      rejectionCode(() =>
        deriveAuctionLotTerms(publishedLot({ sourceExternalId: '   ' }), ACTOR, NOW),
      ),
    ).toBe('PUBLISHED_LOT_NOT_VERIFIED');
  });

  it.each(['DRAFT', 'RESERVED', 'WITHDRAWN', 'EXPIRED'] as const)(
    'refuses status %s',
    (status) => {
      expect(rejectionCode(() => deriveAuctionLotTerms(publishedLot({ status }), ACTOR, NOW))).toBe(
        'PUBLISHED_LOT_NOT_PUBLISHED',
      );
    },
  );

  it('refuses a publication whose window has closed', () => {
    expect(
      rejectionCode(() =>
        deriveAuctionLotTerms(
          publishedLot({ publishedUntil: new Date('2026-08-01T11:59:59.000Z') }),
          ACTOR,
          NOW,
        ),
      ),
    ).toBe('PUBLISHED_LOT_PUBLICATION_EXPIRED');
  });

  it('refuses a fully reserved batch', () => {
    expect(
      rejectionCode(() =>
        deriveAuctionLotTerms(publishedLot({ reservedTons: '500.000000' }), ACTOR, NOW),
      ),
    ).toBe('PUBLISHED_LOT_NO_AVAILABLE_VOLUME');
  });

  it('refuses an over-reserved batch rather than returning negative volume', () => {
    expect(
      rejectionCode(() =>
        deriveAuctionLotTerms(publishedLot({ reservedTons: '600.000000' }), ACTOR, NOW),
      ),
    ).toBe('PUBLISHED_LOT_NO_AVAILABLE_VOLUME');
  });
});

describe('assertPublicationStillCurrent', () => {
  const expected = {
    publishedLotId: 'plot-1',
    publishedLotVersion: 4n,
    awardedTons: '100.000000',
  } as const;

  it('accepts an unchanged publication', () => {
    expect(() => assertPublicationStillCurrent(publishedLot(), expected, NOW)).not.toThrow();
  });

  it('accepts a publication already moved to RESERVED by this award', () => {
    expect(() =>
      assertPublicationStillCurrent(publishedLot({ status: 'RESERVED' }), expected, NOW),
    ).not.toThrow();
  });

  it('detects a batch that moved underneath the live auction', () => {
    expect(
      rejectionCode(() =>
        assertPublicationStillCurrent(publishedLot({ version: 5n }), expected, NOW),
      ),
    ).toBe('PUBLISHED_LOT_VERSION_MOVED');
  });

  it('detects a publication that vanished', () => {
    expect(rejectionCode(() => assertPublicationStillCurrent(null, expected, NOW))).toBe(
      'PUBLISHED_LOT_NOT_FOUND',
    );
  });

  it('detects a batch reserved out from under the award before closing', () => {
    expect(
      rejectionCode(() =>
        assertPublicationStillCurrent(publishedLot({ reservedTons: '450.000000' }), expected, NOW),
      ),
    ).toBe('PUBLISHED_LOT_NO_AVAILABLE_VOLUME');
  });

  it('detects a withdrawn publication', () => {
    expect(
      rejectionCode(() =>
        assertPublicationStillCurrent(publishedLot({ status: 'WITHDRAWN' }), expected, NOW),
      ),
    ).toBe('PUBLISHED_LOT_NOT_PUBLISHED');
  });
});
