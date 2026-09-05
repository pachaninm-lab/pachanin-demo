import { ForbiddenException } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { Role, type RequestUser } from '../../common/types/request-user';

/**
 * generateRegulatoryReport собирал отчёт по сделкам ВСЕЙ платформы (#4839).
 *
 * Доказательство — не рассуждение, а расхождение внутри самого репозитория:
 * exports.service.ts делает ровно тот же артефакт (exportRegulatoryReport, те
 * же четыре формы — МСХ, Росстат, ФНС, Росфинмониторинг) и ограничен тенантом
 * для тех же COMPLIANCE_OFFICER и ADMIN. Один класс отчёта, один набор ролей,
 * две разные границы.
 *
 * Область проверки узкая и названа прямо: здесь про чтение СДЕЛОК. Остальные
 * чтения сервиса — очередь KYC, журнал аудита, санкционные флаги, организации —
 * идут по другим таблицам, их границы этим набором не заявляются и не
 * закрываются. Измеренный остаток записан в #4839.
 */

const TENANT = 'tenant-A';
const DB_DOWN = new Error('connection refused');

function userWith(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 'u-1',
    orgId: 'org-1',
    role: Role.COMPLIANCE_OFFICER,
    email: 'compliance@example.test',
    tenantId: TENANT,
    ...overrides,
  };
}

function makeService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    deal: { findMany: jest.fn().mockResolvedValue([]) },
    ...prismaOverrides,
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const executor = { execute: jest.fn() };
  return {
    prisma,
    audit,
    service: new ComplianceService(prisma as never, executor as never, audit as never),
  };
}

describe('ComplianceService — отчёт регулятору ограничен тенантом', () => {
  it('фильтрует сделки по тенанту вызывающего', async () => {
    const { prisma, service } = makeService();

    await service.generateRegulatoryReport('ROSSTAT_QUARTERLY', {}, userWith());

    expect(prisma.deal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT }) }),
    );
  });

  it('отказывает, когда тенанта у вызывающего нет', async () => {
    // Не «читаем без границы, раз тенанта нет»: это и есть закрываемое чтение.
    const { prisma, service } = makeService();

    await expect(
      service.generateRegulatoryReport('FNS_QUARTERLY', {}, userWith({ tenantId: undefined })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.deal.findMany).not.toHaveBeenCalled();
  });

  it('роль проверяется раньше тенанта', async () => {
    const { service } = makeService();

    await expect(
      service.generateRegulatoryReport('FNS_QUARTERLY', {}, userWith({
        role: Role.DRIVER,
        tenantId: undefined,
      })),
    ).rejects.toThrow('Compliance cockpit requires COMPLIANCE_OFFICER or ADMIN role');
  });

  it('не выдаёт отчёт с rowCount 0 вместо отказа базы', async () => {
    // С .catch(() => []) отказ базы давал донесение регулятору за период «без
    // операций», ничем не помеченное как недостоверное.
    const { prisma, service } = makeService();
    (prisma.deal.findMany as jest.Mock).mockRejectedValue(DB_DOWN);

    await expect(
      service.generateRegulatoryReport('ROSFINMONITORING_THRESHOLD', {}, userWith()),
    ).rejects.toThrow(DB_DOWN);
  });

  it('пустой период по-прежнему даёт отчёт, а не отказ', async () => {
    // Обратная сторона: «всегда падаем» не должно проходить как успех.
    const { service } = makeService();

    await expect(
      service.generateRegulatoryReport('MINSELHHOZ_MONTHLY', {}, userWith({ role: Role.ADMIN })),
    ).resolves.toMatchObject({ rowCount: 0, type: 'MINSELHHOZ_MONTHLY' });
  });
});
