import { ForbiddenException } from '@nestjs/common';
import { ExportsService } from './exports.service';
import { Role, type RequestUser } from '../../common/types/request-user';

/**
 * Замер на живой базе (#4839): под ролью приложения `app_runtime`
 * (NOSUPERUSER, NOBYPASSRLS), без выставленного RLS-контекста, запрос без
 * предиката тенанта вернул сделки обоих тенантов. Причина — политика
 * `deals_app_access USING (true)`: permissive-политики PostgreSQL объединяет
 * через OR, поэтому она обесценивает строгую `deals_select`.
 *
 * Пока та политика жива (#4814), предикат в запросе — единственная граница на
 * этом пути. Здесь проверяется, что он есть у каждого чтения и что отсутствие
 * тенанта у вызывающего приводит к отказу, а не к чтению без границы.
 */

const TENANT = 'tenant-A';

function userWith(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 'u-1',
    orgId: 'org-1',
    role: Role.ADMIN,
    email: 'exports@example.test',
    tenantId: TENANT,
    ...overrides,
  };
}

function makePrisma() {
  return {
    deal: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    ledgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
    evidenceFile: { findMany: jest.fn().mockResolvedValue([]) },
    outboxEntry: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('ExportsService — тенант в предикате, а не в комментарии', () => {
  it('фильтрует выгрузку сделок по тенанту вызывающего', async () => {
    const prisma = makePrisma();
    const service = new ExportsService(prisma as never);

    await service.exportDealsCsv(userWith());

    expect(prisma.deal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT }) }),
    );
  });

  it('фильтрует по тенанту и отчёт регулятору', async () => {
    // Этот уходит наружу — в МСХ, Росстат, ФНС, Росфинмониторинг. Чужая строка
    // здесь покидает платформу, а не просто показывается не тому.
    const prisma = makePrisma();
    const service = new ExportsService(prisma as never);

    await service.exportRegulatoryReport(userWith(), { type: 'rosstat' });

    expect(prisma.deal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT }) }),
    );
  });

  it.each([
    ['exportEvidenceBundle', (s: ExportsService, u: RequestUser) => s.exportEvidenceBundle('deal-B', u)],
    ['exportLedgerCsv', (s: ExportsService, u: RequestUser) => s.exportLedgerCsv('deal-B', u)],
  ])('%s отказывает на чужой сделке', async (_name, call) => {
    // Чужая сделка должна быть неотличима от несуществующей: findFirst с
    // предикатом тенанта, а не findUnique по id.
    const prisma = makePrisma();
    const service = new ExportsService(prisma as never);

    await expect(call(service, userWith())).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.deal.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'deal-B', tenantId: TENANT }) }),
    );
    expect(prisma.ledgerEntry.findMany).not.toHaveBeenCalled();
    expect(prisma.evidenceFile.findMany).not.toHaveBeenCalled();
  });

  it('отчёт по сделке тоже ищет в пределах тенанта', async () => {
    const prisma = makePrisma();
    const service = new ExportsService(prisma as never);

    await service.exportDealReport('deal-B', userWith()).catch(() => undefined);

    expect(prisma.deal.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'deal-B', tenantId: TENANT }) }),
    );
  });

  it.each([
    ['exportDealsCsv', (s: ExportsService, u: RequestUser) => s.exportDealsCsv(u)],
    ['exportRegulatoryReport', (s: ExportsService, u: RequestUser) => s.exportRegulatoryReport(u, { type: 'msh' })],
    ['exportEvidenceBundle', (s: ExportsService, u: RequestUser) => s.exportEvidenceBundle('deal-A', u)],
    ['exportLedgerCsv', (s: ExportsService, u: RequestUser) => s.exportLedgerCsv('deal-A', u)],
    ['exportDealReport', (s: ExportsService, u: RequestUser) => s.exportDealReport('deal-A', u)],
    ['exportOutboxStatus', (s: ExportsService, u: RequestUser) => s.exportOutboxStatus(u)],
  ])('%s отказывает, когда тенанта у вызывающего нет', async (_name, call) => {
    // Не «читаем без границы, раз тенанта нет»: это и есть закрываемое чтение.
    const prisma = makePrisma();
    const service = new ExportsService(prisma as never);

    await expect(call(service, userWith({ tenantId: undefined }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.deal.findMany).not.toHaveBeenCalled();
    expect(prisma.deal.findFirst).not.toHaveBeenCalled();
    expect(prisma.outboxEntry.findMany).not.toHaveBeenCalled();
  });

  describe('exportOutboxStatus — граница по сделкам тенанта', () => {
    /**
     * outbox_entries своей колонки тенанта не имеет, поэтому границу здесь
     * задаёт список сделок тенанта. На RLS опереться нельзя: соседняя
     * permissive-политика outbox_entries_worker_select не содержит тенанта
     * вовсе, а permissive-политики PostgreSQL объединяет через OR.
     */
    it('читает outbox только по сделкам своего тенанта', async () => {
      const prisma = makePrisma();
      prisma.deal.findMany.mockResolvedValue([{ id: 'deal-A1' }, { id: 'deal-A2' }]);
      const service = new ExportsService(prisma as never);

      await service.exportOutboxStatus(userWith());

      expect(prisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT }) }),
      );
      expect(prisma.outboxEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { dealId: { in: ['deal-A1', 'deal-A2'] } } }),
      );
    });

    it('у тенанта без сделок предикат остаётся, а не исчезает', async () => {
      // Пустой список сделок не должен вырождаться в чтение без границы:
      // это ровно та форма, которой здесь и не было.
      const prisma = makePrisma();
      prisma.deal.findMany.mockResolvedValue([]);
      const service = new ExportsService(prisma as never);

      await service.exportOutboxStatus(userWith());

      const call = prisma.outboxEntry.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ dealId: { in: [] } });
    });

    it('не выбирает payload и leaseToken', async () => {
      // Раньше строка уходила целиком: payload — содержимое события,
      // leaseToken — уникальный маркер аренды воркера доставки.
      const prisma = makePrisma();
      const service = new ExportsService(prisma as never);

      await service.exportOutboxStatus(userWith());

      const select = prisma.outboxEntry.findMany.mock.calls[0][0].select;
      expect(select).toBeDefined();
      expect(select.payload).toBeUndefined();
      expect(select.leaseToken).toBeUndefined();
      expect(select.status).toBe(true);
    });

    it('считает статусы по тому, что вернул скоупленный запрос', async () => {
      // Обратная сторона: граница не должна обнулять выгрузку целиком, иначе
      // «ничего не отдаём» прошло бы как успех.
      const prisma = makePrisma();
      prisma.deal.findMany.mockResolvedValue([{ id: 'deal-A1' }]);
      prisma.outboxEntry.findMany.mockResolvedValue([
        { id: 'o-1', dealId: 'deal-A1', status: 'PENDING' },
        { id: 'o-2', dealId: 'deal-A1', status: 'SENT' },
        { id: 'o-3', dealId: 'deal-A1', status: 'DEAD' },
        { id: 'o-4', dealId: 'deal-A1', status: 'FAILED' },
      ]);
      const service = new ExportsService(prisma as never);

      const result = await service.exportOutboxStatus(userWith());

      expect(result).toMatchObject({ pending: 1, sent: 1, dead: 1, failed: 1 });
      expect(result.entries).toHaveLength(4);
    });
  });

  it('роль по-прежнему проверяется первой', async () => {
    const prisma = makePrisma();
    const service = new ExportsService(prisma as never);

    await expect(
      service.exportDealsCsv(userWith({ role: Role.DRIVER, tenantId: undefined })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.deal.findMany).not.toHaveBeenCalled();
  });
});

/**
 * Проверка роли — на КАЖДОЙ выгрузке, а не на одной.
 *
 * Прежний набор проверял роль только у exportDealsCsv, и тест назывался «роль
 * по-прежнему проверяется первой». При этом exportEvidenceBundle роль не
 * проверял вовсе, и именно он в этом наборе отсутствовал: тест с таким именем
 * ничего не утверждал про метод, где дыра и была.
 *
 * Контроллер закрыт только JwtAuthGuard, поэтому роль целиком держится на
 * сервисе. Замерено на реальном вызове: под DRIVER и под FARMER
 * exportEvidenceBundle возвращал файл вместе с его s3Key, а соседний
 * exportLedgerCsv тому же вызывающему отвечал Export access denied.
 *
 * Таблица ниже перечисляет все шесть выгрузок. Новый метод, забывший
 * assertExportRole, обязан упасть здесь, а не быть замеченным на ревью.
 */
describe('ExportsService — роль проверяется на каждой выгрузке', () => {
  const EVERY_EXPORT: ReadonlyArray<readonly [string, (s: ExportsService, u: RequestUser) => Promise<unknown>]> = [
    ['exportDealsCsv', (s, u) => s.exportDealsCsv(u)],
    ['exportEvidenceBundle', (s, u) => s.exportEvidenceBundle('deal-A', u)],
    ['exportLedgerCsv', (s, u) => s.exportLedgerCsv('deal-A', u)],
    ['exportOutboxStatus', (s, u) => s.exportOutboxStatus(u)],
    ['exportRegulatoryReport', (s, u) => s.exportRegulatoryReport(u, { type: 'msh' })],
    ['exportDealReport', (s, u) => s.exportDealReport('deal-A', u)],
  ];

  it('перечислены все публичные выгрузки сервиса', () => {
    // Иначе таблица тихо отстанет от кода: метод, которого в ней нет, не
    // проверяется вовсе, и это ровно та форма пропуска, что была здесь.
    const declared = EVERY_EXPORT.map(([name]) => name).sort();
    const actual = Object.getOwnPropertyNames(ExportsService.prototype)
      .filter((name) => name.startsWith('export'))
      .sort();
    expect(declared).toEqual(actual);
  });

  // Тенант у пользователя валиден: отказ должен приходить от роли, а не от
  // отсутствующего тенанта, иначе тест снова доказывал бы не то.
  for (const [name, call] of EVERY_EXPORT) {
    it(`${name} отказывает роли вне списка выгрузки`, async () => {
      const prisma = makePrisma();
      const service = new ExportsService(prisma as never);

      await expect(call(service, userWith({ role: Role.DRIVER }))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.deal.findMany).not.toHaveBeenCalled();
      expect(prisma.deal.findFirst).not.toHaveBeenCalled();
      expect(prisma.evidenceFile.findMany).not.toHaveBeenCalled();
      expect(prisma.outboxEntry.findMany).not.toHaveBeenCalled();
    });
  }

  for (const [name, call] of EVERY_EXPORT) {
    it(`${name} пропускает роль из списка выгрузки`, async () => {
      // Обратная сторона: проверка не должна отказывать всем подряд, иначе
      // «всё закрыто» прошло бы как успех.
      const prisma = makePrisma();
      const service = new ExportsService(prisma as never);
      await call(service, userWith({ role: Role.COMPLIANCE_OFFICER })).catch((error: unknown) => {
        // Данных в моках нет, поэтому ForbiddenException «сделка не найдена»
        // здесь законен; недопустимо только «Export access denied».
        expect((error as Error).message).not.toContain('Export access denied');
      });
    });
  }
});
