import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BusinessReputationService } from './business-reputation.service';
import { Role, type RequestUser } from '../../common/types/request-user';

/**
 * Репутация считалась по всей платформе.
 *
 * `computeScore` читал сделки по `sellerOrgId` и `buyerOrgId` без предиката
 * тенанта и брал организацию `findUnique` по одному `id`. Контроллер при этом
 * получал вызывающего и отбрасывал его как `_user`. То есть любой
 * аутентифицированный пользователь по названному `organizationId` получал
 * оценку чужого юридического лица: число сделок, оборот, споры, статусы KYC и
 * AML, — а пакетный маршрут принимал произвольный массив идентификаторов и
 * потому работал как средство перебора.
 *
 * Отдельно — два дефекта, которые эта же правка закрывает:
 *
 *  1. Компонент споров был тождественно нулевым. `select` просил только
 *     `status` и `totalRub`, а код читал `d.id` через `as any`. Замерено
 *     настоящим Prisma на живой базе: строка приходит как
 *     `{"status":"ACTIVE","totalRub":null}`, `d.id` равен `undefined`, и
 *     фильтр вырождался в `dealId IN ('')`. Четверть веса оценки была
 *     константой 100.
 *  2. Отказ базы проглатывался. Оценка считалась по нулям и давала около 30 —
 *     «повышенный риск» о компании, данные которой никто не прочитал. Тот же
 *     класс, что закрыт в факторинге (#4984).
 */

const TENANT = 'tenant-A';

function userWith(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 'u-1',
    orgId: 'org-1',
    role: Role.BUYER,
    email: 'buyer@example.test',
    tenantId: TENANT,
    ...overrides,
  };
}

function makePrisma() {
  return {
    deal: { findMany: jest.fn().mockResolvedValue([]) },
    dispute: { count: jest.fn().mockResolvedValue(0) },
    organization: {
      findFirst: jest.fn().mockResolvedValue({
        kycStatus: 'VERIFIED',
        amlStatus: 'CLEAR',
        createdAt: new Date('2024-01-01T00:00:00Z'),
      }),
    },
  };
}

const service = (prisma: unknown) => new BusinessReputationService(prisma as never);

describe('BusinessReputationService — оценка только в пределах своего тенанта', () => {
  it('обе выборки сделок фильтруются по тенанту вызывающего', async () => {
    const prisma = makePrisma();

    await service(prisma).getScore('org-9', userWith());

    expect(prisma.deal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sellerOrgId: 'org-9', tenantId: TENANT } }),
    );
    expect(prisma.deal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { buyerOrgId: 'org-9', tenantId: TENANT } }),
    );
  });

  it('организация ищется по паре id+тенант, а не по одному id', async () => {
    const prisma = makePrisma();

    await service(prisma).getScore('org-9', userWith());

    expect(prisma.organization.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'org-9', tenantId: TENANT } }),
    );
  });

  it('организация вне тенанта — отказ, а не оценка по нулям', async () => {
    const prisma = makePrisma();
    prisma.organization.findFirst.mockResolvedValue(null);

    await expect(service(prisma).getScore('org-foreign', userWith())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('без тенанта у вызывающего чтений не происходит вовсе', async () => {
    const prisma = makePrisma();

    await expect(
      service(prisma).getScore('org-9', userWith({ tenantId: undefined })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.deal.findMany).not.toHaveBeenCalled();
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });

  it('пакет пропускает чужие организации и оценивает свои', async () => {
    const prisma = makePrisma();
    prisma.organization.findFirst.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === 'org-own'
          ? { kycStatus: 'VERIFIED', amlStatus: 'CLEAR', createdAt: new Date('2024-01-01T00:00:00Z') }
          : null,
      ),
    );

    const result = await service(prisma).getScoreBatch(['org-own', 'org-foreign'], userWith());

    expect(Object.keys(result)).toEqual(['org-own']);
  });

  it('пустой пакет без тенанта — тоже отказ, а не пустой ответ', async () => {
    // Найдено мутацией, а не чтением: проверка тенанта в getScoreBatch сначала
    // выглядела избыточной, потому что getScore проверяет сам. Но при пустом
    // массиве getScore не вызывается ни разу, и без собственной проверки пакет
    // возвращал бы `{}` пользователю вообще без тенанта — то есть успех.
    const prisma = makePrisma();

    await expect(
      service(prisma).getScoreBatch([], userWith({ tenantId: undefined })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('пакет не превращает отказ базы в пустой ответ', async () => {
    // Пропуском становится только «нет такой организации в этом тенанте».
    // Иначе недоступная база выглядела бы как «ни одной организации нет».
    const prisma = makePrisma();
    const dbDown = new Error('connection refused');
    prisma.deal.findMany.mockRejectedValue(dbDown);

    await expect(service(prisma).getScoreBatch(['org-1'], userWith())).rejects.toThrow(dbDown);
  });
});

describe('BusinessReputationService — кэш не должен переносить оценку между тенантами', () => {
  it('тот же orgId под другим тенантом считается заново', async () => {
    // Кэш жил на одном orgId пятнадцать минут. Оставить его таким после
    // добавления предиката значило бы отдать посчитанное одному тенанту
    // другому — и открыть ту же границу за спиной у правки.
    const prisma = makePrisma();
    const reputation = service(prisma);

    await reputation.getScore('org-9', userWith({ tenantId: 'tenant-A' }));
    await reputation.getScore('org-9', userWith({ tenantId: 'tenant-B' }));

    const tenants = prisma.deal.findMany.mock.calls.map(([args]: [{ where: { tenantId: string } }]) => args.where.tenantId);
    expect(new Set(tenants)).toEqual(new Set(['tenant-A', 'tenant-B']));
  });

  it('повторный запрос внутри одного тенанта по-прежнему берётся из кэша', async () => {
    // Обратная сторона: если бы кэш перестал работать вовсе, «утечки нет»
    // прошло бы как успех.
    const prisma = makePrisma();
    const reputation = service(prisma);

    await reputation.getScore('org-9', userWith());
    await reputation.getScore('org-9', userWith({ id: 'u-2' }));

    expect(prisma.organization.findFirst).toHaveBeenCalledTimes(1);
  });

  it('invalidate снимает запись именно своего тенанта', async () => {
    const prisma = makePrisma();
    const reputation = service(prisma);

    await reputation.getScore('org-9', userWith());
    reputation.invalidate('org-9', 'tenant-B');
    await reputation.getScore('org-9', userWith());
    expect(prisma.organization.findFirst).toHaveBeenCalledTimes(1);

    reputation.invalidate('org-9', TENANT);
    await reputation.getScore('org-9', userWith());
    expect(prisma.organization.findFirst).toHaveBeenCalledTimes(2);
  });
});

describe('BusinessReputationService — компонент споров перестал быть мёртвым', () => {
  it('id сделки запрашивается явно, иначе фильтр споров вырождается в пустую строку', async () => {
    // Это не косметика. Prisma `select` исчерпывающий: без `id: true` строка
    // не содержит идентификатора, и прежний `d.id ?? ''` давал `['']`.
    const prisma = makePrisma();

    await service(prisma).getScore('org-9', userWith());

    for (const [args] of prisma.deal.findMany.mock.calls as Array<[{ select: Record<string, boolean> }]>) {
      expect(args.select).toEqual(expect.objectContaining({ id: true }));
    }
  });

  it('споры считаются ровно по выбранным сделкам', async () => {
    const prisma = makePrisma();
    prisma.deal.findMany
      .mockResolvedValueOnce([{ id: 'd-1', status: 'CLOSED', totalRub: 100 }])
      .mockResolvedValueOnce([{ id: 'd-2', status: 'ACTIVE', totalRub: 200 }]);

    await service(prisma).getScore('org-9', userWith());

    expect(prisma.dispute.count).toHaveBeenCalledWith({ where: { dealId: { in: ['d-1', 'd-2'] } } });
  });

  it('найденные споры действительно снижают оценку', async () => {
    // Пока фильтр вырождался, disputeCount был нулём всегда, а disputeScore —
    // константой 100, то есть четверть веса не работала.
    const prisma = makePrisma();
    const deals = [
      { id: 'd-1', status: 'CLOSED', totalRub: 100 },
      { id: 'd-2', status: 'CLOSED', totalRub: 100 },
    ];
    prisma.deal.findMany.mockResolvedValueOnce(deals).mockResolvedValueOnce([]);
    prisma.dispute.count.mockResolvedValue(1);

    const withDisputes = await service(prisma).getScore('org-9', userWith());

    const clean = makePrisma();
    clean.deal.findMany.mockResolvedValueOnce(deals).mockResolvedValueOnce([]);
    const withoutDisputes = await service(clean).getScore('org-9', userWith());

    expect(withDisputes.disputeCount).toBe(1);
    expect(withDisputes.score).toBeLessThan(withoutDisputes.score);
  });
});

describe('BusinessReputationService — обратная сторона', () => {
  it('своя организация по-прежнему оценивается', async () => {
    const prisma = makePrisma();
    prisma.deal.findMany
      .mockResolvedValueOnce([
        { id: 'd-1', status: 'CLOSED', totalRub: 1_000_000 },
        { id: 'd-2', status: 'SETTLED', totalRub: 2_000_000 },
      ])
      .mockResolvedValueOnce([]);

    const result = await service(prisma).getScore('org-1', userWith());

    expect(result).toMatchObject({ orgId: 'org-1', dealsTotal: 2, dealsCompleted: 2 });
    expect(result.score).toBeGreaterThan(0);
    expect(result.averageDealRub).toBe(1_500_000);
  });

  it('отказ базы доходит до вызывающего, а не превращается в выдуманную оценку', async () => {
    // Прежний путь глотал исключение и считал по нулям: около 30 баллов и
    // «повышенный риск» о компании, данные которой никто не прочитал.
    const prisma = makePrisma();
    const dbDown = new Error('connection refused');
    prisma.deal.findMany.mockRejectedValue(dbDown);

    await expect(service(prisma).getScore('org-1', userWith())).rejects.toThrow(dbDown);
  });

  it('без базы демонстрационный режим сохраняется', async () => {
    const result = await service(undefined).getScore('org-1', userWith());

    expect(result).toMatchObject({ dealsTotal: 12, dealsCompleted: 10, disputeCount: 1 });
  });
});
