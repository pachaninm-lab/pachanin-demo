import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  CalculateDemurrageDto,
  CreateGU12Dto,
  RegisterWagonDto,
  UpdateWagonStatusDto,
} from './dto/railway.dto';
import { RailwayController } from './railway.controller';
import { RailwayService } from './railway.service';

/**
 * V2.2.1 / V2.2.2 — граница запроса железнодорожного модуля.
 *
 * Четыре обработчика объявляли тело инлайн-типом, который стирается до
 * `Object`. Но пропущенная проверка была здесь не главным: тело уходило в
 * сервис россыпью, а сервис строил запись как `{ id: randomUUID(), ...dto }`,
 * поэтому присланный клиентом `id` побеждал сгенерированный.
 *
 * Состояние модуля живёт в Map в памяти процесса, не в PostgreSQL. Это не
 * повреждение базы, и выдавать его за таковое нельзя — но и не безобидно:
 * listWagons фильтрует по ownerOrgId, поэтому переписанный вагон исчезает из
 * списка своего владельца и появляется у вызывающего.
 */

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true });

async function accept<T>(metatype: new () => T, payload: unknown): Promise<T> {
  return (await pipe.transform(payload, { type: 'body', metatype } as never)) as T;
}

async function reject(metatype: new () => unknown, payload: unknown): Promise<string> {
  try {
    await pipe.transform(payload, { type: 'body', metatype } as never);
  } catch (error) {
    if (error instanceof BadRequestException) return JSON.stringify(error.getResponse());
    return `${(error as Error).constructor.name}: ${(error as Error).message}`;
  }
  throw new Error(`ожидался отказ, но тело прошло: ${JSON.stringify(payload)}`);
}

describe('каждое тело объявлено классом, а не инлайн-типом', () => {
  const code = readFileSync(join(__dirname, 'railway.controller.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/^\s*\/\/.*$/gmu, '');

  it('инлайн-тел в контроллере не осталось', () => {
    expect(code).not.toMatch(/@Body\(\)\s+body:\s*\{/u);
  });

  it('тело больше не рассыпается в сервис', () => {
    expect(code).not.toContain('...body');
  });

  it.each([
    ['registerWagon', RegisterWagonDto],
    ['updateWagonStatus', UpdateWagonStatusDto],
    ['createGU12', CreateGU12Dto],
    ['calculateDemurrage', CalculateDemurrageDto],
  ])('%s несёт класс DTO в метаданных маршрута', (method, dto) => {
    const types = Reflect.getMetadata('design:paramtypes', RailwayController.prototype, method) as unknown[];
    const args = Reflect.getMetadata('__routeArguments__', RailwayController, method) as Record<string, { index: number }>;
    const bodyKey = Object.keys(args).find((key) => key.startsWith('3:'));
    expect(bodyKey).toBeDefined();
    expect(types[args[bodyKey as string]?.index as number]).toBe(dto);
  });
});

/**
 * Замерено ДО исправления: тело с чужим `id` переписывало существующий вагон
 * на месте — число вагонов оставалось 3, номер менялся 52000001 → 99999999,
 * владелец org-logistics-001 → org-attacker. Проверка дубля по номеру не
 * срабатывала, потому что номер был другой.
 */
describe('присвоение чужого вагона через id в теле', () => {
  it('whitelist срезает id на границе: у поля нет ни одного декоратора', async () => {
    const result = await accept(RegisterWagonDto, {
      wagonNumber: '99999999', type: 'HOPPER', capacityTons: 10, id: 'чужой-идентификатор',
    });
    expect(result).not.toHaveProperty('id');
  });

  it('сервис больше не даёт присланному id победить сгенерированный', () => {
    const railway = new RailwayService();
    const victim = railway.listWagons()[0];
    expect(victim).toBeDefined();
    const created = railway.registerWagon({
      wagonNumber: '99999999', type: 'HOPPER', capacityTons: 10, ownerOrgId: 'org-attacker',
      id: victim?.id,
    } as never);

    expect(created.id).not.toBe(victim?.id);
    const after = railway.listWagons();
    expect(after).toHaveLength(4);
    const survivor = after.find((wagon) => wagon.id === victim?.id);
    expect(survivor?.wagonNumber).toBe(victim?.wagonNumber);
    expect(survivor?.ownerOrgId).toBe(victim?.ownerOrgId);
  });

  it('вагон остаётся в списке своего владельца, а не уезжает к вызывающему', () => {
    const railway = new RailwayService();
    const victim = railway.listWagons()[0];
    railway.registerWagon({
      wagonNumber: '99999999', type: 'HOPPER', capacityTons: 10, ownerOrgId: 'org-attacker',
      id: victim?.id,
    } as never);
    expect(railway.listWagons(victim?.ownerOrgId).some((w) => w.id === victim?.id)).toBe(true);
    expect(railway.listWagons('org-attacker').some((w) => w.id === victim?.id)).toBe(false);
  });
});

describe('регистрация вагона', () => {
  it('то, что описывает демонстрационный парк, проходит', async () => {
    await expect(accept(RegisterWagonDto, { wagonNumber: '52000001', type: 'HOPPER', capacityTons: 68 }))
      .resolves.toMatchObject({ wagonNumber: '52000001', type: 'HOPPER' });
  });

  it('номер не из восьми цифр отклоняется', async () => {
    expect(await reject(RegisterWagonDto, { wagonNumber: '520', type: 'HOPPER', capacityTons: 68 })).toContain('wagonNumber');
    expect(await reject(RegisterWagonDto, { wagonNumber: 'ABCDEFGH', type: 'HOPPER', capacityTons: 68 })).toContain('wagonNumber');
  });

  it('неизвестный тип вагона отклоняется', async () => {
    expect(await reject(RegisterWagonDto, { wagonNumber: '52000001', type: 'ЦИСТЕРНА', capacityTons: 68 })).toContain('type');
  });

  it('строка вместо грузоподъёмности отклоняется, а не приводится молча', async () => {
    expect(await reject(RegisterWagonDto, { wagonNumber: '52000001', type: 'HOPPER', capacityTons: '68' })).toContain('capacityTons');
  });

  it('ноль, отрицательная и невозможная грузоподъёмность отклоняются', async () => {
    for (const capacityTons of [0, -68, 100_000]) {
      expect(await reject(RegisterWagonDto, { wagonNumber: '52000001', type: 'HOPPER', capacityTons })).toContain('capacityTons');
    }
  });

  /**
   * Проверяется свойство, а не декоратор. Замерено прогоном мутаций: при
   * наличии `@Min`/`@Max` снятие `@IsNumber()` не роняет ничего — `@Min`
   * сравнивает через `>=`, и NaN, Infinity и строка не проходят его сами по
   * себе. `@IsNumber()` оставлен как заявление о намерении и как страховка на
   * случай ослабления диапазона, но выдавать его за несущую проверку нельзя.
   */
  it('NaN и бесконечность не проходят как грузоподъёмность', async () => {
    for (const capacityTons of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(await reject(RegisterWagonDto, { wagonNumber: '52000001', type: 'HOPPER', capacityTons })).toContain('capacityTons');
    }
  });
});

describe('смена статуса вагона', () => {
  it('настоящий статус проходит', async () => {
    await expect(accept(UpdateWagonStatusDto, { status: 'IN_TRANSIT' })).resolves.toMatchObject({ status: 'IN_TRANSIT' });
  });

  it('произвольный статус отклоняется', async () => {
    expect(await reject(UpdateWagonStatusDto, { status: 'СВОБОДЕН' })).toContain('status');
  });
});

describe('заявка ГУ-12', () => {
  const valid = {
    dealId: 'deal-1', wagonIds: ['w-1', 'w-2'], departureStation: 'Лиски',
    destinationStation: 'Новороссийск', cargo: 'Пшеница 4 класс', volumeTons: 136,
    requestedDepartureAt: '2026-09-10T06:00:00.000Z',
  };

  it('заполненная заявка проходит', async () => {
    await expect(accept(CreateGU12Dto, valid)).resolves.toMatchObject({ dealId: 'deal-1' });
  });

  it('заявка без вагонов отклоняется', async () => {
    expect(await reject(CreateGU12Dto, { ...valid, wagonIds: [] })).toContain('wagonIds');
  });

  it('строка вместо списка вагонов отклоняется', async () => {
    expect(await reject(CreateGU12Dto, { ...valid, wagonIds: 'w-1' })).toContain('wagonIds');
  });

  it('неразбираемая дата отправления отклоняется', async () => {
    expect(await reject(CreateGU12Dto, { ...valid, requestedDepartureAt: 'завтра' })).toContain('requestedDepartureAt');
  });

  it('несуществующая дата отклоняется строгим режимом', async () => {
    expect(await reject(CreateGU12Dto, { ...valid, requestedDepartureAt: '2026-02-31T00:00:00.000Z' })).toContain('requestedDepartureAt');
  });
});

/**
 * Замерено ДО исправления: `arrivedAt: 'мусор'` давало
 * `detainedHours: NaN`, `totalKopecks: NaN`, а в JSON — `{"totalKopecks":null}`.
 */
describe('расчёт демереджа — это деньги', () => {
  const valid = {
    wagonId: 'w-1', arrivedAt: '2026-09-01T00:00:00.000Z',
    unloadingCompletedAt: '2026-09-03T00:00:00.000Z',
  };

  it('нормальный расчёт проходит и даёт конечное число', async () => {
    await expect(accept(CalculateDemurrageDto, valid)).resolves.toBeDefined();
    const record = new RailwayService().calculateDemurrage(valid);
    expect(Number.isFinite(record.totalKopecks)).toBe(true);
    expect(record.totalKopecks).toBeGreaterThan(0);
  });

  it('неразбираемая дата отклоняется на границе', async () => {
    expect(await reject(CalculateDemurrageDto, { ...valid, arrivedAt: 'мусор' })).toContain('arrivedAt');
  });

  /**
   * Прогон мутаций поймал дырку в проверке выше: «мусор» отклоняет и нестрогий
   * режим, поэтому снятие `{ strict: true }` ничего не роняло. Строгость видна
   * только на дате, которая разбирается, но не существует.
   */
  it('несуществующая дата отклоняется — именно это и делает строгий режим', async () => {
    expect(await reject(CalculateDemurrageDto, { ...valid, arrivedAt: '2026-02-31T00:00:00.000Z' })).toContain('arrivedAt');
    expect(await reject(CalculateDemurrageDto, { ...valid, unloadingCompletedAt: '2026-13-01T00:00:00.000Z' })).toContain('unloadingCompletedAt');
  });

  it('сервис тоже отказывает, а не пишет NaN, если его позвали в обход границы', () => {
    const railway = new RailwayService();
    expect(() => railway.calculateDemurrage({ ...valid, arrivedAt: 'мусор' }))
      .toThrow(BadRequestException);
  });

  it('перевёрнутые даты по-прежнему дают ноль — этот сторож был и остаётся', () => {
    const record = new RailwayService().calculateDemurrage({
      wagonId: 'w-1', arrivedAt: '2026-09-03T00:00:00.000Z', unloadingCompletedAt: '2026-09-01T00:00:00.000Z',
    });
    expect(record.totalKopecks).toBe(0);
  });
});
