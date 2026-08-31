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
  ])('%s отказывает, когда тенанта у вызывающего нет', async (_name, call) => {
    // Не «читаем без границы, раз тенанта нет»: это и есть закрываемое чтение.
    const prisma = makePrisma();
    const service = new ExportsService(prisma as never);

    await expect(call(service, userWith({ tenantId: undefined }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.deal.findMany).not.toHaveBeenCalled();
    expect(prisma.deal.findFirst).not.toHaveBeenCalled();
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
