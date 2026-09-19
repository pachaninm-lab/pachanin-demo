import { ForbiddenException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { Role, type RequestUser } from '../../common/types/request-user';

/**
 * Аналитика читала базу без границы тенанта (#4839).
 *
 * ANALYTICS_ROLES — те же четыре роли, что и EXPORT_ALLOWED_ROLES: ADMIN,
 * EXECUTIVE, ACCOUNTING, COMPLIANCE_OFFICER. В exports.service.ts каждая из
 * шести выгрузок для них ограничена тенантом. Здесь тенанта не было вовсе:
 *
 *  - getUnitEconomics считал GMV, число сделок, топ культур, топ регионов и
 *    долю споров по ВСЕЙ платформе;
 *  - getLedgerSummary читал ledger_entries вообще без `where` и отдавал
 *    суммарный эскроу, выплаты, удержания по спорам и комиссию всей платформы.
 *
 * Одна и та же роль получала свою сделку через выгрузку и коммерческую сводку
 * конкурентов — через агрегат.
 *
 * На RLS опереться нельзя: `deals_uncontexted_read FOR SELECT USING (TRUE)`
 * permissive и объединяется со строгой `deals_select` через OR. Её COMMENT
 * называет причиной, по которой она ещё жива, ровно этот файл: «while the
 * export and analytics readers still run outside an RLS context» (#4814).
 */

const TENANT = 'tenant-A';
const DB_DOWN = new Error('connection refused');

function userWith(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 'u-1',
    orgId: 'org-1',
    role: Role.EXECUTIVE,
    email: 'analytics@example.test',
    tenantId: TENANT,
    ...overrides,
  };
}

function makePrisma() {
  return {
    deal: { findMany: jest.fn().mockResolvedValue([]) },
    dispute: { count: jest.fn().mockResolvedValue(0) },
    ledgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('AnalyticsService — тенант в предикате, а не в комментарии', () => {
  it('getUnitEconomics считает только по сделкам своего тенанта', async () => {
    const prisma = makePrisma();
    const service = new AnalyticsService(prisma as never);

    await service.getUnitEconomics(userWith());

    expect(prisma.deal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT }) }),
    );
  });

  it('getUnitEconomics считает споры по тем же сделкам, а не по всей платформе', async () => {
    // Иначе доля споров тенанта считалась бы от знаменателя всей платформы —
    // и сама по себе оставалась бы утечкой её масштаба.
    const prisma = makePrisma();
    prisma.deal.findMany.mockResolvedValue([{ id: 'deal-A1' }, { id: 'deal-A2' }]);
    const service = new AnalyticsService(prisma as never);

    await service.getUnitEconomics(userWith());

    expect(prisma.dispute.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ dealId: { in: ['deal-A1', 'deal-A2'] } }),
      }),
    );
  });

  it('getLedgerSummary читает проводки только по сделкам своего тенанта', async () => {
    const prisma = makePrisma();
    prisma.deal.findMany.mockResolvedValue([{ id: 'deal-A1' }]);
    const service = new AnalyticsService(prisma as never);

    await service.getLedgerSummary(userWith());

    expect(prisma.deal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT }) }),
    );
    expect(prisma.ledgerEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { dealId: { in: ['deal-A1'] } } }),
    );
  });

  it('getLedgerSummary у тенанта без сделок сохраняет предикат, а не теряет его', async () => {
    // Пустой список сделок не должен вырождаться в чтение без границы: именно
    // такого чтения здесь и не было.
    const prisma = makePrisma();
    const service = new AnalyticsService(prisma as never);

    await service.getLedgerSummary(userWith());

    expect(prisma.ledgerEntry.findMany.mock.calls[0][0].where).toEqual({ dealId: { in: [] } });
  });

  it.each([
    ['getUnitEconomics', (s: AnalyticsService, u: RequestUser) => s.getUnitEconomics(u)],
    ['getLedgerSummary', (s: AnalyticsService, u: RequestUser) => s.getLedgerSummary(u)],
  ])('%s отказывает, когда тенанта у вызывающего нет', async (_name, call) => {
    const prisma = makePrisma();
    const service = new AnalyticsService(prisma as never);

    await expect(call(service, userWith({ tenantId: undefined }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.deal.findMany).not.toHaveBeenCalled();
    expect(prisma.ledgerEntry.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ['getUnitEconomics', (s: AnalyticsService, u: RequestUser) => s.getUnitEconomics(u)],
    ['getLedgerSummary', (s: AnalyticsService, u: RequestUser) => s.getLedgerSummary(u)],
  ])('%s проверяет роль раньше тенанта', async (_name, call) => {
    // Порядок важен: сообщение об отсутствующем тенанте не должно доставаться
    // роли, которой доступ к аналитике не положен вовсе.
    const prisma = makePrisma();
    const service = new AnalyticsService(prisma as never);

    await expect(
      call(service, userWith({ role: Role.DRIVER, tenantId: undefined })),
    ).rejects.toThrow('Доступ к аналитике ограничен');
  });

  it('без prisma отказ по тенанту всё равно происходит', async () => {
    // Форма границы не должна зависеть от режима развёртывания: in-memory
    // ветка не повод отдать агрегат вызывающему без тенанта.
    const service = new AnalyticsService();

    await expect(
      service.getUnitEconomics(userWith({ tenantId: undefined })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('роль из списка по-прежнему получает агрегат', async () => {
    // Обратная сторона: «всё закрыто» не должно проходить как успех.
    const prisma = makePrisma();
    prisma.deal.findMany.mockResolvedValue([
      { id: 'deal-A1', status: 'CLOSED', totalKopecks: 100_000n, culture: 'wheat', region: 'Kuban', volumeTons: 10 },
    ]);
    const service = new AnalyticsService(prisma as never);

    const result = await service.getUnitEconomics(userWith({ role: Role.ACCOUNTING }));

    expect(result.dealsCount).toBe(1);
    expect(result.gmvKopecks).toBe(100_000);
  });
});

/**
 * Дефект, который прятал сам `.catch(() => [])`.
 *
 * totalKopecks и amountKopecks объявлены в схеме как BigInt, то есть в рантайме
 * это `bigint`. Прежний код складывал их с числовым аккумулятором, и это не
 * «неточность», а падение: `0 += 100n` даёт
 * «TypeError: Cannot mix BigInt and other types» — замерено в node.
 *
 * Типы этого не показывали, потому что `.catch(() => [])` расширял элемент
 * массива до `any` и отключал проверку каждого поля каждой строки. Снятие catch
 * вскрыло дефект, который он же и прятал; tsc отказался компилировать сразу
 * после удаления, до единой правки арифметики.
 *
 * Моки ниже держат именно bigint, как отдаёт Prisma. С числами вместо них эти
 * тесты проходили бы и на старом коде и ничего бы не доказывали.
 */
describe('AnalyticsService — BigInt из схемы складывается, а не роняет запрос', () => {
  it('getUnitEconomics суммирует bigint-обороты', async () => {
    const prisma = makePrisma();
    prisma.deal.findMany.mockResolvedValue([
      { id: 'deal-A1', status: 'CLOSED', totalKopecks: 250_000n, culture: 'wheat', region: 'Kuban', volumeTons: 10 },
      { id: 'deal-A2', status: 'CLOSED', totalKopecks: 750_000n, culture: 'wheat', region: 'Kuban', volumeTons: 5 },
    ]);
    const service = new AnalyticsService(prisma as never);

    const result = await service.getUnitEconomics(userWith());

    expect(result.gmvKopecks).toBe(1_000_000);
    expect(result.gmvRub).toBe(10_000);
  });

  it('getUnitEconomics по-прежнему падает на totalRub, когда totalKopecks нет', async () => {
    // Ветка пересчёта из рублей должна сохраниться: приведение bigint не
    // должно было её проглотить.
    const prisma = makePrisma();
    prisma.deal.findMany.mockResolvedValue([
      { id: 'deal-A1', status: 'CLOSED', totalKopecks: null, totalRub: 1_234, culture: null, region: null, volumeTons: 1 },
    ]);
    const service = new AnalyticsService(prisma as never);

    await expect(service.getUnitEconomics(userWith())).resolves.toMatchObject({
      gmvKopecks: 123_400,
    });
  });

  it('getLedgerSummary суммирует bigint-проводки', async () => {
    const prisma = makePrisma();
    prisma.deal.findMany.mockResolvedValue([{ id: 'deal-A1' }]);
    prisma.ledgerEntry.findMany.mockResolvedValue([
      { entryType: 'ESCROW_RESERVE', amountKopecks: 500_000n },
      { entryType: 'ESCROW_RELEASE', amountKopecks: 300_000n },
      { entryType: 'DISPUTE_HOLD', amountKopecks: 100_000n },
      { entryType: 'COMMISSION', amountKopecks: 7_500n },
    ]);
    const service = new AnalyticsService(prisma as never);

    await expect(service.getLedgerSummary(userWith())).resolves.toEqual({
      totalEscrowKopecks: 500_000,
      totalReleasedKopecks: 300_000,
      totalDisputeHoldKopecks: 100_000,
      totalCommissionKopecks: 7_500,
      entryCount: 4,
    });
  });
});

describe('AnalyticsService — отказ базы доходит до вызывающего', () => {
  it('getUnitEconomics не выдаёт GMV = 0 вместо отказа', async () => {
    // С .catch(() => []) отказ базы давал внешне нормальный отчёт: нулевой
    // оборот, ноль сделок, пустые топы — и ничто в ответе не помечало его как
    // недостоверный.
    const prisma = makePrisma();
    prisma.deal.findMany.mockRejectedValue(DB_DOWN);
    const service = new AnalyticsService(prisma as never);

    await expect(service.getUnitEconomics(userWith())).rejects.toThrow(DB_DOWN);
  });

  it('getUnitEconomics не выдаёт нулевую долю споров вместо отказа', async () => {
    const prisma = makePrisma();
    prisma.dispute.count.mockRejectedValue(DB_DOWN);
    const service = new AnalyticsService(prisma as never);

    await expect(service.getUnitEconomics(userWith())).rejects.toThrow(DB_DOWN);
  });

  it('getLedgerSummary не выдаёт нулевой эскроу вместо отказа', async () => {
    const prisma = makePrisma();
    prisma.ledgerEntry.findMany.mockRejectedValue(DB_DOWN);
    const service = new AnalyticsService(prisma as never);

    await expect(service.getLedgerSummary(userWith())).rejects.toThrow(DB_DOWN);
  });

  it('нулевые значения по-прежнему возвращаются, когда данных действительно нет', async () => {
    const prisma = makePrisma();
    const service = new AnalyticsService(prisma as never);

    await expect(service.getLedgerSummary(userWith())).resolves.toMatchObject({
      totalEscrowKopecks: 0,
      entryCount: 0,
    });
  });
});
