import { DealRegistryQueryService } from '../../src/modules/deals/deal-registry-query.service';
import {
  createRememberedInstance,
  destroyInstance,
  INDUSTRIAL_TENANT,
  provisionDeal,
  type ServiceInstance,
} from './harness';

jest.setTimeout(180_000);

async function seedRegistryDeal(
  instance: ServiceInstance,
  input: Readonly<{
    id: string;
    userId: string;
    organizationId: string;
    sellerOrgId: string;
    buyerOrgId: string;
    tenantId?: string;
    status: string;
    nextAction: string | null;
    slaAt: Date | null;
    updatedAt: Date;
    totalKopecks: bigint;
    withParticipant?: boolean;
  }>,
): Promise<void> {
  const tenantId = input.tenantId ?? INDUSTRIAL_TENANT;
  await instance.prisma.deal.create({
    data: {
      id: input.id,
      dealNumber: `ТП-REG-${input.id}`,
      tenantId,
      sellerOrgId: input.sellerOrgId,
      buyerOrgId: input.buyerOrgId,
      status: input.status,
      culture: 'Пшеница',
      cropClass: '3',
      region: 'Тамбовская область',
      volumeTons: 100,
      totalKopecks: input.totalKopecks,
      currency: 'RUB',
      nextAction: input.nextAction,
      slaAt: input.slaAt,
      updatedAt: input.updatedAt,
    },
  });
  if (input.withParticipant === false) return;
  await instance.prisma.dealParticipant.create({
    data: {
      id: `participant:${input.id}:${input.userId}`,
      dealId: input.id,
      tenantId,
      organizationId: input.organizationId,
      userId: input.userId,
      role: 'BUYER',
      accessLevel: 'WORK',
      status: 'ACTIVE',
    },
  });
}

describe('Deal registry PostgreSQL keyset read model', () => {
  const previousSecret = process.env.DEAL_REGISTRY_CURSOR_SECRET;

  beforeAll(() => {
    process.env.DEAL_REGISTRY_CURSOR_SECRET = 'industrial-registry-cursor-secret-at-least-32-bytes';
  });

  afterAll(() => {
    if (previousSecret === undefined) delete process.env.DEAL_REGISTRY_CURSOR_SECRET;
    else process.env.DEAL_REGISTRY_CURSOR_SECRET = previousSecret;
  });

  it('paginates stably, orders by priority/deadline/money and denies non-participant rows', async () => {
    const instance = await createRememberedInstance();
    try {
      const fixture = await provisionDeal(instance.prisma, 'deal-registry-page', 90_000_000n);
      const buyer = fixture.users.buyer;
      const common = {
        userId: buyer.id,
        organizationId: buyer.orgId,
        sellerOrgId: fixture.sellerOrgId,
        buyerOrgId: fixture.buyerOrgId,
      };
      await seedRegistryDeal(instance, {
        ...common,
        id: 'DEAL-REGISTRY-001',
        status: 'DRAFT',
        nextAction: 'Подтвердить допуск участников',
        slaAt: new Date('2026-07-14T08:00:00.000Z'),
        updatedAt: new Date('2026-07-13T12:00:00.000Z'),
        totalKopecks: 110_000_000n,
      });
      await seedRegistryDeal(instance, {
        ...common,
        id: 'DEAL-REGISTRY-002',
        status: 'RESERVED',
        nextAction: 'Назначить перевозку',
        slaAt: new Date('2026-07-15T08:00:00.000Z'),
        updatedAt: new Date('2026-07-13T12:30:00.000Z'),
        totalKopecks: 220_000_000n,
      });
      await seedRegistryDeal(instance, {
        ...common,
        id: 'DEAL-REGISTRY-003',
        status: 'DOCUMENTS_COMPLETE',
        nextAction: 'Запросить выплату',
        slaAt: null,
        updatedAt: new Date('2026-07-13T13:00:00.000Z'),
        totalKopecks: 330_000_000n,
      });
      await seedRegistryDeal(instance, {
        ...common,
        id: 'DEAL-REGISTRY-004',
        status: 'CLOSED',
        nextAction: null,
        slaAt: null,
        updatedAt: new Date('2026-07-13T11:00:00.000Z'),
        totalKopecks: 440_000_000n,
      });
      await seedRegistryDeal(instance, {
        ...common,
        id: 'DEAL-REGISTRY-NO-PARTICIPANT',
        status: 'DRAFT',
        nextAction: 'Недоступное действие',
        slaAt: new Date('2026-07-13T07:00:00.000Z'),
        updatedAt: new Date('2026-07-13T14:00:00.000Z'),
        totalKopecks: 999_000_000n,
        withParticipant: false,
      });
      await seedRegistryDeal(instance, {
        ...common,
        id: 'DEAL-REGISTRY-CROSS-TENANT',
        tenantId: 'tenant-registry-foreign',
        status: 'DRAFT',
        nextAction: 'Недоступное действие',
        slaAt: new Date('2026-07-13T06:00:00.000Z'),
        updatedAt: new Date('2026-07-13T15:00:00.000Z'),
        totalKopecks: 1_000_000_000n,
      });

      const registry = new DealRegistryQueryService(instance.rls);
      const first = await registry.listAccessible({ limit: 2 }, buyer);
      expect(first.items.map((item) => item.id)).toEqual([
        'DEAL-REGISTRY-002',
        'DEAL-REGISTRY-003',
      ]);
      expect(first.hasMore).toBe(true);
      expect(first.nextCursor).toEqual(expect.stringMatching(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/));
      expect(first.items[0]).toMatchObject({
        priorityReason: 'MONEY_CONTROL',
        priorityRank: 1,
        deadlineAt: '2026-07-15T08:00:00.000Z',
        moneyImpactKopecks: '220000000',
        myRole: 'BUYER',
        myAccessLevel: 'WORK',
      });
      expect(first.items[1]).toMatchObject({
        priorityReason: 'MONEY_CONTROL',
        priorityRank: 1,
        deadlineAt: null,
        moneyImpactKopecks: '330000000',
      });

      const seen = new Set(first.items.map((item) => item.id));
      let cursor = first.nextCursor;
      while (cursor) {
        const page = await registry.listAccessible({ limit: 2, cursor }, buyer);
        for (const item of page.items) {
          expect(seen.has(item.id)).toBe(false);
          seen.add(item.id);
        }
        cursor = page.nextCursor;
      }
      expect(seen).toEqual(expect.arrayContaining([
        fixture.dealId,
        'DEAL-REGISTRY-001',
        'DEAL-REGISTRY-002',
        'DEAL-REGISTRY-003',
        'DEAL-REGISTRY-004',
      ]));
      expect(seen.has('DEAL-REGISTRY-NO-PARTICIPANT')).toBe(false);
      expect(seen.has('DEAL-REGISTRY-CROSS-TENANT')).toBe(false);

      const reserved = await registry.listAccessible({ status: 'RESERVED' }, buyer);
      expect(reserved.items.map((item) => item.id)).toEqual(['DEAL-REGISTRY-002']);

      const urgent = await registry.listAccessible({
        actionable: true,
        deadlineBefore: '2026-07-14T23:59:59.000Z',
        minMoneyKopecks: '100000000',
        role: 'BUYER',
      }, buyer);
      expect(urgent.items.map((item) => item.id)).toEqual(['DEAL-REGISTRY-001']);
    } finally {
      await destroyInstance(instance);
    }
  });
});
