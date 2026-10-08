import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FactoringService } from './factoring.service';
import { Role, type RequestUser } from '../../common/types/request-user';

/**
 * Факторинг читал ЛЮБУЮ организацию, а когда не находил — придумывал её.
 *
 * `FINANCE_ROLES` здесь включает FARMER и BUYER, то есть обычных участников
 * рынка. `organizationId` приходит параметром, и до этой правки не проверялось,
 * чей он. Отсюда три разных дефекта в одном файле:
 *
 *  1. `deal.findMany({ where: { sellerOrgId } })` — без тенанта. Участник
 *     одного тенанта получал статистику организации другого: число сделок,
 *     закрытых, оборот.
 *  2. `dispute.count` — без скоупа ВООБЩЕ. Споры всей платформы за год делились
 *     на число сделок ЭТОЙ организации. Это и утечка масштаба платформы, и
 *     порча рейтинга: у организации с тремя сделками disputeRate уходил за
 *     единицу и обнулял 30 баллов из 100.
 *  3. `organization.findUnique({ where: { id } })` — без тенанта, и его `inn`
 *     уходил наружу, в бюро кредитных историй.
 *
 * Худшее — в `getCreditReport`: при ненайденной организации он подставлял
 * ЗАШИТЫЙ ИНН и возвращал `{ organizationId, ...report }`. То есть кредитный
 * отчёт о постороннем юрлице, подписанный запрошенным идентификатором
 * организации. Не деградация, а выдуманная финансовая справка о названной
 * компании.
 */

const TENANT = 'tenant-A';

function userWith(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 'u-1',
    orgId: 'org-1',
    role: Role.ACCOUNTING,
    email: 'finance@example.test',
    tenantId: TENANT,
    ...overrides,
  };
}

function makePrisma() {
  return {
    deal: { findMany: jest.fn().mockResolvedValue([]) },
    dispute: { count: jest.fn().mockResolvedValue(0) },
    organization: { findFirst: jest.fn().mockResolvedValue({ inn: '7700000001', name: 'ООО Свои' }) },
  };
}

function makeService(prisma: unknown) {
  const notifications = { notify: jest.fn(), send: jest.fn() };
  return new FactoringService(prisma as never, notifications as never);
}

describe('FactoringService — организация только своего тенанта', () => {
  it('scoreOrganization фильтрует сделки по тенанту вызывающего', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);

    await service.scoreOrganization('org-9', userWith());

    expect(prisma.deal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sellerOrgId: 'org-9', tenantId: TENANT }),
      }),
    );
  });

  it('scoreOrganization считает споры по сделкам этой организации, а не по всей платформе', async () => {
    // Без этого рейтинг организации зависел бы от числа споров у чужих
    // тенантов — и сам по себе выдавал бы масштаб платформы.
    const prisma = makePrisma();
    prisma.deal.findMany.mockResolvedValue([
      { id: 'deal-1', status: 'CLOSED', totalKopecks: 100n, totalRub: null },
      { id: 'deal-2', status: 'CLOSED', totalKopecks: 200n, totalRub: null },
    ]);
    const service = makeService(prisma);

    await service.scoreOrganization('org-9', userWith());

    expect(prisma.dispute.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ dealId: { in: ['deal-1', 'deal-2'] } }),
      }),
    );
  });

  it('scoreOrganization ищет организацию по паре id+тенант, а не по одному id', async () => {
    // Чужая организация обязана быть неотличима от несуществующей.
    const prisma = makePrisma();
    const service = makeService(prisma);

    await service.scoreOrganization('org-9', userWith());

    expect(prisma.organization.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'org-9', tenantId: TENANT } }),
    );
  });

  it('getCreditReport отказывает, когда организации нет в тенанте вызывающего', async () => {
    // Раньше здесь подставлялся зашитый ИНН и в бюро уходил запрос по чужому
    // юрлицу, а ответ возвращался подписанным чужим organizationId.
    const prisma = makePrisma();
    prisma.organization.findFirst.mockResolvedValue(null);
    const service = makeService(prisma);

    await expect(service.getCreditReport('org-foreign', userWith())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getCreditReport не обращается в бюро по зашитому ИНН', async () => {
    const prisma = makePrisma();
    prisma.organization.findFirst.mockResolvedValue(null);
    const service = makeService(prisma);

    await service.getCreditReport('org-foreign', userWith()).catch(() => undefined);

    // Проверяется именно то, что поиск шёл в пределах тенанта и на отсутствии
    // результата метод остановился, а не пошёл дальше с подставным значением.
    expect(prisma.organization.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'org-foreign', tenantId: TENANT } }),
    );
  });

  it.each([
    ['scoreOrganization', (s: FactoringService, u: RequestUser) => s.scoreOrganization('org-9', u)],
    ['getCreditReport', (s: FactoringService, u: RequestUser) => s.getCreditReport('org-9', u)],
  ])('%s отказывает, когда тенанта у вызывающего нет', async (_name, call) => {
    const prisma = makePrisma();
    const service = makeService(prisma);

    await expect(call(service, userWith({ tenantId: undefined }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.deal.findMany).not.toHaveBeenCalled();
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });

  it('getCreditReport проверяет роль раньше тенанта', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);

    await expect(
      service.getCreditReport('org-9', userWith({ role: Role.DRIVER, tenantId: undefined })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });
});

describe('FactoringService — обратная сторона', () => {
  it('своя организация по-прежнему скорится', async () => {
    // Иначе «всё закрыто» прошло бы как успех.
    const prisma = makePrisma();
    prisma.deal.findMany.mockResolvedValue([
      { id: 'd1', status: 'CLOSED', totalKopecks: 500_000_00n, totalRub: null },
      { id: 'd2', status: 'CLOSED', totalKopecks: 500_000_00n, totalRub: null },
    ]);
    const service = makeService(prisma);

    const result = await service.scoreOrganization('org-1', userWith());

    expect(result.score).toBeGreaterThan(0);
    expect(result.details).toMatchObject({ totalDeals: 2, closedDeals: 2 });
  });

  it('bigint-обороты складываются, а не роняют скоринг', async () => {
    // totalKopecks — BigInt в схеме. Прежний алиас обещал number, и это была
    // неправда, которую скрывал `.catch(() => [] as DealScoreRow[])`.
    const prisma = makePrisma();
    prisma.deal.findMany.mockResolvedValue([
      { id: 'd1', status: 'CLOSED', totalKopecks: 250_000n, totalRub: null },
      { id: 'd2', status: 'CLOSED', totalKopecks: 750_000n, totalRub: null },
    ]);
    const service = makeService(prisma);

    const result = await service.scoreOrganization('org-1', userWith());

    expect(result.details).toMatchObject({ totalVolumeRub: 10_000 });
  });

  it('без базы демонстрационный режим сохраняется', async () => {
    // Запасной ИНН остаётся законным ровно здесь и больше нигде.
    const service = makeService(undefined);

    const result = await service.scoreOrganization('org-1', userWith());

    expect(result.details).toMatchObject({ totalDeals: 12, closedDeals: 10 });
  });

  it('отказ базы доходит до вызывающего, а не превращается в нулевой рейтинг', async () => {
    // Нулевой рейтинг — это отказ в факторинге. Выдавать его из-за недоступной
    // базы значит принимать за организацию финансовое решение по несуществующим
    // данным.
    const prisma = makePrisma();
    const dbDown = new Error('connection refused');
    prisma.deal.findMany.mockRejectedValue(dbDown);
    const service = makeService(prisma);

    await expect(service.scoreOrganization('org-1', userWith())).rejects.toThrow(dbDown);
  });
});
