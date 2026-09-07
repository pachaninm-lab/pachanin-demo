import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ComplianceService } from './compliance.service';
import { GenerateRegulatoryReportDto } from './dto/generate-regulatory-report.dto';
import { ResolveKycTaskDto } from './dto/resolve-kyc-task.dto';
import { BlockOrganizationDto } from './dto/block-organization.dto';
import { Role, type RequestUser } from '../../common/types/request-user';

/**
 * V2.2.1/V2.2.2 плюс вторая половина V1.3.3 на трёх телах compliance.
 *
 * Три тела объявлялись инлайн-типом, который стирается до Object, поэтому
 * ValidationPipe их не видел. Два из трёх несли настоящие дефекты, и они
 * замерены на живом сервисе ДО правки:
 *
 *   from: 'мусор'                  → RangeError: Invalid time value (500),
 *                                    и Invalid Date уходил в предикат Prisma
 *   from: 2026-12-31, to: 01-01    → принято молча, rowCount 0
 *   reportType: {}                 → TypeError: toLowerCase is not a function
 *   reportType: '../../etc/passwd' → reportId 'rpt-../../etc/passwd-…'
 *   status: 'ВЗЛОМАНО'             → записывалось в БД как есть
 *   status: 'approved'             → организация ПРИОСТАНОВЛЕНА, не одобрена
 *
 * Отказывают теперь и граница, и сервис: вызывающий в обход DTO не должен
 * уметь записать неизвестный статус или перевёрнутый период.
 */

const USER = { id: 'u1', role: Role.COMPLIANCE_OFFICER, orgId: 'o1', tenantId: 't1' } as RequestUser;

function service(captured: Record<string, unknown>[] = []) {
  const prisma = {
    deal: { findMany: async (args: Record<string, unknown>) => { captured.push(args); return []; } },
    kycTask: {
      findUnique: async () => ({ id: 'k1', organizationId: 'org-1' }),
      update: async (args: Record<string, unknown>) => { captured.push(args); return { id: 'k1', organizationId: 'org-1' }; },
    },
    organization: { update: async (args: Record<string, unknown>) => { captured.push(args); return {}; } },
  };
  return new ComplianceService(prisma as never, {} as never, { log: async () => undefined } as never);
}

async function errorsFor<T extends object>(cls: new () => T, payload: unknown): Promise<string[]> {
  const instance = plainToInstance(cls, payload);
  const result = await validate(instance as object, { whitelist: true, forbidNonWhitelisted: false });
  return result.flatMap((item) => Object.keys(item.constraints ?? {}));
}

describe('граница: регуляторный отчёт', () => {
  it('отвергает неразбираемую дату', async () => {
    expect(await errorsFor(GenerateRegulatoryReportDto, { reportType: 'FNS_QUARTERLY', from: 'мусор' })).toContain('isIso8601');
  });

  it('отвергает неизвестный тип отчёта', async () => {
    expect(await errorsFor(GenerateRegulatoryReportDto, { reportType: '../../etc/passwd' })).toContain('isIn');
  });

  it('отвергает тип отчёта, который не строка', async () => {
    expect(await errorsFor(GenerateRegulatoryReportDto, { reportType: { evil: 1 } })).toContain('isIn');
  });

  it('пропускает все четыре типа из каталога', async () => {
    for (const type of ['MINSELHHOZ_MONTHLY', 'ROSSTAT_QUARTERLY', 'FNS_QUARTERLY', 'ROSFINMONITORING_THRESHOLD']) {
      expect(await errorsFor(GenerateRegulatoryReportDto, { reportType: type })).toEqual([]);
    }
  });

  it('пропускает нормальный период', async () => {
    expect(await errorsFor(GenerateRegulatoryReportDto, {
      reportType: 'FNS_QUARTERLY', from: '2026-01-01', to: '2026-03-31',
    })).toEqual([]);
  });
});

describe('сервис: регуляторный отчёт отказывает и в обход границы', () => {
  it('неразбираемая дата — отказ, а не 500 и не запрос с Invalid Date', async () => {
    const captured: Record<string, unknown>[] = [];
    await expect(service(captured).generateRegulatoryReport('FNS_QUARTERLY', { from: 'мусор' }, USER))
      .rejects.toThrow(/разобрать как дату/u);
    expect(captured).toHaveLength(0);
  });

  it('перевёрнутый период — отказ, а не отчёт регулятору с нулём строк', async () => {
    const captured: Record<string, unknown>[] = [];
    await expect(service(captured).generateRegulatoryReport('FNS_QUARTERLY', { from: '2026-12-31', to: '2026-01-01' }, USER))
      .rejects.toThrow(/не может быть позже/u);
    expect(captured).toHaveLength(0);
  });

  it('неизвестный тип — отказ, а не идентификатор отчёта с ним внутри', async () => {
    await expect(service().generateRegulatoryReport('../../etc/passwd', {}, USER))
      .rejects.toThrow(/Неизвестный тип/u);
  });

  it('тип, который не строка, — отказ, а не TypeError', async () => {
    await expect(service().generateRegulatoryReport({ evil: 1 } as never, {}, USER))
      .rejects.toThrow(/Неизвестный тип/u);
  });

  it('нормальный вызов проходит и запрашивает ровно заданный период', async () => {
    const captured: Record<string, unknown>[] = [];
    const report = await service(captured).generateRegulatoryReport(
      'ROSSTAT_QUARTERLY', { from: '2026-01-01', to: '2026-03-31' }, USER,
    );
    expect(report.reportId).toMatch(/^rpt-rosstat_quarterly-\d+$/u);
    const where = captured[0]?.where as { createdAt: { gte: Date; lte: Date } };
    expect(where.createdAt.gte.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(where.createdAt.lte.toISOString()).toBe('2026-03-31T00:00:00.000Z');
  });

  it('период по умолчанию (ничего не передано) по-прежнему работает', async () => {
    const captured: Record<string, unknown>[] = [];
    const report = await service(captured).generateRegulatoryReport('FNS_QUARTERLY', {}, USER);
    expect(report.rowCount).toBe(0);
    const where = captured[0]?.where as { createdAt: { gte: Date; lte: Date } };
    expect(where.createdAt.gte.getTime()).toBeLessThan(where.createdAt.lte.getTime());
  });
});

describe('решение по задаче KYC', () => {
  it('граница отвергает статус вне союза, включая нижний регистр', async () => {
    expect(await errorsFor(ResolveKycTaskDto, { status: 'ВЗЛОМАНО' })).toContain('isIn');
    expect(await errorsFor(ResolveKycTaskDto, { status: 'approved' })).toContain('isIn');
    expect(await errorsFor(ResolveKycTaskDto, { status: 42 })).toContain('isIn');
  });

  it('граница пропускает оба настоящих решения', async () => {
    expect(await errorsFor(ResolveKycTaskDto, { status: 'APPROVED' })).toEqual([]);
    expect(await errorsFor(ResolveKycTaskDto, { status: 'REJECTED', notes: 'проверено' })).toEqual([]);
  });

  it('сервис не записывает произвольный статус в обход границы', async () => {
    const captured: Record<string, unknown>[] = [];
    await expect(service(captured).resolveKycTask('k1', { status: 'ВЗЛОМАНО' } as never, USER))
      .rejects.toThrow(/APPROVED или REJECTED/u);
    expect(captured).toHaveLength(0);
  });

  it("сервис не даёт 'approved' приостановить организацию вместо одобрения", async () => {
    const captured: Record<string, unknown>[] = [];
    await expect(service(captured).resolveKycTask('k1', { status: 'approved' } as never, USER))
      .rejects.toThrow(/APPROVED или REJECTED/u);
    expect(captured).toHaveLength(0);
  });

  it('настоящее одобрение проходит и ставит организации VERIFIED', async () => {
    const captured: Record<string, unknown>[] = [];
    await service(captured).resolveKycTask('k1', { status: 'APPROVED' }, USER);
    const org = captured.find((entry) => (entry.data as { status?: string })?.status === 'VERIFIED');
    expect(org).toBeDefined();
    expect((org?.data as { kycStatus?: string }).kycStatus).toBe('APPROVED');
  });
});

describe('причина блокировки организации', () => {
  it('пустая причина отвергается: запись блокировки без причины — не запись', async () => {
    expect(await errorsFor(BlockOrganizationDto, {})).toContain('isString');
    expect(await errorsFor(BlockOrganizationDto, { reason: '' })).toContain('isNotEmpty');
  });

  it('слишком длинная причина отвергается', async () => {
    expect(await errorsFor(BlockOrganizationDto, { reason: 'я'.repeat(1001) })).toContain('maxLength');
  });

  it('нормальная причина проходит', async () => {
    expect(await errorsFor(BlockOrganizationDto, { reason: 'Санкционный список' })).toEqual([]);
  });
});
