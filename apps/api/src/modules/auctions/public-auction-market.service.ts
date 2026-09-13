import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const PUBLIC_MARKET_LIMIT = 12;
const PUBLIC_REF = /^market-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POSITIVE_DECIMAL = /^(?:0|[1-9][0-9]{0,19})(?:\.[0-9]{1,6})?$/;
const NON_NEGATIVE_INTEGER = /^(?:0|[1-9][0-9]{0,18})$/;
const POSITIVE_INTEGER = /^[1-9][0-9]{0,18}$/;

type PublicMarketClockRow = Readonly<{
  observed_at: Date;
}>;

type PublicMarketLotRow = Readonly<{
  public_ref: string;
  culture: string;
  grade: string | null;
  volume_tons: string;
  start_price_kopecks_per_ton: string;
  region: string;
  auction_ends_at: Date;
  status: string;
  verification_status: string;
  trade_permission: string;
  lot_version: string;
  projected_at: Date;
}>;

@Injectable()
export class PublicAuctionMarketService {
  constructor(private readonly prisma: PrismaService) {}

  async listLots() {
    return this.prisma.$transaction(async (tx) => {
      const clocks = await tx.$queryRaw<PublicMarketClockRow[]>(Prisma.sql`
        SELECT transaction_timestamp() AS observed_at
      `);
      const rows = await tx.$queryRaw<PublicMarketLotRow[]>(Prisma.sql`
        SELECT * FROM auction.list_public_market_lot_cards(${PUBLIC_MARKET_LIMIT})
      `);
      const clock = clocks[0];
      if (!(clock?.observed_at instanceof Date) || !Number.isFinite(clock.observed_at.getTime())) {
        throw invalidProjection('PUBLIC_MARKET_POSTGRESQL_CLOCK_UNAVAILABLE');
      }

      const items = rows.map((row) => parsePublicMarketLot(row, clock.observed_at));
      const version = rows.reduce((current, row) => {
        const candidate = parsePositiveBigInt(row.lot_version, 'lot_version');
        return candidate > current ? candidate : current;
      }, 0n);

      return Object.freeze({
        authority: Object.freeze({
          source: 'POSTGRESQL' as const,
          scope: 'PUBLIC_MARKET' as const,
          projection: 'ANONYMIZED_PUBLIC_MARKET' as const,
          sellerIdentity: 'REDACTED' as const,
          observedAt: clock.observed_at.toISOString(),
          version: version.toString(),
        }),
        items,
        pageInfo: Object.freeze({
          limit: PUBLIC_MARKET_LIMIT,
          returned: items.length,
          hasMore: items.length === PUBLIC_MARKET_LIMIT,
        }),
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 5_000,
    });
  }
}

function parsePublicMarketLot(row: PublicMarketLotRow, observedAt: Date) {
  if (
    !PUBLIC_REF.test(row.public_ref)
    || !boundedText(row.culture, 200)
    || (row.grade !== null && !boundedText(row.grade, 200))
    || !POSITIVE_DECIMAL.test(row.volume_tons)
    || Number(row.volume_tons) <= 0
    || !NON_NEGATIVE_INTEGER.test(row.start_price_kopecks_per_ton)
    || !boundedText(row.region, 500)
    || !(row.auction_ends_at instanceof Date)
    || !Number.isFinite(row.auction_ends_at.getTime())
    || row.auction_ends_at.getTime() <= observedAt.getTime()
    || row.status !== 'BIDDING'
    || row.verification_status !== 'DECLARED'
    || row.trade_permission !== 'PUBLIC_ALLOWED'
    || !POSITIVE_INTEGER.test(row.lot_version)
    || !(row.projected_at instanceof Date)
    || !Number.isFinite(row.projected_at.getTime())
  ) {
    throw invalidProjection('PUBLIC_MARKET_PROJECTION_INVALID');
  }

  return Object.freeze({
    publicRef: row.public_ref,
    culture: row.culture,
    grade: row.grade,
    volumeTons: normalizeDecimal(row.volume_tons),
    startPriceKopecksPerTon: row.start_price_kopecks_per_ton,
    region: row.region,
    auctionEndsAt: row.auction_ends_at.toISOString(),
    status: 'BIDDING' as const,
    verificationStatus: 'DECLARED' as const,
    tradePermission: 'PUBLIC_ALLOWED' as const,
    independentVerification: null,
    disclosureCode: 'SELLER_DECLARED_NOT_INDEPENDENTLY_VERIFIED' as const,
    version: row.lot_version,
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
