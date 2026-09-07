import 'reflect-metadata';
import { BadRequestException, ForbiddenException, ValidationPipe } from '@nestjs/common';
import { CreateFactoringApplicationDto } from './dto/factoring.dto';
import { FactoringService } from './factoring.service';
import {
  ALLOWED_FACTORS,
  FACTORING_AMOUNT_MAX_KOPECKS,
  FACTORING_AMOUNT_MIN_KOPECKS,
  isAllowedFactor,
  isUsableAmountKopecks,
} from './factoring.contract';
import { RequestUser, Role } from '../../common/types/request-user';

/**
 * Граница заявки на факторинг.
 *
 * Замерено на живом сервисе ДО правки — каждый из этих входов доходил до
 * статуса APPROVED со ставкой 8.5%:
 *
 *   -50 000 000 коп → approvedAmountKopecks: -50000000   (одобрение минуса)
 *   NaN             → approvedAmountKopecks: null        (одобрение без суммы)
 *   Infinity        → approvedAmountKopecks: null        (то же)
 *   '1000' строкой  → approvedAmountKopecks: 1000        (молчаливое приведение)
 *   1e308           → approvedAmountKopecks: 1e+308
 *   null            → approvedAmountKopecks: 0           (одобрение нуля)
 */

// Тот же конвейер, что и глобальный в main.ts.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true });
const meta = { type: 'body' as const, metatype: CreateFactoringApplicationDto };

const user = { id: 'u1', role: Role.ACCOUNTING, tenantId: 't1' } as unknown as RequestUser;
const validBody = {
  dealId: 'D-1',
  organizationId: 'ORG-1',
  factorName: 'Сбербанк Факторинг',
  requestedAmountKopecks: 500_000_00,
};

describe('CreateFactoringApplicationDto — граница', () => {
  it('пропускает настоящую заявку', async () => {
    await expect(pipe.transform({ ...validBody }, meta)).resolves.toMatchObject(validBody);
  });

  it.each([
    ['минус', -500_000_00],
    ['ноль', 0],
    ['дробь', 1234.5],
    ['строка', '1000'],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['1e308', 1e308],
    ['null', null],
    ['выше потолка', FACTORING_AMOUNT_MAX_KOPECKS + 1],
  ])('отвергает сумму: %s', async (_label, amount) => {
    await expect(
      pipe.transform({ ...validBody, requestedAmountKopecks: amount }, meta),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('принимает ровно границы диапазона', async () => {
    for (const amount of [FACTORING_AMOUNT_MIN_KOPECKS, FACTORING_AMOUNT_MAX_KOPECKS]) {
      await expect(
        pipe.transform({ ...validBody, requestedAmountKopecks: amount }, meta),
      ).resolves.toMatchObject({ requestedAmountKopecks: amount });
    }
  });

  it('отвергает неподключённого фактора', async () => {
    await expect(
      pipe.transform({ ...validBody, factorName: 'Банк из ниоткуда' }, meta),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('принимает каждого подключённого фактора', async () => {
    for (const factorName of ALLOWED_FACTORS) {
      await expect(pipe.transform({ ...validBody, factorName }, meta)).resolves.toMatchObject({ factorName });
    }
  });

  it.each([['dealId'], ['organizationId']])('отвергает пустой %s', async (field) => {
    await expect(pipe.transform({ ...validBody, [field]: '' }, meta)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('срезает поле, которого нет в DTO', async () => {
    const out = (await pipe.transform(
      { ...validBody, approvedAmountKopecks: 999_999_999 },
      meta,
    )) as Record<string, unknown>;
    expect(out).not.toHaveProperty('approvedAmountKopecks');
  });
});

describe('FactoringService — отказ без границы', () => {
  /**
   * Сервис проверяет сам. Это не дублирование DTO ради симметрии: вызов
   * приходит и не из контроллера, а запись заявки — деньги.
   */
  it.each([
    ['минус', -500_000_00],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['строка', '1000'],
    ['null', null],
    ['дробь', 1234.5],
    ['выше потолка', FACTORING_AMOUNT_MAX_KOPECKS + 1],
  ])('отказывает в обход границы: %s', async (_label, amount) => {
    const svc = new FactoringService();
    await expect(
      svc.createApplication({ ...validBody, requestedAmountKopecks: amount as number }, user),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('настоящая заявка по-прежнему одобряется и считает сумму', async () => {
    const svc = new FactoringService();
    const app = await svc.createApplication({ ...validBody }, user);
    expect(app.status).toBe('APPROVED');
    expect(Number.isInteger(app.approvedAmountKopecks)).toBe(true);
    expect(app.approvedAmountKopecks).toBeGreaterThan(0);
    expect(app.approvedAmountKopecks).toBeLessThanOrEqual(validBody.requestedAmountKopecks);
  });

  it('неподключённый фактор по-прежнему отвергается', async () => {
    const svc = new FactoringService();
    await expect(
      svc.createApplication({ ...validBody, factorName: 'Банк из ниоткуда' }, user),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('factoring.contract — сторожа', () => {
  it('isUsableAmountKopecks отвергает унаследованные ключи и нечисла', () => {
    for (const bad of [null, undefined, '1000', Number.NaN, Number.POSITIVE_INFINITY, -1, 0, 1.5, {}, []]) {
      expect(isUsableAmountKopecks(bad)).toBe(false);
    }
    expect(isUsableAmountKopecks(FACTORING_AMOUNT_MIN_KOPECKS)).toBe(true);
    expect(isUsableAmountKopecks(FACTORING_AMOUNT_MAX_KOPECKS)).toBe(true);
  });

  it('isAllowedFactor не пропускает члена прототипа', () => {
    for (const bad of ['toString', 'constructor', '__proto__', 'valueOf', 'hasOwnProperty']) {
      expect(isAllowedFactor(bad)).toBe(false);
    }
    for (const good of ALLOWED_FACTORS) {
      expect(isAllowedFactor(good)).toBe(true);
    }
  });

  it('список факторов заморожен', () => {
    expect(Object.isFrozen(ALLOWED_FACTORS)).toBe(true);
  });
});
