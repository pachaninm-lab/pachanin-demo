import { RuntimePaymentRepository } from './runtime-payment.repository';
import { PrismaPaymentRepository } from './prisma-payment.repository';
import { selectPaymentRepository } from './payment-repository.factory';

function makeRuntime() {
  return {
    listPayments: jest.fn().mockReturnValue([{ id: 'P1' }]),
    paymentDetail: jest.fn().mockReturnValue({ id: 'P1' }),
    worksheet: jest.fn().mockReturnValue({ payment: { amountRub: 1000 } }),
    bankWorkspace: jest.fn().mockReturnValue({ beneficiaries: [] }),
  } as any;
}

describe('RuntimePaymentRepository (default adapter)', () => {
  it('delegates every read to RuntimeCore unchanged', async () => {
    const runtime = makeRuntime();
    const repo = new RuntimePaymentRepository(runtime);

    expect(await repo.list()).toEqual([{ id: 'P1' }]);
    expect(runtime.listPayments).toHaveBeenCalled();
    expect(await repo.detail('P1')).toEqual({ id: 'P1' });
    expect(runtime.paymentDetail).toHaveBeenCalledWith('P1');
    expect(repo.worksheet('D1')).toEqual({ payment: { amountRub: 1000 } });
    expect(runtime.worksheet).toHaveBeenCalledWith('D1');
    expect(repo.bankWorkspace('D1')).toEqual({ beneficiaries: [] });
  });
});

describe('PrismaPaymentRepository (disabled DB-backed read skeleton)', () => {
  it('requires PrismaService — constructing without it fails loudly', () => {
    expect(() => new PrismaPaymentRepository(undefined)).toThrow(/PrismaService/);
  });

  it('supports list/detail read snapshots via Prisma when explicitly used', async () => {
    const prisma = {
      payment: {
        findMany: jest.fn().mockResolvedValue([{ id: 'DB1' }]),
        findUnique: jest.fn().mockResolvedValue({ id: 'DB1' }),
      },
    } as any;
    const repo = new PrismaPaymentRepository(prisma);
    expect(await repo.list()).toEqual([{ id: 'DB1' }]);
    expect(await repo.detail('DB1')).toEqual({ id: 'DB1' });
  });

  it('detail fails loudly when the row is missing — no silent fallback', async () => {
    const prisma = {
      payment: { findMany: jest.fn(), findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    const repo = new PrismaPaymentRepository(prisma);
    await expect(repo.detail('X')).rejects.toThrow(/not found in DB-backed/);
  });

  it('does not support worksheet/bankWorkspace (fails loudly)', () => {
    const prisma = { payment: {} } as any;
    const repo = new PrismaPaymentRepository(prisma);
    expect(() => repo.worksheet()).toThrow(/not supported/);
    expect(() => repo.bankWorkspace()).toThrow(/not supported/);
  });
});

describe('selectPaymentRepository (no silent Prisma activation)', () => {
  const runtime = makeRuntime();
  const prisma = { payment: {} } as any;

  it('defaults to the runtime adapter when no flag is set', () => {
    expect(selectPaymentRepository(runtime, prisma, undefined)).toBeInstanceOf(RuntimePaymentRepository);
  });

  it('keeps the runtime adapter for unrelated flag values', () => {
    expect(selectPaymentRepository(runtime, prisma, 'true')).toBeInstanceOf(RuntimePaymentRepository);
  });

  it('selects the Prisma adapter only under the explicit prisma flag', () => {
    expect(selectPaymentRepository(runtime, prisma, 'prisma')).toBeInstanceOf(PrismaPaymentRepository);
  });
});
