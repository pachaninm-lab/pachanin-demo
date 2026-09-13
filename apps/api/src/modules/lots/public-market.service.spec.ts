import { ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../common/prisma/prisma.service';
import { PublicMarketService } from './public-market.service';

describe('PublicMarketService', () => {
  it('returns only the bounded anonymized projection with JSON-safe numeric values', async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      {
        lot_id: 'lot-public-1',
        culture: 'Пшеница',
        grade: '3 класс',
        volume_tons: new Prisma.Decimal('240.500000'),
        region: 'Тамбовская область',
        start_price_kopecks_per_ton: 1850000n,
        auction_ends_at: new Date('2026-09-15T12:00:00.000Z'),
        verification_level: 'VERIFIED',
      },
    ]);
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    const service = new PublicMarketService(prisma);

    const result = await service.list();

    expect(result).toEqual({
      source: 'POSTGRESQL',
      visibility: 'ANONYMIZED',
      items: [
        {
          lotId: 'lot-public-1',
          culture: 'Пшеница',
          grade: '3 класс',
          volumeTons: '240.5',
          region: 'Тамбовская область',
          startPriceKopecksPerTon: '1850000',
          auctionEndsAt: '2026-09-15T12:00:00.000Z',
          verificationLevel: 'VERIFIED',
        },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(/seller|tenant|address|contact|certificate|externalId/i);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the PostgreSQL projection is unavailable', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('database unavailable')),
    } as unknown as PrismaService;
    const service = new PublicMarketService(prisma);

    await expect(service.list()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
