import { RuntimeDocumentRepository } from './runtime-document.repository';
import { PrismaDocumentRepository } from './prisma-document.repository';
import { selectDocumentRepository } from './document-repository.factory';

function makeRuntime() {
  return {
    listDocuments: jest.fn().mockReturnValue([{ id: 'DOC-1' }]),
    getDocument: jest.fn().mockReturnValue({ id: 'DOC-1' }),
    uploadDocument: jest.fn().mockReturnValue({ id: 'DOC-2' }),
    signDocument: jest.fn().mockReturnValue({ id: 'DOC-1', status: 'SIGNED' }),
    generateDealPackage: jest.fn().mockReturnValue({ dealId: 'D1', package: 'ok' }),
  } as any;
}

describe('RuntimeDocumentRepository (default adapter)', () => {
  it('delegates every read and write to RuntimeCore unchanged', async () => {
    const runtime = makeRuntime();
    const repo = new RuntimeDocumentRepository(runtime);

    expect(await repo.list()).toEqual([{ id: 'DOC-1' }]);
    expect(runtime.listDocuments).toHaveBeenCalled();
    expect(await repo.getById('DOC-1')).toEqual({ id: 'DOC-1' });
    expect(runtime.getDocument).toHaveBeenCalledWith('DOC-1');
    expect(repo.upload({ name: 'f' }, { dealId: 'D1' }, { id: 'u1' })).toEqual({ id: 'DOC-2' });
    expect(runtime.uploadDocument).toHaveBeenCalledWith({ name: 'f' }, { dealId: 'D1' }, { id: 'u1' });
    expect(repo.sign('DOC-1', { id: 'u1' })).toEqual({ id: 'DOC-1', status: 'SIGNED' });
    expect(repo.generateDealPackage('D1', { id: 'u1' })).toEqual({ dealId: 'D1', package: 'ok' });
  });
});

describe('PrismaDocumentRepository (disabled DB-backed skeleton)', () => {
  it('requires PrismaService — constructing without it fails loudly', () => {
    expect(() => new PrismaDocumentRepository(undefined)).toThrow(/PrismaService/);
  });

  it('supports list/getById read snapshots via Prisma when explicitly used', async () => {
    const prisma = {
      dealDocument: {
        findMany: jest.fn().mockResolvedValue([{ id: 'DB-DOC1' }]),
        findUnique: jest.fn().mockResolvedValue({ id: 'DB-DOC1' }),
      },
    } as any;
    const repo = new PrismaDocumentRepository(prisma);
    expect(await repo.list()).toEqual([{ id: 'DB-DOC1' }]);
    expect(await repo.getById('DB-DOC1')).toEqual({ id: 'DB-DOC1' });
  });

  it('getById fails loudly when the row is missing — no silent fallback', async () => {
    const prisma = {
      dealDocument: { findMany: jest.fn(), findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    const repo = new PrismaDocumentRepository(prisma);
    await expect(repo.getById('X')).rejects.toThrow(/not found in DB-backed/);
  });

  it('does not support upload/sign/generateDealPackage (fails loudly)', () => {
    const prisma = { dealDocument: {} } as any;
    const repo = new PrismaDocumentRepository(prisma);
    expect(() => repo.upload()).toThrow(/not supported/);
    expect(() => repo.sign()).toThrow(/not supported/);
    expect(() => repo.generateDealPackage()).toThrow(/not supported/);
  });
});

describe('selectDocumentRepository (no silent Prisma activation)', () => {
  const runtime = makeRuntime();
  const prisma = { dealDocument: {} } as any;

  it('defaults to the runtime adapter when no flag is set', () => {
    expect(selectDocumentRepository(runtime, prisma, undefined)).toBeInstanceOf(RuntimeDocumentRepository);
  });

  it('keeps the runtime adapter for unrelated flag values', () => {
    expect(selectDocumentRepository(runtime, prisma, 'true')).toBeInstanceOf(RuntimeDocumentRepository);
  });

  it('selects the Prisma adapter only under the explicit prisma flag', () => {
    expect(selectDocumentRepository(runtime, prisma, 'prisma')).toBeInstanceOf(PrismaDocumentRepository);
  });
});
