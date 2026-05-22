import { DealsService } from './deals.service';

function makeRuntime() {
  return {
    listDeals: jest.fn().mockReturnValue([{ id: 'D1', status: 'ACTIVE', sellerOrgId: 'S1', buyerOrgId: 'B1' }]),
    getDeal: jest.fn().mockReturnValue({ id: 'D1', status: 'ACTIVE', sellerOrgId: 'S1', buyerOrgId: 'B1' }),
    dealWorkspace: jest.fn().mockReturnValue({ sellerOrgId: 'S1', buyerOrgId: 'B1', completeness: { isComplete: false }, payment: { status: 'PENDING' }, blockers: [] }),
    dealPassport: jest.fn().mockReturnValue({}),
    dealTimeline: jest.fn().mockReturnValue([]),
    createDeal: jest.fn().mockReturnValue({ id: 'D2' }),
    transitionDeal: jest.fn().mockReturnValue({ id: 'D1', status: 'SIGNED' }),
  } as any;
}

function makeExecutor() {
  return {
    assertPermission: jest.fn(),
    assertObjectScope: jest.fn(),
    execute: jest.fn().mockResolvedValue({ result: { id: 'D1' }, auditId: 'A1' }),
  } as any;
}

const adminUser = { id: 'u1', role: 'ADMIN' as any, orgId: 'S1', email: 'admin@test.com' };

describe('DealsService', () => {
  describe('list()', () => {
    it('returns Prisma rows when DB has data', async () => {
      const prisma = {
        deal: { findMany: jest.fn().mockResolvedValue([{ id: 'DB-D1' }, { id: 'DB-D2' }]) },
      } as any;
      const svc = new DealsService(makeRuntime(), makeExecutor(), prisma);
      const result = await svc.list(adminUser);
      expect(result).toEqual([{ id: 'DB-D1' }, { id: 'DB-D2' }]);
      expect(prisma.deal.findMany).toHaveBeenCalledTimes(1);
    });

    it('falls back to runtime when Prisma returns empty', async () => {
      const runtime = makeRuntime();
      const prisma = {
        deal: { findMany: jest.fn().mockResolvedValue([]) },
      } as any;
      const svc = new DealsService(runtime, makeExecutor(), prisma);
      const result = await svc.list(adminUser);
      expect(runtime.listDeals).toHaveBeenCalledWith(adminUser);
      expect(result).toEqual([{ id: 'D1', status: 'ACTIVE', sellerOrgId: 'S1', buyerOrgId: 'B1' }]);
    });

    it('falls back to runtime when Prisma throws', async () => {
      const runtime = makeRuntime();
      const prisma = {
        deal: { findMany: jest.fn().mockRejectedValue(new Error('DB down')) },
      } as any;
      const svc = new DealsService(runtime, makeExecutor(), prisma);
      const result = await svc.list(adminUser);
      expect(runtime.listDeals).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
    });

    it('works without Prisma (no optional injection)', async () => {
      const runtime = makeRuntime();
      const svc = new DealsService(runtime, makeExecutor());
      const result = await svc.list(adminUser);
      expect(runtime.listDeals).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('getOne()', () => {
    it('returns Prisma row when found', async () => {
      const prisma = {
        deal: { findUnique: jest.fn().mockResolvedValue({ id: 'D1', sellerOrgId: 'S1', buyerOrgId: 'B1' }) },
      } as any;
      const svc = new DealsService(makeRuntime(), makeExecutor(), prisma);
      const result = await svc.getOne('D1', adminUser);
      expect(prisma.deal.findUnique).toHaveBeenCalledWith({ where: { id: 'D1' } });
      expect(result.id).toBe('D1');
    });

    it('falls back to runtime when Prisma findUnique returns null', async () => {
      const runtime = makeRuntime();
      const prisma = {
        deal: { findUnique: jest.fn().mockResolvedValue(null) },
      } as any;
      const svc = new DealsService(runtime, makeExecutor(), prisma);
      await svc.getOne('D1', adminUser);
      expect(runtime.getDeal).toHaveBeenCalledWith('D1');
    });
  });
});
