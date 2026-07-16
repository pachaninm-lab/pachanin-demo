import { BadRequestException } from '@nestjs/common';
import { MarketShowcaseService } from './market-showcase.service';

describe('MarketShowcaseService', () => {
  const row = {
    lot_id: 'lot-1',
    culture: 'wheat',
    grade: '3',
    volume_tons: '500',
    region: 'Тамбовская область',
    start_price_kopecks_per_ton: 1380000n,
    step_price_kopecks_per_ton: 5000n,
    auction_ends_at: new Date('2026-07-16T12:00:00Z'),
    source_type: 'FGIS',
    bid_count: 2n,
    best_price_kopecks_per_ton: 1390000n,
    created_at: new Date('2026-07-16T11:00:00Z'),
  };

  function makeService(rows: unknown[] = [row]) {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue(rows) };
    return { service: new MarketShowcaseService(prisma as never), prisma };
  }

  it('maps SQL rows to the anonymized contract without seller fields', async () => {
    const { service } = makeService();
    const page = await service.listOpenLots();

    expect(page.items).toHaveLength(1);
    const item = page.items[0];
    expect(item).toEqual({
      lotId: 'lot-1',
      culture: 'wheat',
      grade: '3',
      volumeTons: '500',
      region: 'Тамбовская область',
      startPriceKopecksPerTon: '1380000',
      stepPriceKopecksPerTon: '5000',
      auctionEndsAt: '2026-07-16T12:00:00.000Z',
      sourceType: 'FGIS',
      bidCount: 2,
      bestPriceKopecksPerTon: '1390000',
      publishedAt: '2026-07-16T11:00:00.000Z',
    });
    // Контракт анонимности: ни продавца, ни адреса, ни контактов в ответе.
    const serialized = JSON.stringify(page);
    for (const forbidden of ['seller', 'address', 'contact', 'org_id', 'orgId', 'tenant']) {
      expect(serialized.toLowerCase()).not.toContain(forbidden);
    }
    expect(page.disclosure).toContain('раскрываются только после создания сделки');
  });

  it('returns nextCursor only when the page is full', async () => {
    const { service } = makeService([row]);
    const partial = await service.listOpenLots('2');
    expect(partial.nextCursor).toBeNull();

    const { service: fullService } = makeService([row, { ...row, lot_id: 'lot-2' }]);
    const full = await fullService.listOpenLots('2');
    expect(full.nextCursor).toBe('2026-07-16T11:00:00.000Z');
  });

  it('rejects invalid limit and cursor before touching the database', async () => {
    const { service, prisma } = makeService();
    await expect(service.listOpenLots('0')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listOpenLots('51')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listOpenLots('abc')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listOpenLots('10', 'не-дата')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
