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

  it('workspace assembles a real aggregate with derived money/blockers from DB entities', async () => {
    const prisma = {
      deal: { findUnique: jest.fn().mockResolvedValue({ id: 'DB1', status: 'SIGNED', totalRub: 1000, owner: 'O', nextAction: 'N', slaAt: null }) },
      dealDocument: { findMany: jest.fn().mockResolvedValue([{ type: 'SDIZ', signedAt: null, bankRequired: true, bankAcceptance: 'PENDING' }]) },
      shipment: { findMany: jest.fn().mockResolvedValue([{ id: 'SH1', blockers: '["вес -1.2т"]' }]) },
      labSample: { findMany: jest.fn().mockResolvedValue([]) },
      payment: { findMany: jest.fn().mockResolvedValue([{ status: 'HELD', amountRub: 1000, holdAmountRub: 200 }]) },
      auditEvent: { findMany: jest.fn().mockResolvedValue([{ id: 'A1' }]) },
    } as any;
    const repo = new PrismaDealRepository(prisma);
    const ws = await repo.workspace('DB1');
    expect(ws.source).toBe('db');
    expect(ws.completeness).toEqual({ total: 1, signed: 0, bankRequired: 1, bankAccepted: 0, isComplete: false });
    expect(ws.blockers).toContain('Документ SDIZ не принят банком');
    expect(ws.blockers).toContain('Рейс SH1: вес -1.2т');
    expect(ws.blockers.some((b: string) => b.includes('Удержание'))).toBe(true);
    expect(ws.moneyImpact.holdAmountRub).toBe(200);
    expect(ws.timeline).toEqual({ dealId: 'DB1', events: [{ id: 'A1' }] });
  });

  it('passport returns a compact DB summary and 404s when the deal is missing', async () => {
    const prisma = {
      deal: { findUnique: jest.fn().mockResolvedValue({ id: 'DB1', status: 'SIGNED', sellerOrgId: 's', buyerOrgId: 'b', totalRub: 1000, currency: 'RUB' }) },
      dealDocument: { count: jest.fn().mockResolvedValue(3) },
      shipment: { count: jest.fn().mockResolvedValue(1) },
      payment: { findFirst: jest.fn().mockResolvedValue({ status: 'RESERVED', amountRub: 1000, holdAmountRub: 0 }) },
    } as any;
    const repo = new PrismaDealRepository(prisma);
    const passport = await repo.passport('DB1');
    expect(passport.counts).toEqual({ documents: 3, shipments: 1 });
    expect(passport.payment.status).toBe('RESERVED');
    expect(passport.source).toBe('db');

    const missing = { deal: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
    await expect(new PrismaDealRepository(missing).passport('X')).rejects.toThrow(/not found/);
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

  it('transition enforces the shared state machine and sets closedAt on CLOSED (compare-and-set)', async () => {
    const prisma = {
      deal: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'DB1', status: 'SETTLED', signedAt: null, closedAt: null })
          .mockResolvedValueOnce({ id: 'DB1', status: 'CLOSED' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;
    const repo = new PrismaDealRepository(prisma);
    const row = await repo.transition('DB1', 'CLOSED', { id: 'u1', orgId: 'org-1', role: 'ADMIN' } as any);
    expect(row.status).toBe('CLOSED');
    // compare-and-set: only writes when status is still the validated value
    expect(prisma.deal.updateMany.mock.calls[0][0].where).toEqual({ id: 'DB1', status: 'SETTLED' });
    expect(prisma.deal.updateMany.mock.calls[0][0].data.closedAt).toBeInstanceOf(Date);
  });

  it('transition is lost-update safe: a concurrent change yields a conflict, not an overwrite', async () => {
    const prisma = {
      deal: {
        findUnique: jest.fn().mockResolvedValue({ id: 'DB1', status: 'SETTLED', signedAt: null, closedAt: null }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }), // someone else already moved it
      },
    } as any;
    const repo = new PrismaDealRepository(prisma);
    await expect(repo.transition('DB1', 'CLOSED', { id: 'u1', orgId: 'org-1', role: 'ADMIN' } as any)).rejects.toThrow(/concurrently/);
  });

  it('transition rejects an illegal status jump (same legality as runtime)', async () => {
    const prisma = {
      deal: {
        findUnique: jest.fn().mockResolvedValue({ id: 'DB1', status: 'DRAFT', signedAt: null, closedAt: null }),
        updateMany: jest.fn(),
      },
    } as any;
    const repo = new PrismaDealRepository(prisma);
    await expect(repo.transition('DB1', 'SIGNED', { id: 'u1', orgId: 'org-1', role: 'ADMIN' } as any)).rejects.toThrow(/не разрешён/);
    expect(prisma.deal.updateMany).not.toHaveBeenCalled();
  });

  it('create retries id allocation on a duplicate-id collision under concurrency', async () => {
    let calls = 0;
    const prisma = {
      deal: {
        findMany: jest.fn().mockResolvedValue([{ id: 'DEAL-003' }]),
        create: jest.fn().mockImplementation(({ data }: any) => {
          calls += 1;
          if (calls === 1) return Promise.reject({ code: 'P2002' }); // lost the id race once
          return Promise.resolve(data);
        }),
      },
    } as any;
    const repo = new PrismaDealRepository(prisma);
    const row = await repo.create({ lotId: 'LOT-1', winnerBidId: 'BID-1' } as any, { id: 'u1', orgId: 'org-1', role: 'BUYER' } as any);
    expect(row.id).toBe('DEAL-004');
    expect(prisma.deal.create).toHaveBeenCalledTimes(2);
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
