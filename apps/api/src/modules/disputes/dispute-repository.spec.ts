import { RuntimeDisputeRepository } from './runtime-dispute.repository';
import { PrismaDisputeRepository } from './prisma-dispute.repository';
import { selectDisputeRepository } from './dispute-repository.factory';
import type { Dispute } from './disputes.service';

function sampleDispute(id: string): Dispute {
  return {
    id,
    dealId: 'DEAL-X',
    status: 'OPEN',
    type: 'quality',
    description: 'test',
    initiatorOrgId: 'org-x',
    createdAt: new Date().toISOString(),
    evidence: [],
  };
}

describe('RuntimeDisputeRepository (default adapter)', () => {
  it('lists the seeded disputes and returns live references for mutation', async () => {
    const repo = new RuntimeDisputeRepository();

    const all = await repo.list();
    expect(all).toHaveLength(2);
    expect(all.map((d) => d.id).sort()).toEqual(['DISPUTE-001', 'DISPUTE-002']);

    const live = repo.getById('DISPUTE-001');
    expect(live).toBeDefined();
    // getById returns the live store object — in-place mutation persists.
    live!.status = 'RESOLVED';
    expect(repo.getById('DISPUTE-001')!.status).toBe('RESOLVED');
  });

  it('add() appends a new dispute to the store', async () => {
    const repo = new RuntimeDisputeRepository();
    repo.add(sampleDispute('DISPUTE-999'));
    expect(repo.getById('DISPUTE-999')).toBeDefined();
    expect(await repo.list()).toHaveLength(3);
  });

  it('getById returns undefined for an unknown id (no throw)', () => {
    const repo = new RuntimeDisputeRepository();
    expect(repo.getById('NOPE')).toBeUndefined();
  });
});

describe('PrismaDisputeRepository (disabled DB-backed skeleton)', () => {
  it('requires PrismaService — constructing without it fails loudly', () => {
    expect(() => new PrismaDisputeRepository(undefined)).toThrow(/PrismaService/);
  });

  it('supports the list read snapshot via Prisma when explicitly used', async () => {
    const prisma = {
      dispute: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'DB-D1',
            dealId: 'DEAL-1',
            status: 'OPEN',
            type: 'quality',
            description: 'db',
            initiatorOrgId: 'org-1',
            createdAt: new Date('2026-01-01T00:00:00Z'),
            evidence: [],
            moneyHold: null,
          },
        ]),
      },
    } as any;
    const repo = new PrismaDisputeRepository(prisma);
    const rows = await repo.list();
    expect(prisma.dispute.findMany).toHaveBeenCalledWith({
      include: { evidence: true, moneyHold: true },
      orderBy: { createdAt: 'desc' },
    });
    expect(rows[0].id).toBe('DB-D1');
  });

  it('does not support getById/add — money-bearing mutation path stays off (fails loudly)', () => {
    const prisma = { dispute: {} } as any;
    const repo = new PrismaDisputeRepository(prisma);
    expect(() => repo.getById()).toThrow(/not supported/);
    expect(() => repo.add()).toThrow(/not supported/);
  });
});

describe('selectDisputeRepository (no silent Prisma activation)', () => {
  const runtime = new RuntimeDisputeRepository();
  const prisma = { dispute: {} } as any;

  it('defaults to the runtime adapter when no flag is set', () => {
    expect(selectDisputeRepository(runtime, prisma, undefined)).toBeInstanceOf(RuntimeDisputeRepository);
  });

  it('keeps the runtime adapter for unrelated flag values', () => {
    expect(selectDisputeRepository(runtime, prisma, 'true')).toBeInstanceOf(RuntimeDisputeRepository);
  });

  it('selects the Prisma adapter only under the explicit prisma flag', () => {
    expect(selectDisputeRepository(runtime, prisma, 'prisma')).toBeInstanceOf(PrismaDisputeRepository);
  });
});
