import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const PUBLIC_MARKET_LIMIT = 12;
const PUBLIC_REF = /^market-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POSITIVE_DECIMAL = /^(?:0|[1-9][0-9]{0,19})(?:\.[0-9]{1,6})?$/;
const NON_NEGATIVE_INTEGER = /^(?:0|[1-9][0-9]{0,18})$/;
const POSITIVE_INTEGER = /^[1-9][0-9]{0,18}$/;

type PublicMarketLotRow = Readonly<{
  observed_at: Date;
  public_ref: string | null;
  culture: string | null;
  grade: string | null;
  volume_tons: string | null;
  start_price_kopecks_per_ton: string | null;
  region: string | null;
  auction_ends_at: Date | null;
  status: string | null;
  verification_status: string | null;
  trade_permission: string | null;
  lot_version: string | null;
  projected_at: Date | null;
}>;

@Injectable()
export class PublicAuctionMarketService {
  constructor(private readonly prisma: PrismaService) {}

  async listLots() {
    // One read-only PostgreSQL statement is the complete concurrency boundary.
    // The SECURITY DEFINER reader captures statement_timestamp() once inside the
    // same PostgreSQL backend and returns that exact value with every result,
    // including a single canonical empty row. The API therefore never compares
    // projection data against an application clock, a second DB statement, or a
    // timestamp obtained from another database node/connection.
    const rows = await this.prisma.$queryRaw<PublicMarketLotRow[]>(Prisma.sql`
      SELECT *
      FROM auction.list_public_market_lot_cards(${PUBLIC_MARKET_LIMIT})
      ORDER BY projected_at DESC NULLS LAST,
               auction_ends_at ASC NULLS LAST,
               public_ref ASC NULLS LAST
    `);

    const observedAt = rows[0]?.observed_at;
    if (!(observedAt instanceof Date) || !Number.isFinite(observedAt.getTime())) {
      throw invalidProjection('PUBLIC_MARKET_POSTGRESQL_CLOCK_UNAVAILABLE');
    }

    const items = rows.flatMap((row) => {
      if (
        !(row.observed_at instanceof Date)
        || !Number.isFinite(row.observed_at.getTime())
        || row.observed_at.getTime() !== observedAt.getTime()
      ) {
        throw invalidProjection('PUBLIC_MARKET_POSTGRESQL_CLOCK_DRIFT');
      }

      if (row.public_ref === null) {
        if (rows.length !== 1 || !isEmptyProjectionRow(row)) {
          throw invalidProjection('PUBLIC_MARKET_EMPTY_ROW_INVALID');
        }
        return [];
      }

      if (
        !(row.auction_ends_at instanceof Date)
        || !Number.isFinite(row.auction_ends_at.getTime())
        || row.auction_ends_at.getTime() <= observedAt.getTime()
      ) {
        throw invalidProjection('PUBLIC_MARKET_AUCTION_NOT_LIVE');
      }

      return [parsePublicMarketLot(row, observedAt)];
    });

    const version = rows.reduce((current, row) => {
      if (row.lot_version === null) return current;
      const candidate = parsePositiveBigInt(row.lot_version, 'lot_version');
      return candidate > current ? candidate : current;
    }, 0n);

    return Object.freeze({
      authority: Object.freeze({
        source: 'POSTGRESQL' as const,
        scope: 'PUBLIC_MARKET' as const,
        projection: 'ANONYMIZED_PUBLIC_MARKET' as const,
        sellerIdentity: 'REDACTED' as const,
        observedAt: observedAt.toISOString(),
        version: version.toString(),
      }),
      items,
      pageInfo: Object.freeze({
        limit: PUBLIC_MARKET_LIMIT,
        returned: items.length,
        hasMore: items.length === PUBLIC_MARKET_LIMIT,
      }),
    });
  }
}

function isEmptyProjectionRow(row: PublicMarketLotRow): boolean {
  return row.public_ref === null
    && row.culture === null
    && row.grade === null
    && row.volume_tons === null
    && row.start_price_kopecks_per_ton === null
    && row.region === null
    && row.auction_ends_at === null
    && row.status === null
    && row.verification_status === null
    && row.trade_permission === null
    && row.lot_version === null
    && row.projected_at === null;
}

function parsePublicMarketLot(row: PublicMarketLotRow, observedAt: Date) {
  const publicRef = row.public_ref;
  const culture = row.culture;
  const grade = row.grade;
  const volumeTons = row.volume_tons;
  const startPriceKopecksPerTon = row.start_price_kopecks_per_ton;
  const region = row.region;
  const auctionEndsAt = row.auction_ends_at;
  const status = row.status;
  const verificationStatus = row.verification_status;
  const tradePermission = row.trade_permission;
  const lotVersion = row.lot_version;
  const projectedAt = row.projected_at;

  if (
    typeof publicRef !== 'string'
    || !PUBLIC_REF.test(publicRef)
    || !boundedText(culture, 200)
    || (grade !== null && !boundedText(grade, 200))
    || typeof volumeTons !== 'string'
    || !POSITIVE_DECIMAL.test(volumeTons)
    || Number(volumeTons) <= 0
    || typeof startPriceKopecksPerTon !== 'string'
    || !NON_NEGATIVE_INTEGER.test(startPriceKopecksPerTon)
    || !boundedText(region, 500)
    || !(auctionEndsAt instanceof Date)
    || !Number.isFinite(auctionEndsAt.getTime())
    || auctionEndsAt.getTime() <= observedAt.getTime()
    || status !== 'BIDDING'
    || verificationStatus !== 'DECLARED'
    || tradePermission !== 'PUBLIC_ALLOWED'
    || typeof lotVersion !== 'string'
    || !POSITIVE_INTEGER.test(lotVersion)
    || !(projectedAt instanceof Date)
    || !Number.isFinite(projectedAt.getTime())
  ) {
    throw invalidProjection('PUBLIC_MARKET_PROJECTION_INVALID');
  }

  return Object.freeze({
    publicRef,
    culture,
    grade,
    volumeTons: normalizeDecimal(volumeTons),
    startPriceKopecksPerTon,
    region,
    auctionEndsAt: auctionEndsAt.toISOString(),
    status: 'BIDDING' as const,
    verificationStatus: 'DECLARED' as const,
    tradePermission: 'PUBLIC_ALLOWED' as const,
    independentVerification: null,
    disclosureCode: 'SELLER_DECLARED_NOT_INDEPENDENTLY_VERIFIED' as const,
    version: lotVersion,
  });
}

function boundedText(value: unknown, max: number): value is string {
  return typeof value === 'string'
    && value.trim().length > 0
    && value.length <= max
    && !/[\u0000-\u001F\u007F]/u.test(value);
}

function normalizeDecimal(value: string): string {
  const normalized = value.includes('.')
    ? value.replace(/0+$/u, '').replace(/\.$/u, '')
    : value;
  return normalized || '0';
}

function parsePositiveBigInt(value: string, field: string): bigint {
  if (!POSITIVE_INTEGER.test(value)) {
    throw invalidProjection('PUBLIC_MARKET_PROJECTION_INVALID', field);
  }
  return BigInt(value);
}

function invalidProjection(code: string, field?: string): InternalServerErrorException {
  return new InternalServerErrorException({ code, ...(field ? { field } : {}) });
}
