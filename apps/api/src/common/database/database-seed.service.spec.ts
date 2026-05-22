import { DatabaseSeedService } from './database-seed.service';

function makePrisma(counts: { deal?: number; shipment?: number; dealDocument?: number; labSample?: number } = {}) {
  return {
    deal: {
      count: jest.fn().mockResolvedValue(counts.deal ?? 0),
      upsert: jest.fn().mockResolvedValue({}),
    },
    shipment: {
      count: jest.fn().mockResolvedValue(counts.shipment ?? 0),
      upsert: jest.fn().mockResolvedValue({}),
    },
    dealDocument: {
      count: jest.fn().mockResolvedValue(counts.dealDocument ?? 0),
      upsert: jest.fn().mockResolvedValue({}),
    },
    labSample: {
      count: jest.fn().mockResolvedValue(counts.labSample ?? 0),
      upsert: jest.fn().mockResolvedValue({}),
    },
  } as any;
}

function makeRuntime(overrides: Partial<{ deals: any[]; shipments: any[]; docs: any[]; samples: any[] }> = {}) {
  return {
    listDeals: jest.fn().mockReturnValue(overrides.deals ?? [
      { id: 'D1', lotId: 'L1', status: 'ACTIVE', sellerOrgId: 'S1', buyerOrgId: 'B1', volumeTons: 100, pricePerTon: 10000, totalRub: 1000000, currency: 'RUB', culture: 'wheat', region: 'Moscow', fundingChoice: 'ESCROW', owner: 'user1', nextAction: 'sign', signedAt: null, paymentTerms: null },
    ]),
    listShipments: jest.fn().mockReturnValue(overrides.shipments ?? [
      { id: 'SH1', dealId: 'D1', status: 'IN_TRANSIT', driverUserId: 'u1', driverName: 'Ivan', vehicleNumber: 'A123BC', carrierOrgId: 'C1', carrierName: 'CarrierCo', routeFrom: 'Moscow', routeTo: 'SPb', etaHours: 12, loadedTons: 95, pinVerified: true, nextAction: null, blockers: null },
    ]),
    listDocuments: jest.fn().mockReturnValue(overrides.docs ?? [
      { id: 'DOC1', dealId: 'D1', type: 'CONTRACT', status: 'SIGNED', name: 'contract.pdf', mimeType: 'application/pdf', uploadedByUserId: 'u1', signedAt: '2024-01-01', bankRequired: true, releaseRequired: true, bankAcceptance: 'ACCEPTED', version: 1 },
    ]),
    listSamples: jest.fn().mockReturnValue(overrides.samples ?? [
      { id: 'S1', dealId: 'D1', shipmentId: 'SH1', status: 'FINALIZED', culture: 'wheat', protocol: 'GOST123', labId: 'LAB1', collectedAt: '2024-01-02', finalizedAt: '2024-01-03', moneyDeltaRub: -5000, tests: [] },
    ]),
  } as any;
}

describe('DatabaseSeedService', () => {
  it('seeds all tables when empty', async () => {
    const prisma = makePrisma();
    const runtime = makeRuntime();
    const svc = new DatabaseSeedService(prisma, runtime);
    await svc.onApplicationBootstrap();

    expect(prisma.deal.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.shipment.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.dealDocument.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.labSample.upsert).toHaveBeenCalledTimes(1);
  });

  it('skips seeding when tables already have data', async () => {
    const prisma = makePrisma({ deal: 3, shipment: 2, dealDocument: 1, labSample: 1 });
    const runtime = makeRuntime();
    const svc = new DatabaseSeedService(prisma, runtime);
    await svc.onApplicationBootstrap();

    expect(prisma.deal.upsert).not.toHaveBeenCalled();
    expect(prisma.shipment.upsert).not.toHaveBeenCalled();
  });

  it('seeds only empty tables when some are partially populated', async () => {
    const prisma = makePrisma({ deal: 5, shipment: 0, dealDocument: 0, labSample: 0 });
    const runtime = makeRuntime();
    const svc = new DatabaseSeedService(prisma, runtime);
    await svc.onApplicationBootstrap();

    expect(prisma.deal.upsert).not.toHaveBeenCalled();
    expect(prisma.shipment.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.dealDocument.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.labSample.upsert).toHaveBeenCalledTimes(1);
  });

  it('does not throw when runtime returns empty arrays', async () => {
    const prisma = makePrisma();
    const runtime = makeRuntime({ deals: [], shipments: [], docs: [], samples: [] });
    const svc = new DatabaseSeedService(prisma, runtime);
    await expect(svc.onApplicationBootstrap()).resolves.not.toThrow();
    expect(prisma.deal.upsert).not.toHaveBeenCalled();
  });

  it('survives Prisma errors without throwing (caught internally)', async () => {
    const prisma = {
      deal: { count: jest.fn().mockRejectedValue(new Error('DB down')), upsert: jest.fn() },
      shipment: { count: jest.fn().mockResolvedValue(0), upsert: jest.fn().mockResolvedValue({}) },
      dealDocument: { count: jest.fn().mockResolvedValue(0), upsert: jest.fn().mockResolvedValue({}) },
      labSample: { count: jest.fn().mockResolvedValue(0), upsert: jest.fn().mockResolvedValue({}) },
    } as any;
    const runtime = makeRuntime();
    const svc = new DatabaseSeedService(prisma, runtime);
    // The onApplicationBootstrap wraps everything in try/catch and logs a warning
    await expect(svc.onApplicationBootstrap()).resolves.not.toThrow();
  });
});
