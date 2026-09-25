import { ExportsService } from './exports.service';
import { Role, type RequestUser } from '../../common/types/request-user';

/**
 * Отказавший запрос и пустой результат — разные вещи (#4839).
 *
 * Все шесть выгрузок читали базу через `.catch(() => [])` / `.catch(() => null)`.
 * Формально это «мягкая деградация», фактически — подмена: отказ базы
 * превращался в готовый артефакт, неотличимый от честного пустого.
 *
 *  - exportLedgerCsv отдавал заголовок без строк: CSV, утверждающий, что
 *    проводок по сделке нет.
 *  - exportRegulatoryReport отдавал отчётность за период с нулём операций и
 *    нулевой суммой — и уходил наружу, в МСХ, Росстат, ФНС, Росфинмониторинг.
 *  - exportOutboxStatus отдавал pending/sent/dead/failed = 0, то есть «очередь
 *    доставки чиста».
 *  - exportDealReport уходил в ветку «сделки нет» и возвращал
 *    chainIntegrity: { valid: true } — утверждение о целостности цепочки
 *    событий, которую он не читал.
 *
 * Ни один из этих артефактов не подписан как недостоверный, и вызывающий не
 * может отличить его от настоящего. Поэтому здесь проверяется, что отказ
 * доходит до вызывающего, а не подменяется чистым результатом.
 *
 * Каждый тест ниже падает, если соответствующий catch вернуть на место.
 */

const TENANT = 'tenant-A';
const DB_DOWN = new Error('connection refused');

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
      findFirst: jest.fn().mockResolvedValue({ id: 'deal-A', dealEvents: [] }),
    },
    ledgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
    evidenceFile: { findMany: jest.fn().mockResolvedValue([]) },
    outboxEntry: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('ExportsService — отказ базы доходит до вызывающего', () => {
  it('exportLedgerCsv не выдаёт пустой CSV вместо отказа', async () => {
    const prisma = makePrisma();
    prisma.deal.findFirst.mockResolvedValue({ id: 'deal-A' });
    prisma.ledgerEntry.findMany.mockRejectedValue(DB_DOWN);
    const service = new ExportsService(prisma as never);

    await expect(service.exportLedgerCsv('deal-A', userWith())).rejects.toThrow(DB_DOWN);
  });

  it('exportRegulatoryReport не выдаёт отчёт с нулём операций вместо отказа', async () => {
    // Худший из четырёх: этот артефакт покидает платформу и адресован
    // регулятору. «Ноль операций за период» — не пустой отчёт, а ложный.
    const prisma = makePrisma();
    prisma.deal.findMany.mockRejectedValue(DB_DOWN);
    const service = new ExportsService(prisma as never);

    await expect(
      service.exportRegulatoryReport(userWith(), { type: 'rosfinmonitoring' }),
    ).rejects.toThrow(DB_DOWN);
  });

  it('exportOutboxStatus не выдаёт нулевые счётчики вместо отказа', async () => {
    const prisma = makePrisma();
    prisma.deal.findMany.mockResolvedValue([{ id: 'deal-A' }]);
    prisma.outboxEntry.findMany.mockRejectedValue(DB_DOWN);
    const service = new ExportsService(prisma as never);

    await expect(service.exportOutboxStatus(userWith())).rejects.toThrow(DB_DOWN);
  });

  it('exportOutboxStatus не выдаёт нулевые счётчики и когда отказал запрос сделок', async () => {
    // Граница по сделкам — тоже чтение базы. Отказ на нём не должен
    // выродиться в «у тенанта нет сделок, значит очередь пуста».
    const prisma = makePrisma();
    prisma.deal.findMany.mockRejectedValue(DB_DOWN);
    const service = new ExportsService(prisma as never);

    await expect(service.exportOutboxStatus(userWith())).rejects.toThrow(DB_DOWN);
    expect(prisma.outboxEntry.findMany).not.toHaveBeenCalled();
  });

  it('exportDealReport не утверждает целостность цепочки по недоступной базе', async () => {
    const prisma = makePrisma();
    prisma.deal.findFirst.mockRejectedValue(DB_DOWN);
    const service = new ExportsService(prisma as never);

    await expect(service.exportDealReport('deal-A', userWith())).rejects.toThrow(DB_DOWN);
  });
});

describe('ExportsService — успешное чтение по-прежнему успешно', () => {
  /**
   * Обратная сторона. Без неё «всё падает всегда» прошло бы как успех: набор
   * выше проверяет только направление отказа.
   */
  it('exportLedgerCsv отдаёт заголовок, когда проводок действительно нет', async () => {
    const prisma = makePrisma();
    prisma.deal.findFirst.mockResolvedValue({ id: 'deal-A' });
    const service = new ExportsService(prisma as never);

    await expect(service.exportLedgerCsv('deal-A', userWith())).resolves.toContain('entryType');
  });

  it('exportRegulatoryReport отдаёт отчёт, когда сделок за период действительно нет', async () => {
    const prisma = makePrisma();
    const service = new ExportsService(prisma as never);

    await expect(
      service.exportRegulatoryReport(userWith(), { type: 'rosfinmonitoring' }),
    ).resolves.toMatchObject({ format: 'xml' });
  });

  it('exportOutboxStatus отдаёт нули, когда очередь действительно пуста', async () => {
    const prisma = makePrisma();
    prisma.deal.findMany.mockResolvedValue([{ id: 'deal-A' }]);
    const service = new ExportsService(prisma as never);

    await expect(service.exportOutboxStatus(userWith())).resolves.toMatchObject({
      pending: 0, sent: 0, dead: 0, failed: 0,
    });
  });

  it('exportDealReport сохраняет ветку «сделки нет», когда база ответила', async () => {
    // Ветка не схлопнута заодно с catch: отсутствующая сделка — законный
    // ответ базы, а не её отказ.
    const prisma = makePrisma();
    prisma.deal.findFirst.mockResolvedValue(null);
    const service = new ExportsService(prisma as never);

    const report = await service.exportDealReport('deal-missing', userWith());

    expect(report.sections.chainIntegrity).toMatchObject({ valid: true });
  });
});
