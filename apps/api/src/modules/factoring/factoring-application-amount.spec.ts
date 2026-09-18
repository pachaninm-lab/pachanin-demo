import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { FactoringService } from './factoring.service';
import { CreateFactoringApplicationDto } from './dto/create-factoring-application.dto';
import { RequestUser, Role } from '../../common/types/request-user';

const user = { id: 'u1', role: Role.ADMIN, organizationId: 'org-1', tenantId: 't-1' } as unknown as RequestUser;
const FACTOR = 'Сбербанк Факторинг';

function build() {
  const service = new FactoringService();
  // Скоринг ходит в БД; подменяем его, чтобы измерять именно обработку суммы.
  (service as unknown as { scoreOrganization: unknown }).scoreOrganization = async () => ({ score: 90, details: {} });
  return service;
}

async function refuses(amount: unknown): Promise<string> {
  const service = build();
  try {
    await service.createApplication(
      { dealId: 'd1', organizationId: 'org-1', factorName: FACTOR, requestedAmountKopecks: amount as number },
      user,
    );
  } catch (error) {
    if (!(error instanceof BadRequestException)) throw error;
    const response = error.getResponse() as { message?: string } | string;
    return typeof response === 'string' ? response : String(response.message ?? '');
  }
  throw new Error(`Ожидался отказ, но заявка прошла: ${String(amount)}`);
}

const dtoErrors = (body: unknown) =>
  validateSync(plainToInstance(CreateFactoringApplicationDto, body)).flatMap((e) => Object.values(e.constraints ?? {}));

const withAmount = (requestedAmountKopecks: unknown) => ({
  dealId: 'd1', organizationId: 'org-1', factorName: FACTOR, requestedAmountKopecks,
});

describe('Сумма заявки на факторинг: замеренные дефекты', () => {
  // До исправления КАЖДЫЙ из этих входов давал статус APPROVED.

  it('NaN давал одобренную заявку, у которой в JSON сумма null', async () => {
    expect(await refuses(Number.NaN)).toContain('целым числом копеек');
    expect(dtoErrors(withAmount(Number.NaN))).not.toHaveLength(0);
  });

  it('опущенная сумма давала то же самое', async () => {
    expect(await refuses(undefined)).toContain('целым числом копеек');
    expect(dtoErrors(withAmount(undefined))).not.toHaveLength(0);
  });

  it('Infinity давал одобрение с null в JSON', async () => {
    expect(await refuses(Number.POSITIVE_INFINITY)).toContain('целым числом копеек');
  });

  it('отрицательная сумма одобрялась как есть', async () => {
    expect(await refuses(-1_000_000)).toContain('положительной');
    expect(dtoErrors(withAmount(-1_000_000))).not.toHaveLength(0);
  });

  it('ноль — не сумма финансирования', async () => {
    expect(await refuses(0)).toContain('положительной');
  });

  it('1e300 одобрялось на сумму, которой не существует', async () => {
    expect(await refuses(1e300)).toContain('точного целочисленного представления');
  });

  it('строка проходила молча — @Type(() => Number) здесь нет намеренно', async () => {
    expect(await refuses('1000000')).toContain('целым числом копеек');
    expect(dtoErrors(withAmount('1000000'))).not.toHaveLength(0);
  });

  it('объект с valueOf приводился к числу и проходил', async () => {
    expect(await refuses({ valueOf: () => 5 })).toContain('целым числом копеек');
  });

  it('дробная сумма — не целые копейки', async () => {
    expect(await refuses(1000.5)).toContain('целым числом копеек');
  });
});

describe('Сумма заявки на факторинг: обратная сторона', () => {
  it('нормальная заявка проходит и одобряется на запрошенную сумму', async () => {
    const app = await build().createApplication(
      { dealId: 'd1', organizationId: 'org-1', factorName: FACTOR, requestedAmountKopecks: 1_000_000 },
      user,
    );
    expect(app.status).toBe('APPROVED');
    expect(app.approvedAmountKopecks).toBe(1_000_000);
  });

  it('одна копейка — законная сумма', async () => {
    const app = await build().createApplication(
      { dealId: 'd1', organizationId: 'org-1', factorName: FACTOR, requestedAmountKopecks: 1 },
      user,
    );
    expect(app.status).toBe('APPROVED');
  });

  it('полное тело проходит проверку границы', () => {
    expect(dtoErrors(withAmount(1_000_000))).toHaveLength(0);
  });

  it('пустые идентификаторы отклоняются границей', () => {
    expect(dtoErrors({ ...withAmount(1_000_000), dealId: '' })).not.toHaveLength(0);
    expect(dtoErrors({ ...withAmount(1_000_000), organizationId: 123 })).not.toHaveLength(0);
    expect(dtoErrors({ ...withAmount(1_000_000), factorName: null })).not.toHaveLength(0);
  });
});
