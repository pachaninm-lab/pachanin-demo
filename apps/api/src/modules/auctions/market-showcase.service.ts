import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 25;

type OpenLotRow = Readonly<{
  lot_id: string;
  culture: string;
  grade: string | null;
  volume_tons: Prisma.Decimal | string;
  region: string;
  start_price_kopecks_per_ton: bigint;
  step_price_kopecks_per_ton: bigint;
  auction_ends_at: Date;
  source_type: string;
  bid_count: bigint;
  best_price_kopecks_per_ton: bigint | null;
  created_at: Date;
}>;

export type MarketOpenLot = Readonly<{
  lotId: string;
  culture: string;
  grade: string | null;
  volumeTons: string;
  region: string;
  startPriceKopecksPerTon: string;
  stepPriceKopecksPerTon: string;
  auctionEndsAt: string;
  sourceType: string;
  bidCount: number;
  bestPriceKopecksPerTon: string | null;
  publishedAt: string;
}>;

export type MarketOpenLotsPage = Readonly<{
  items: readonly MarketOpenLot[];
  nextCursor: string | null;
  serverTime: string;
  disclosure: string;
}>;

/**
 * Обезличенная витрина открытых лотов (CANONICAL_SCENARIO.md §1).
 *
 * Видимость и состав колонок обеспечиваются SQL-функцией
 * market.list_open_lots: наименование продавца, адрес и контакты в витрину
 * не попадают, чтобы исключить сделку в обход платформы. Деанонимизация —
 * только после создания сделки и на исполнении.
 */
@Injectable()
export class MarketShowcaseService {
  constructor(private readonly prisma: PrismaService) {}

  async listOpenLots(limitInput?: string, cursorInput?: string): Promise<MarketOpenLotsPage> {
    const limit = normalizeLimit(limitInput);
    const cursor = normalizeCursor(cursorInput);

    const rows = await this.prisma.$queryRaw<OpenLotRow[]>(Prisma.sql`
      SELECT * FROM market.list_open_lots(${limit}::int, ${cursor}::timestamptz)
    `);

    const items = rows.map(mapRow);
    return {
      items,
      nextCursor: rows.length === limit ? rows[rows.length - 1].created_at.toISOString() : null,
      serverTime: new Date().toISOString(),
      disclosure:
        'Продавец, адрес и контакты раскрываются только после создания сделки из итога торгов.',
    };
  }
}

function mapRow(row: OpenLotRow): MarketOpenLot {
  return {
    lotId: row.lot_id,
    culture: row.culture,
    grade: row.grade,
    volumeTons: String(row.volume_tons),
    region: row.region,
    startPriceKopecksPerTon: row.start_price_kopecks_per_ton.toString(),
    stepPriceKopecksPerTon: row.step_price_kopecks_per_ton.toString(),
    auctionEndsAt: row.auction_ends_at.toISOString(),
    sourceType: row.source_type,
    bidCount: Number(row.bid_count),
    bestPriceKopecksPerTon: row.best_price_kopecks_per_ton?.toString() ?? null,
    publishedAt: row.created_at.toISOString(),
  };
}

function normalizeLimit(value: string | undefined): number {
  if (value === undefined || value === '') return DEFAULT_LIMIT;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
    throw new BadRequestException({
      code: 'MARKET_LIMIT_INVALID',
      message: `limit должен быть целым числом от 1 до ${MAX_LIMIT}.`,
    });
  }
  return parsed;
}

function normalizeCursor(value: string | undefined): Date | null {
  if (value === undefined || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException({
      code: 'MARKET_CURSOR_INVALID',
      message: 'cursor должен быть меткой времени ISO 8601.',
    });
  }
  return parsed;
}
