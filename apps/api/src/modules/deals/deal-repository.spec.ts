import { RuntimeDealRepository } from './runtime-deal.repository';
import { PrismaDealRepository } from './prisma-deal.repository';
import { selectDealRepository } from './deal-repository.factory';

function makeRuntime() {
  return {
    listDeals: jest.fn().mockReturnValue([{ id: 'D1' }]),
    getDeal: jest.fn().mockReturnValue({ id: 'D1' }),
    dealWorkspace: jest.fn().mockReturnValue({ id: 'WS' }),
    dealPassport: jest.fn().mockReturnValue({ id: 'PP' }),
    dealTimeline: jest.fn().mockReturnValue([{ id: 'T1' }]),
    createDeal: jest.fn().mockReturnValue({ id: 'D2' }),
    transitionDeal: jest.fn().mockReturnValue({ id: 'D1', status: 'SIGNED' }),
  } as any;
}

describe('RuntimeDealRepository (default adapter)', () => {
  it('delegates every read and write to RuntimeCore unchanged', async () => {
    const runtime = makeRuntime();
    const repo = new RuntimeDealRepository(runtime);
    const user = { id: 'u1' } as any;

    expect(await repo.list(user)).toEqual([{ id: 'D1' }]);
    expect(runtime.listDeals).toHaveBeenCalledWith(user);
    expect(await repo.getById('D1')).toEqual({ id: 'D1' });
    expect(runtime.getDeal).toHaveBeenCalledWith('D1');
    expect(repo.workspace('D1')).toEqual({ id: 'WS' });
    expect(repo.passport('D1')).toEqual({ id: 'PP' });
    expect(repo.timeline('D1')).toEqual([{ id: 'T1' }]);
    expect(repo.create({} as any, user)).toEqual({ id: 'D2' });
    expect(repo.transition('D1', 'SETTLED', user, 'note')).toEqual({ id: 'D1', status: 'SIGNED' });
    expect(runtime.transitionDeal).toHaveBeenCalledWith('D1', 'SETTLED', user, 'note');
  });
});

describe('PrismaDealRepository (disabled DB-backed skeleton)', () => {
  it('requires PrismaService — constructing without it fails loudly', () => {
    expect(() => new PrismaDealRepository(undefined)).toThrow(/PrismaService/);
  });

  it('supports read snapshots (list/getById) via Prisma when explicitly used', async () => {
    const prisma = {
      deal: {
        findMany: jest.fn().mockResolvedValue([{ id: 'DB1' }]),
        findUnique: jest.fn().mockResolvedValue({ id: 'DB1' }),
      },
    } as any;
    const repo = new PrismaDealRepository(prisma);
    expect(await repo.list()).toEqual([{ id: 'DB1' }]);
    expect(prisma.deal.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
    expect(await repo.getById('DB1')).toEqual({ id: 'DB1' });
  });

  it('getById fails loudly when the row is missing — no silent fallback', async () => {
    const prisma = {
      deal: { findMany: jest.fn(), findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    const repo = new PrismaDealRepository(prisma);
    await expect(repo.getById('X')).rejects.toThrow(/not found/);
  });

  it('workspace/passport still fail loudly (served by the runtime view-model adapter)', () => {
    const prisma = { deal: {} } as any;
    const repo = new PrismaDealRepository(prisma);
    expect(() => repo.workspace()).toThrow(/not supported/);
    expect(() => repo.passport()).toThrow(/not supported/);
  });

  it('create persists a DRAFT deal with a sequential id derived from existing rows', async () => {
    const created: any[] = [];
    const prisma = {
      deal: {
        findMany: jest.fn().mockResolvedValue([{ id: 'DEAL-003' }]),
        create: jest.fn().mockImplementation(({ data }: any) => {
          created.push(data);
          return Promise.resolve(data);
        }),
      },
    } as any;
    const repo = new PrismaDealRepository(prisma);
    const row = await repo.create({ lotId: 'LOT-1', winnerBidId: 'BID-1' } as any, { id: 'u1', orgId: 'org-1', role: 'BUYER' } as any);
    expect(row.id).toBe('DEAL-004');
    expect(row.status).toBe('DRAFT');
    expect(row.sellerOrgId).toBe('org-1');
    expect(prisma.deal.create).toHaveBeenCalledTimes(1);
  });

  it('transition enforces the shared state machine and sets closedAt on CLOSED', async () => {
    const prisma = {
      deal: {
        findUnique: jest.fn().mockResolvedValue({ id: 'DB1', status: 'SETTLED', signedAt: null, closedAt: null }),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'DB1', ...data })),
      },
    } as any;
    const repo = new PrismaDealRepository(prisma);
    const row = await repo.transition('DB1', 'CLOSED', { id: 'u1', orgId: 'org-1', role: 'ADMIN' } as any);
    expect(row.status).toBe('CLOSED');
    expect(prisma.deal.update.mock.calls[0][0].data.closedAt).toBeInstanceOf(Date);
  });

  it('transition rejects an illegal status jump (same legality as runtime)', async () => {
    const prisma = {
      deal: {
        findUnique: jest.fn().mockResolvedValue({ id: 'DB1', status: 'DRAFT', signedAt: null, closedAt: null }),
        update: jest.fn(),
      },
    } as any;
    const repo = new PrismaDealRepository(prisma);
    await expect(repo.transition('DB1', 'SIGNED', { id: 'u1', orgId: 'org-1', role: 'ADMIN' } as any)).rejects.toThrow(/не разрешён/);
    expect(prisma.deal.update).not.toHaveBeenCalled();
  });

  it('timeline reads audit events for the deal from the database', async () => {
    const prisma = {
      deal: {},
      auditEvent: { findMany: jest.fn().mockResolvedValue([{ id: 'A1', action: 'deal.transition' }]) },
    } as any;
    const repo = new PrismaDealRepository(prisma);
    const result = await repo.timeline('DB1');
    expect(result).toEqual({ dealId: 'DB1', events: [{ id: 'A1', action: 'deal.transition' }] });
    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith({ where: { dealId: 'DB1' }, orderBy: { createdAt: 'desc' } });
  });
});

describe('selectDealRepository (no silent Prisma activation)', () => {
  const runtime = makeRuntime();
  const prisma = { deal: {} } as any;

  it('defaults to the runtime adapter when no flag is set', () => {
    expect(selectDealRepository(runtime, prisma, undefined)).toBeInstanceOf(RuntimeDealRepository);
  });

  it('keeps the runtime adapter for unrelated flag values', () => {
    expect(selectDealRepository(runtime, prisma, 'true')).toBeInstanceOf(RuntimeDealRepository);
    expect(selectDealRepository(runtime, prisma, '1')).toBeInstanceOf(RuntimeDealRepository);
  });

  it('selects the Prisma adapter only under the explicit prisma flag', () => {
    expect(selectDealRepository(runtime, prisma, 'prisma')).toBeInstanceOf(PrismaDealRepository);
  });
});
