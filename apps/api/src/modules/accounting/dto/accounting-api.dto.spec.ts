import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';

import { evaluatePeriodOpen } from '../accounting-period.policy';
import { Capability } from '../../auth/membership-capability.resolver';
import {
  AdvanceAccountingPeriodDto,
  AllocatePaymentDto,
  AnswerReconciliationDto,
  ApplyAdvanceOffsetDto,
  PrepareReconciliationDto,
  ReverseDealServiceDto,
  CreateWorkTaskDto,
  DecideDealServiceDto,
  OpenAccountingPeriodDto,
  RecordAdvanceDto,
  RecordDealServiceDto,
  RecordPaymentDto,
  TransitionWorkTaskDto,
} from './accounting-api.dto';

/**
 * V2.2.1 / V2.2.2 — бухгалтерский контур.
 *
 * Пятнадцать обработчиков объявляли тело инлайн-типом. Инлайн-тип стирается до
 * `Object`, ValidationPipe пропускает параметр, чей metatype он не может
 * преобразовать, — значит глобальный пайп на этих маршрутах не проверял ничего.
 * Контроллер проверял сам, через integer(), instant(), text() и required(),
 * поэтому здесь именно сужение, а не спасение: большую часть полей уже
 * отвергали. Важно то, что не отвергали.
 *
 * Пайп берётся ровно той конфигурации, что в main.ts, иначе набор доказывал бы
 * поведение другого пайпа.
 */

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true });
const asBody = <T>(metatype: new () => T) => (value: unknown) =>
  pipe.transform(value, { type: 'body', metatype } as never);

const openPeriod = asBody(OpenAccountingPeriodDto);
const advancePeriod = asBody(AdvanceAccountingPeriodDto);
const transition = asBody(TransitionWorkTaskDto);
const createTask = asBody(CreateWorkTaskDto);
const recordAdvance = asBody(RecordAdvanceDto);
const applyOffset = asBody(ApplyAdvanceOffsetDto);
const recordService = asBody(RecordDealServiceDto);
const decideService = asBody(DecideDealServiceDto);
const recordPayment = asBody(RecordPaymentDto);
const allocatePayment = asBody(AllocatePaymentDto);
const answerReconciliation = asBody(AnswerReconciliationDto);
const prepareReconciliation = asBody(PrepareReconciliationDto);
const reverseService = asBody(ReverseDealServiceDto);

/**
 * Дефект, ради которого это писалось, а не счётчик покрытия.
 *
 * Девять мест разбирали дату как `new Date(body.field)` без instant(). Неразбор
 * там не ошибка, а `Invalid Date`, у которой getTime() равен NaN. Любое
 * сравнение с NaN ложно, поэтому охрана, написанная как сравнение, не
 * отказывает — она просто не срабатывает.
 */
describe('Invalid Date — то, что охрана периода не ловила', () => {
  const capabilities = [Capability.ACCOUNTING_PACKAGE_CLOSE];

  it('политика открытия периода пропускает окно из двух Invalid Date', () => {
    // Ровно то, что делал контроллер: new Date(body.periodStart) без проверки.
    const decision = evaluatePeriodOpen({
      periodStart: new Date('не дата'),
      periodEnd: new Date('тоже не дата'),
      existing: [],
      actorCapabilities: capabilities,
    });
    // WINDOW_IS_EMPTY не поднимается: NaN <= NaN ложно.
    expect(decision.permitted).toBe(true);
    expect(decision.refusals).toEqual([]);
  });

  it('и пересечение с существующим периодом тоже не поднимается', () => {
    const decision = evaluatePeriodOpen({
      periodStart: new Date('не дата'),
      periodEnd: new Date('не дата'),
      existing: [
        {
          id: 'p1',
          periodStart: new Date('2026-01-01T00:00:00.000Z'),
          periodEnd: new Date('2026-02-01T00:00:00.000Z'),
          status: 'OPEN',
          version: 1n,
        } as never,
      ],
      actorCapabilities: capabilities,
    });
    // Оба сравнения перекрытия — против NaN, оба ложны.
    expect(decision.refusals).not.toContain('WINDOW_OVERLAPS');
    expect(decision.permitted).toBe(true);
  });

  // По одному полю за раз. Проверка, где неверны оба конца, зелена и тогда,
  // когда связан лишь один из них: любого отказа хватает, чтобы тело было
  // отвергнуто. Мутация это и показала — снятие @IsISO8601 с periodStart не
  // уронило набор.
  it('periodStart отвергается на двери сам по себе', async () => {
    await expect(
      openPeriod({ periodStart: 'не дата', periodEnd: '2026-04-01T00:00:00.000Z' }),
    ).rejects.toThrow();
  });

  it('periodEnd отвергается на двери сам по себе', async () => {
    await expect(
      openPeriod({ periodStart: '2026-03-01T00:00:00.000Z', periodEnd: 'тоже не дата' }),
    ).rejects.toThrow();
  });

  it('корректное окно по-прежнему проходит', async () => {
    await expect(
      openPeriod({ periodStart: '2026-03-01T00:00:00.000Z', periodEnd: '2026-04-01T00:00:00.000Z' }),
    ).resolves.toMatchObject({ periodStart: '2026-03-01T00:00:00.000Z' });
  });

  // Каждый случай — одно испорченное поле в теле, во всём остальном валидном,
  // и рядом то же тело целиком валидным. Иначе отказ доказывал бы лишь то, что
  // тело отвергнуто, а не то, что связано именно это поле.
  const GOOD = '2026-03-01T00:00:00.000Z';
  const bodies: Record<string, [(value: unknown) => Promise<unknown>, string, Record<string, unknown>]> = {
    'recordAdvance.receivedAt': [recordAdvance, 'receivedAt', {
      dealId: 'd', counterpartyOrgId: 'o', amountKopecks: '100', bankOperationId: 'b',
    }],
    'applyAdvanceOffset.appliedAt': [applyOffset, 'appliedAt', {
      amountKopecks: '100', reason: 'r', idempotencyKey: 'k',
    }],
    'recordService.renderedAt': [recordService, 'renderedAt', {
      dealId: 'd', counterpartyOrgId: 'o', kind: 'STORAGE', quantityMilliUnits: '1',
      rateKopecks: '1', idempotencyKey: 'k',
    }],
    'recordService.periodFrom': [recordService, 'periodFrom', {
      dealId: 'd', counterpartyOrgId: 'o', kind: 'STORAGE', quantityMilliUnits: '1',
      rateKopecks: '1', renderedAt: GOOD, idempotencyKey: 'k',
    }],
    'recordPayment.paidAt': [recordPayment, 'paidAt', {
      dealId: 'd', counterpartyOrgId: 'o', direction: 'INCOMING', amountKopecks: '100',
      bankOperationId: 'b', idempotencyKey: 'k',
    }],
    'allocatePayment.allocatedAt': [allocatePayment, 'allocatedAt', {
      amountKopecks: '100', reason: 'r', idempotencyKey: 'k',
    }],
    'createTask.deadlineAt': [createTask, 'deadlineAt', {
      title: 't', humanDescription: 'h',
    }],
    // Отмена услуги — единственный оставшийся new Date() без instant().
    'reverseService.renderedAt': [reverseService, 'renderedAt', {
      idempotencyKey: 'k',
    }],
    // Сверка свои даты уже проверяла через instant()+required(); DTO переносит
    // тот же отказ к двери, и он тоже должен быть связан по полю.
    'prepareReconciliation.periodStart': [prepareReconciliation, 'periodStart', {
      dealId: 'd', counterpartyOrgId: 'o', periodEnd: GOOD,
    }],
    'prepareReconciliation.periodEnd': [prepareReconciliation, 'periodEnd', {
      dealId: 'd', counterpartyOrgId: 'o', periodStart: GOOD,
    }],
  };

  it.each(Object.keys(bodies))('%s больше не становится Invalid Date', async (name) => {
    const [call, field, rest] = bodies[name];
    await expect(call({ ...rest, [field]: 'вчера' })).rejects.toThrow();
    // И то же тело с разбираемой датой проходит, иначе отказ мог бы быть о чём угодно.
    await expect(call({ ...rest, [field]: GOOD })).resolves.toBeDefined();
  });
});

describe('перечисления — произвольная строка больше не доходит до записи', () => {
  it('статус задачи проверяется по списку политики', async () => {
    await expect(transition({ to: 'НЕ_СТАТУС', expectedVersion: '1' })).rejects.toThrow();
    await expect(transition({ to: 'RESOLVED', expectedVersion: '1' })).resolves.toMatchObject({ to: 'RESOLVED' });
  });

  it('статус периода тоже', async () => {
    await expect(advancePeriod({ to: 'ОТКРЫТ', expectedVersion: '1' })).rejects.toThrow();
    await expect(advancePeriod({ to: 'CLOSING', expectedVersion: '1' })).resolves.toMatchObject({ to: 'CLOSING' });
  });

  it('вид услуги — из ServiceKind, а не любое слово', async () => {
    const body = {
      dealId: 'd', counterpartyOrgId: 'o', quantityMilliUnits: '1',
      rateKopecks: '1', renderedAt: '2026-03-01T00:00:00.000Z', idempotencyKey: 'k',
    };
    await expect(recordService({ ...body, kind: 'ХРАНЕНИЕ' })).rejects.toThrow();
    await expect(recordService({ ...body, kind: 'STORAGE' })).resolves.toMatchObject({ kind: 'STORAGE' });
  });

  it('направление платежа — только INCOMING или OUTGOING', async () => {
    const body = {
      dealId: 'd', counterpartyOrgId: 'o', amountKopecks: '100',
      bankOperationId: 'b', paidAt: '2026-03-01T00:00:00.000Z', idempotencyKey: 'k',
    };
    await expect(recordPayment({ ...body, direction: 'ВХОДЯЩИЙ' })).rejects.toThrow();
    await expect(recordPayment({ ...body, direction: 'OUTGOING' })).resolves.toMatchObject({ direction: 'OUTGOING' });
  });

  // Решение по услуге и ответ по сверке уже отвергались — контроллером и
  // политикой соответственно. DTO переносит отказ к двери, а не добавляет его.
  it('решение по услуге не принимает возврат в RENDERED', async () => {
    await expect(decideService({ intended: 'RENDERED' })).rejects.toThrow();
    await expect(decideService({ intended: 'APPROVED' })).resolves.toMatchObject({ intended: 'APPROVED' });
  });

  it('ответ по сверке не принимает возврат в PREPARED', async () => {
    await expect(answerReconciliation({ intended: 'PREPARED' })).rejects.toThrow();
    await expect(answerReconciliation({ intended: 'DISPUTED' })).resolves.toMatchObject({ intended: 'DISPUTED' });
  });
});

describe('деньги и валюта — по тем же правилам, что уже действуют ниже', () => {
  const advance = {
    dealId: 'd', counterpartyOrgId: 'o', bankOperationId: 'b',
    receivedAt: '2026-03-01T00:00:00.000Z',
  };

  it.each(['12.5', '1e3', 'двенадцать', '', ' 12'])(
    'amountKopecks отвергается: %p — это не целое из integer()',
    async (amountKopecks) => {
      await expect(recordAdvance({ ...advance, amountKopecks })).rejects.toThrow();
    },
  );

  it('отрицательная сумма проходит пайп: знак решает политика, не форма', async () => {
    await expect(recordAdvance({ ...advance, amountKopecks: '-100' })).resolves.toMatchObject({
      amountKopecks: '-100',
    });
  });

  it('валюта — три заглавные буквы, как требует settlement_payment_currency_check', async () => {
    await expect(recordAdvance({ ...advance, amountKopecks: '1', currency: 'руб' })).rejects.toThrow();
    await expect(recordAdvance({ ...advance, amountKopecks: '1', currency: 'RUBLE' })).rejects.toThrow();
    await expect(recordAdvance({ ...advance, amountKopecks: '1', currency: 'USD' })).resolves.toMatchObject({
      currency: 'USD',
    });
  });

  it('валюта необязательна: поле остаётся неопределённым, контроллер подставляет RUB', async () => {
    const result = await recordAdvance({ ...advance, amountKopecks: '1' });
    expect(result.currency).toBeUndefined();
    // Ровно то, что делает контроллер с этим значением.
    expect(result.currency ?? 'RUB').toBe('RUB');
  });
});

describe('строки — то, что раньше доходило нестрокой', () => {
  it('заголовок задачи объектом больше не превращается в пустую строку', async () => {
    // Замерено до правки: body.title ?? '' пропускало любой не-null.
    await expect(createTask({ title: { toString: 'нет' }, humanDescription: 'h' })).rejects.toThrow();
    await expect(createTask({ title: 42, humanDescription: 'h' })).rejects.toThrow();
  });

  it('обязательные поля обязательны', async () => {
    await expect(createTask({ humanDescription: 'h' })).rejects.toThrow();
    await expect(createTask({ title: 't' })).rejects.toThrow();
  });

  it('необязательные остаются необязательными', async () => {
    await expect(createTask({ title: 't', humanDescription: 'h' })).resolves.toMatchObject({ title: 't' });
  });

  it('whitelist убирает поле, которого нет в DTO', async () => {
    const result = await createTask({ title: 't', humanDescription: 'h', organizationId: 'чужая' });
    expect(result).not.toHaveProperty('organizationId');
  });
});
