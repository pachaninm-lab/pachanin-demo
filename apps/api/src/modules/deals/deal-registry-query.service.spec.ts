import { BadRequestException } from '@nestjs/common';
import { Role, type RequestUser } from '../../common/types/request-user';
import { DealRegistryQueryService } from './deal-registry-query.service';

const user: RequestUser = {
  id: 'registry-user',
  email: 'registry@invalid.test',
  role: Role.BUYER,
  orgId: 'registry-org',
  tenantId: 'registry-tenant',
  sessionId: 'registry-session',
};

function row(id: string, input: Partial<Record<string, unknown>> = {}) {
  return {
    deal_id: id,
    deal_number: `ТП-${id}`,
    deal_status: 'DRAFT',
    culture: 'Пшеница',
    crop_class: null,
    region: 'Тамбовская область',
    volume_tons: 100,
    total_kopecks: 100_000_000n,
    currency: 'RUB',
    deal_version: 1n,
    updated_at: new Date('2026-07-13T10:00:00.000Z'),
    next_action: 'Подтвердить допуск участников',
    sla_at: null,
    my_role: 'BUYER',
    my_access_level: 'WORK',
    priority_reason: 'ACTION_REQUIRED',
    ...input,
  };
}

function serviceWithRows(rows: unknown[]) {
  const queryRaw = jest.fn().mockResolvedValue(rows);
  const rls = {
    withTrustedContext: jest.fn(async (_user: RequestUser, work: (tx: unknown) => Promise<unknown>) =>
      work({ $queryRaw: queryRaw })),
  };
  return {
    service: new DealRegistryQueryService(rls as never),
    queryRaw,
    withTrustedContext: rls.withTrustedContext,
  };
}

describe('DealRegistryQueryService', () => {
  it('returns an exact-money keyset page without an offset or total count', async () => {
    const unsafeMoney = BigInt(Number.MAX_SAFE_INTEGER) + 100n;
    const { service, queryRaw } = serviceWithRows([
      row('deal-1', { sla_at: new Date('2026-07-14T08:00:00.000Z') }),
      row('deal-2', { total_kopecks: unsafeMoney }),
      row('deal-3'),
    ]);

    const result = await service.listAccessible({ limit: 2, actionable: true }, user);

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(result.count).toBe(2);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toEqual(expect.any(String));
    expect(result.pageInfo.order).toEqual([
      'deadlineAt:asc:nulls-last',
      'updatedAt:desc',
      'id:asc',
    ]);
    expect(result).not.toHaveProperty('totalCount');
    expect(result.items[1]).toMatchObject({
      id: 'deal-2',
      totalKopecks: null,
      moneyImpactKopecks: unsafeMoney.toString(),
      priorityReason: 'ACTION_REQUIRED',
      myAccessLevel: 'WORK',
    });
  });

  it('binds a cursor to the normalized server filter set', async () => {
    const first = serviceWithRows([row('deal-1'), row('deal-2')]);
    const page = await first.service.listAccessible({ limit: 1, status: 'draft' }, user);
    expect(page.nextCursor).toEqual(expect.any(String));

    const second = serviceWithRows([]);
    await second.service.listAccessible({ limit: 1, status: 'DRAFT', cursor: page.nextCursor! }, user);
    expect(second.queryRaw).toHaveBeenCalledTimes(1);

    await expect(second.service.listAccessible({
      limit: 1,
      status: 'RESERVED',
      cursor: page.nextCursor!,
    }, user)).rejects.toMatchObject<Partial<BadRequestException>>({
      response: expect.objectContaining({ code: 'DEAL_REGISTRY_CURSOR_FILTER_MISMATCH' }),
    });
  });

  it('rejects malformed status and cursor input before PostgreSQL execution', async () => {
    const { service, queryRaw } = serviceWithRows([]);

    await expect(service.listAccessible({ status: 'DRAFT,not valid!' }, user)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_DEAL_REGISTRY_STATUS_FILTER' }),
    });
    await expect(service.listAccessible({ cursor: 'not+base64' }, user)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_DEAL_REGISTRY_CURSOR' }),
    });
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
