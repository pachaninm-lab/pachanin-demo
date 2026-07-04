import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaDealRepository } from './prisma-deal.repository';
import type { RequestUser } from '../../common/types/request-user';

const user: RequestUser = {
  id: 'user-1',
  orgId: 'org-1',
  role: 'SUPPORT_MANAGER',
  email: 'operator@example.com',
};

type TxMock = {
  deal: { findUnique: jest.Mock; updateMany: jest.Mock };
  dealEvent: { findFirst: jest.Mock; create: jest.Mock };
};

function makePrisma(overrides?: Partial<{ deal: any; updateCount: number; prevHash: string | null }>) {
  const deal = overrides && 'deal' in overrides ? overrides.deal : { id: 'DL-1', status: 'SIGNED', version: 3, tenantId: 't-1' };
  const tx: TxMock = {
    deal: {
      findUnique: jest
        .fn()
        // первый вызов — чтение под транзакцией; второй — возврат обновлённой сделки
        .mockResolvedValueOnce(deal)
        .mockResolvedValue(deal ? { ...deal, status: 'PREPAYMENT_RESERVED', version: deal.version + 1 } : null),
      updateMany: jest.fn().mockResolvedValue({ count: overrides?.updateCount ?? 1 }),
    },
    dealEvent: {
      findFirst: jest.fn().mockResolvedValue(
        overrides?.prevHash === undefined ? { hash: 'prev-hash' } : overrides.prevHash ? { hash: overrides.prevHash } : null,
      ),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (tx: TxMock) => Promise<unknown>) => fn(tx)),
  } as any;
  return { prisma, tx };
}

describe('PrismaDealRepository.transition — оптимистическая блокировка', () => {
  it('легальный переход: version в WHERE и инкремент, событие в hash-цепочку', async () => {
    const { prisma, tx } = makePrisma();
    const repo = new PrismaDealRepository(prisma);

    const result = await repo.transition('DL-1', 'PREPAYMENT_RESERVED', user, 'резерв подтверждён');

    expect(tx.deal.updateMany).toHaveBeenCalledWith({
      where: { id: 'DL-1', status: 'SIGNED', version: 3 },
      data: { status: 'PREPAYMENT_RESERVED', version: { increment: 1 } },
    });
    const event = tx.dealEvent.create.mock.calls[0][0].data;
    expect(event.eventType).toBe('DEAL_STATUS_CHANGED');
    expect(event.prevHash).toBe('prev-hash');
    expect(event.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(event.payload).toMatchObject({ from: 'SIGNED', to: 'PREPAYMENT_RESERVED', version: 4 });
    expect(result).toMatchObject({ status: 'PREPAYMENT_RESERVED', version: 4 });
  });

  it('гонка двух операторов: 0 затронутых строк → 409, событие не пишется', async () => {
    const { prisma, tx } = makePrisma({ updateCount: 0 });
    const repo = new PrismaDealRepository(prisma);

    await expect(repo.transition('DL-1', 'PREPAYMENT_RESERVED', user)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.dealEvent.create).not.toHaveBeenCalled();
  });

  it('нелегальный переход отклоняется state machine до записи', async () => {
    const { prisma, tx } = makePrisma();
    const repo = new PrismaDealRepository(prisma);

    await expect(repo.transition('DL-1', 'CLOSED', user)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.deal.updateMany).not.toHaveBeenCalled();
  });

  it('несуществующая сделка → 404', async () => {
    const { prisma } = makePrisma({ deal: null });
    const repo = new PrismaDealRepository(prisma);

    await expect(repo.transition('DL-404', 'SIGNED', user)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('первое событие в цепочке: prevHash = null', async () => {
    const { prisma, tx } = makePrisma({ prevHash: null });
    const repo = new PrismaDealRepository(prisma);

    await repo.transition('DL-1', 'PREPAYMENT_RESERVED', user);
    expect(tx.dealEvent.create.mock.calls[0][0].data.prevHash).toBeNull();
  });
});
