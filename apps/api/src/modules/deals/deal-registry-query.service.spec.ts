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
    priority_rank: 2,
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
  const previousSecret = process.env.DEAL_REGISTRY_CURSOR_SECRET;

  beforeAll(() => {
    process.env.DEAL_REGISTRY_CURSOR_SECRET = 'registry-cursor-test-secret-at-least-32-bytes';
  });

  afterAll(() => {
    if (previousSecret === undefined) delete process.env.DEAL_REGISTRY_CURSOR_SECRET;
    else process.env.DEAL_REGISTRY_CURSOR_SECRET = previousSecret;
  });

  it('returns an exact-money keyset page without an offset or total count', async () => {
    const unsafeMoney = BigInt(Number.MAX_SAFE_INTEGER) + 100n;
    const { service, queryRaw } = serviceWithRows([
      row('deal-1', { priority_rank: 0, sla_at: new Date('2026-07-14T08:00:00.000Z') }),
      row('deal-2', { priority_rank: 1, total_kopecks: unsafeMoney }),
      row('deal-3'),
    ]);

    const result = await service.listAccessible({ limit: 2, actionable: true }, user);

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(result.count).toBe(2);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toEqual(expect.stringMatching(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/));
    expect(result.pageInfo.order).toEqual([
      'priorityRank:asc',
      'deadlineAt:asc:nulls-last',
      'moneyImpactKopecks:desc:nulls-last',
      'updatedAt:desc',
      'id:asc',
    ]);
    expect(result).not.toHaveProperty('totalCount');
    expect(result.items[1]).toMatchObject({
      id: 'deal-2',
      totalKopecks: null,
      moneyImpactKopecks: unsafeMoney.toString(),
      priorityReason: 'ACTION_REQUIRED',
      priorityRank: 1,
      myAccessLevel: 'WORK',
    });
  });

  it('binds a signed cursor to the normalized server filter set', async () => {
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

    const tampered = `${page.nextCursor!.slice(0, -1)}${page.nextCursor!.endsWith('A') ? 'B' : 'A'}`;
    await expect(second.service.listAccessible({
      limit: 1,
      status: 'DRAFT',
      cursor: tampered,
    }, user)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_DEAL_REGISTRY_CURSOR' }),
    });
  });

  it('rejects malformed status and cursor input before PostgreSQL execution', async () => {
    const { service, queryRaw } = serviceWithRows([]);

    await expect(service.listAccessible({ status: 'DRAFT,not valid!' }, user)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_DEAL_REGISTRY_STATUS_FILTER' }),
    });
    await expect(service.listAccessible({ cursor: 'not-a-signed-cursor' }, user)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_DEAL_REGISTRY_CURSOR' }),
    });
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
