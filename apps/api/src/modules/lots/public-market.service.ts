import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

type PublicMarketRow = Readonly<{
  lot_id: string;
  culture: string;
  grade: string | null;
  volume_tons: Prisma.Decimal;
  region: string;
  start_price_kopecks_per_ton: bigint;
  auction_ends_at: Date;
  verification_level: 'VERIFIED';
}>;

export type PublicMarketLot = Readonly<{
  lotId: string;
  culture: string;
  grade: string | null;
  volumeTons: string;
  region: string;
  startPriceKopecksPerTon: string;
  auctionEndsAt: string;
  verificationLevel: 'VERIFIED';
}>;

export type PublicMarketSnapshot = Readonly<{
  source: 'POSTGRESQL';
  visibility: 'ANONYMIZED';
  items: PublicMarketLot[];
}>;

@Injectable()
export class PublicMarketService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<PublicMarketSnapshot> {
    try {
      const rows = await this.prisma.$queryRaw<PublicMarketRow[]>(Prisma.sql`
        SELECT
          lot_id,
          culture,
          grade,
          volume_tons,
          region,
          start_price_kopecks_per_ton,
          auction_ends_at,
          verification_level
        FROM market.list_public_lots(12)
      `);

      return {
        source: 'POSTGRESQL',
        visibility: 'ANONYMIZED',
        items: rows.map((row) => ({
          lotId: row.lot_id,
          culture: row.culture,
          grade: row.grade,
          volumeTons: row.volume_tons.toString(),
          region: row.region,
          startPriceKopecksPerTon: row.start_price_kopecks_per_ton.toString(),
          auctionEndsAt: row.auction_ends_at.toISOString(),
          verificationLevel: row.verification_level,
        })),
      };
    } catch {
      throw new ServiceUnavailableException({
        code: 'PUBLIC_MARKET_UNAVAILABLE',
        message: 'Публичная витрина рынка временно недоступна.',
      });
    }
  }
}
