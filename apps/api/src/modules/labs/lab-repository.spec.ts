import { RuntimeLabRepository } from './runtime-lab.repository';
import { PrismaLabRepository } from './prisma-lab.repository';
import { selectLabRepository } from './lab-repository.factory';

function makeRuntime() {
  return {
    listSamples: jest.fn().mockReturnValue([{ id: 'LS-1' }]),
    getSample: jest.fn().mockReturnValue({ id: 'LS-1' }),
    createSample: jest.fn().mockReturnValue({ id: 'LS-2' }),
    collectSample: jest.fn().mockReturnValue({ id: 'LS-1', status: 'COLLECTED' }),
    recordTest: jest.fn().mockReturnValue({ id: 'LS-1', test: 'T1' }),
    finalizeSample: jest.fn().mockReturnValue({ id: 'LS-1', status: 'FINAL' }),
  } as any;
}

describe('RuntimeLabRepository (default adapter)', () => {
  it('delegates every read and write to RuntimeCore unchanged', async () => {
    const runtime = makeRuntime();
    const repo = new RuntimeLabRepository(runtime);
    const user = { id: 'u1' } as any;

    expect(await repo.list()).toEqual([{ id: 'LS-1' }]);
    expect(runtime.listSamples).toHaveBeenCalled();
    expect(await repo.getById('LS-1')).toEqual({ id: 'LS-1' });
    expect(runtime.getSample).toHaveBeenCalledWith('LS-1');
    expect(repo.create({}, user)).toEqual({ id: 'LS-2' });
    expect(repo.collect('LS-1', user)).toEqual({ id: 'LS-1', status: 'COLLECTED' });
    expect(repo.recordTest('LS-1', { protein: 12 }, user)).toEqual({ id: 'LS-1', test: 'T1' });
    expect(repo.finalize('LS-1', user)).toEqual({ id: 'LS-1', status: 'FINAL' });
    expect(runtime.finalizeSample).toHaveBeenCalledWith('LS-1', user);
  });
});

describe('PrismaLabRepository (disabled DB-backed skeleton)', () => {
  it('requires PrismaService — constructing without it fails loudly', () => {
    expect(() => new PrismaLabRepository(undefined)).toThrow(/PrismaService/);
  });

  it('supports list/getById read snapshots via Prisma when explicitly used', async () => {
    const prisma = {
      labSample: {
        findMany: jest.fn().mockResolvedValue([{ id: 'DB-LS1' }]),
        findUnique: jest.fn().mockResolvedValue({ id: 'DB-LS1' }),
      },
    } as any;
    const repo = new PrismaLabRepository(prisma);
    expect(await repo.list()).toEqual([{ id: 'DB-LS1' }]);
    expect(await repo.getById('DB-LS1')).toEqual({ id: 'DB-LS1' });
  });

  it('getById fails loudly when the row is missing — no silent fallback', async () => {
    const prisma = {
      labSample: { findMany: jest.fn(), findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    const repo = new PrismaLabRepository(prisma);
    await expect(repo.getById('X')).rejects.toThrow(/not found in DB-backed/);
  });

  it('does not support create/collect/recordTest/finalize (fails loudly)', () => {
    const prisma = { labSample: {} } as any;
    const repo = new PrismaLabRepository(prisma);
    expect(() => repo.create()).toThrow(/not supported/);
    expect(() => repo.collect()).toThrow(/not supported/);
    expect(() => repo.recordTest()).toThrow(/not supported/);
    expect(() => repo.finalize()).toThrow(/not supported/);
  });
});

describe('selectLabRepository (no silent Prisma activation)', () => {
  const runtime = makeRuntime();
  const prisma = { labSample: {} } as any;

  it('defaults to the runtime adapter when no flag is set', () => {
    expect(selectLabRepository(runtime, prisma, undefined)).toBeInstanceOf(RuntimeLabRepository);
  });

  it('keeps the runtime adapter for unrelated flag values', () => {
    expect(selectLabRepository(runtime, prisma, 'true')).toBeInstanceOf(RuntimeLabRepository);
  });

  it('selects the Prisma adapter only under the explicit prisma flag', () => {
    expect(selectLabRepository(runtime, prisma, 'prisma')).toBeInstanceOf(PrismaLabRepository);
  });
});
