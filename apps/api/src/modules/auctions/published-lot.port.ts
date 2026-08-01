/**
 * PROVISIONAL CONTRACT — the PublishedLot port that P0.3 requires from #3585.
 *
 * `PublishedLot` does not exist in the repository yet: the FGIS layer currently
 * projects SDIZ documents (`fgis_grain_sdiz_projections`) and carries no
 * publication, passport or reservation concept. This file states exactly what
 * the auction bridge needs so that #3585 has a concrete target and P0.3 is not
 * blocked on it. It deliberately contains no FGIS connection, sync, snapshot or
 * reconciliation logic — that boundary belongs to #3585.
 *
 * The rule this contract exists to enforce: a client publishing a lot to auction
 * supplies a `publishedLotId` and the auction parameters, and nothing else.
 * Provenance, organization, volume, passport, version, content hash and the
 * reservation are read by the server from PostgreSQL.
 *
 * This closes a real gap in the current command surface:
 * `auction.register_verified_lot` accepts `p_source_type`,
 * `p_source_external_id` and `p_source_certificate_id` as parameters and then
 * stamps `source_verified_at := clock_timestamp()` and
 * `admission_status := 'ADMITTED'` unconditionally. Today a caller can assert
 * its own provenance. Routing registration through this port removes that.
 */

/** Kopecks and tonnages cross the boundary as strings; they are never floats. */
export type Kopecks = string;
export type Tons = string;

export type PublishedLotStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'RESERVED'
  | 'WITHDRAWN'
  | 'EXPIRED';

/**
 * The server-side projection of a published, FGIS-backed batch.
 *
 * Every field here is authoritative and server-derived. Nothing in this shape
 * may be supplied, overridden or influenced by the publishing client.
 */
export type PublishedLot = Readonly<{
  /** Stable identifier; the only part of this shape a client ever names. */
  publishedLotId: string;

  /** Owning organization and its tenant, resolved from the publication record. */
  organizationId: string;
  tenantId: string;

  /** Regulatory provenance. `sourceExternalId` is the FGIS-side identifier. */
  sourceType: 'FGIS' | 'ERP' | 'MANUAL_VERIFIED' | 'OTHER';
  sourceExternalId: string;
  sourceCertificateId: string | null;

  /**
   * When the platform last confirmed this publication against the regulator.
   * `null` means unverified, and an unverified lot must never reach auction.
   */
  sourceVerifiedAt: Date | null;

  /** Batch passport reference and the content hash the verification covered. */
  passportReference: string;
  contentHash: string;

  /**
   * Monotonic version of the underlying publication. Carried into the auction
   * lot so a batch that moves underneath a live auction can be detected.
   */
  version: bigint;

  status: PublishedLotStatus;

  /** Commercial description, already sanitised for cross-organization display. */
  title: string;
  culture: string;
  grade: string | null;
  region: string;

  /** Gross published volume, and the part already reserved elsewhere. */
  volumeTons: Tons;
  reservedTons: Tons;

  /** Publication validity window, if the regulator or seller bounded it. */
  publishedUntil: Date | null;
}>;

/**
 * What a client may send when publishing a lot to auction.
 *
 * Note what is absent: organization, tenant, volume, provenance, passport,
 * hash and reservation. Those are read from `PublishedLot`.
 */
export type PublishLotToAuctionInput = Readonly<{
  publishedLotId: string;
  auctionEndsAt: string;
  startPriceKopecksPerTon: Kopecks;
  stepPriceKopecksPerTon: Kopecks;
  autoExtendEnabled?: boolean;
  autoExtendWindowMinutes?: number;
  autoExtendMinutes?: number;
  idempotencyKey: string;
}>;

/**
 * Read side of the port. #3585 supplies the implementation.
 *
 * `loadForPublication` must resolve within the caller's RLS transaction and
 * must return `null` rather than throwing when the row is invisible to the
 * caller, so that "not yours" and "does not exist" stay indistinguishable.
 */
export interface PublishedLotSource {
  loadForPublication(
    publishedLotId: string,
    actor: Readonly<{ organizationId: string; tenantId: string }>,
  ): Promise<PublishedLot | null>;
}

export type PublishedLotRejectionCode =
  | 'PUBLISHED_LOT_NOT_FOUND'
  | 'PUBLISHED_LOT_NOT_OWNED'
  | 'PUBLISHED_LOT_NOT_PUBLISHED'
  | 'PUBLISHED_LOT_NOT_VERIFIED'
  | 'PUBLISHED_LOT_PUBLICATION_EXPIRED'
  | 'PUBLISHED_LOT_NO_AVAILABLE_VOLUME'
  | 'PUBLISHED_LOT_VERSION_MOVED';

export class PublishedLotRejected extends Error {
  constructor(
    readonly code: PublishedLotRejectionCode,
    readonly publishedLotId: string,
  ) {
    super(code);
    this.name = 'PublishedLotRejected';
  }
}

/** Terms the bridge derives; the caller cannot influence any of these. */
export type DerivedAuctionLotTerms = Readonly<{
  title: string;
  culture: string;
  grade: string | null;
  region: string;
  /** Published volume minus what is already reserved. */
  volumeTons: Tons;
  sourceType: PublishedLot['sourceType'];
  sourceExternalId: string;
  sourceCertificateId: string | null;
  passportReference: string;
  contentHash: string;
  publishedLotVersion: bigint;
}>;

const TONS = /^(?:0|[1-9]\d{0,19})(?:\.\d{1,6})?$/;
const SCALE = 1_000_000n;

/** Parses a 6-decimal tonnage into integer micro-tons. Never uses floats. */
export function parseTons(value: Tons, field: string): bigint {
  if (typeof value !== 'string' || !TONS.test(value)) {
    throw new RangeError(`${field} must be a decimal with at most 6 places`);
  }
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, '0'));
}

export function formatTons(microTons: bigint): Tons {
  const whole = microTons / SCALE;
  const fraction = (microTons % SCALE).toString().padStart(6, '0').replace(/0+$/, '');
  return fraction.length > 0 ? `${whole}.${fraction}` : whole.toString();
}

/**
 * Validates a published lot and derives the auction terms from it.
 *
 * Pure and synchronous so it is testable without a database, and so the rules
 * live in one auditable place rather than being spread across callers.
 */
export function deriveAuctionLotTerms(
  lot: PublishedLot,
  actor: Readonly<{ organizationId: string; tenantId: string }>,
  now: Date,
): DerivedAuctionLotTerms {
  if (lot.organizationId !== actor.organizationId || lot.tenantId !== actor.tenantId) {
    throw new PublishedLotRejected('PUBLISHED_LOT_NOT_OWNED', lot.publishedLotId);
  }
  if (lot.status !== 'PUBLISHED') {
    throw new PublishedLotRejected('PUBLISHED_LOT_NOT_PUBLISHED', lot.publishedLotId);
  }
  if (lot.sourceVerifiedAt === null) {
    throw new PublishedLotRejected('PUBLISHED_LOT_NOT_VERIFIED', lot.publishedLotId);
  }
  if (lot.sourceExternalId.trim() === '') {
    throw new PublishedLotRejected('PUBLISHED_LOT_NOT_VERIFIED', lot.publishedLotId);
  }
  if (lot.publishedUntil !== null && lot.publishedUntil.getTime() <= now.getTime()) {
    throw new PublishedLotRejected('PUBLISHED_LOT_PUBLICATION_EXPIRED', lot.publishedLotId);
  }

  const available =
    parseTons(lot.volumeTons, 'volumeTons') - parseTons(lot.reservedTons, 'reservedTons');
  if (available <= 0n) {
    throw new PublishedLotRejected('PUBLISHED_LOT_NO_AVAILABLE_VOLUME', lot.publishedLotId);
  }

  return {
    title: lot.title,
    culture: lot.culture,
    grade: lot.grade,
    region: lot.region,
    volumeTons: formatTons(available),
    sourceType: lot.sourceType,
    sourceExternalId: lot.sourceExternalId,
    sourceCertificateId: lot.sourceCertificateId,
    passportReference: lot.passportReference,
    contentHash: lot.contentHash,
    publishedLotVersion: lot.version,
  };
}

/**
 * Re-checks a publication immediately before an auction is closed.
 *
 * Brief item 5 requires the batch, the publication and the reservation to be
 * re-verified before a winner is fixed, because an auction runs for hours and
 * the underlying batch can move. A version change means the batch is no longer
 * the one that was bid on.
 */
export function assertPublicationStillCurrent(
  lot: PublishedLot | null,
  expected: Readonly<{ publishedLotId: string; publishedLotVersion: bigint; awardedTons: Tons }>,
  now: Date,
): void {
  if (lot === null) {
    throw new PublishedLotRejected('PUBLISHED_LOT_NOT_FOUND', expected.publishedLotId);
  }
  if (lot.version !== expected.publishedLotVersion) {
    throw new PublishedLotRejected('PUBLISHED_LOT_VERSION_MOVED', expected.publishedLotId);
  }
  if (lot.status !== 'PUBLISHED' && lot.status !== 'RESERVED') {
    throw new PublishedLotRejected('PUBLISHED_LOT_NOT_PUBLISHED', expected.publishedLotId);
  }
  if (lot.sourceVerifiedAt === null) {
    throw new PublishedLotRejected('PUBLISHED_LOT_NOT_VERIFIED', expected.publishedLotId);
  }
  if (lot.publishedUntil !== null && lot.publishedUntil.getTime() <= now.getTime()) {
    throw new PublishedLotRejected('PUBLISHED_LOT_PUBLICATION_EXPIRED', expected.publishedLotId);
  }

  const available =
    parseTons(lot.volumeTons, 'volumeTons') - parseTons(lot.reservedTons, 'reservedTons');
  if (available < parseTons(expected.awardedTons, 'awardedTons')) {
    throw new PublishedLotRejected('PUBLISHED_LOT_NO_AVAILABLE_VOLUME', expected.publishedLotId);
  }
}
