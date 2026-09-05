import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  CalculateEtaDto,
  EstimateTariffDto,
  RegisterGeofencesDto,
  UpdateVehiclePositionDto,
} from './dto/route-planner.dto';
import { RoutePlannerController } from './route-planner.controller';
import { RoutePlannerService } from './route-planner.service';

/**
 * V2.2.1 / V2.2.2 — граница запроса планировщика маршрутов.
 *
 * Четыре тела объявлялись инлайн-типом, зоны уходили в сервис через `as any`.
 * Но интереснее то, во что это превращалось дальше: расчёт времени прибытия
 * падал пятисоткой, а тариф — деньги — считался в NaN и в минус.
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
  const code = readFileSync(join(__dirname, 'route-planner.controller.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/^\s*\/\/.*$/gmu, '');

  it('инлайн-тел не осталось', () => {
    expect(code).not.toMatch(/@Body\(\)\s+body:\s*\{/u);
  });

  it('зоны больше не проносятся через as any', () => {
    expect(code).not.toContain('as any');
  });

  it.each([
    ['updatePosition', UpdateVehiclePositionDto],
    ['registerGeofences', RegisterGeofencesDto],
    ['calculateEta', CalculateEtaDto],
    ['estimateTariff', EstimateTariffDto],
  ])('%s несёт класс DTO в метаданных маршрута', (method, dto) => {
    const types = Reflect.getMetadata('design:paramtypes', RoutePlannerController.prototype, method) as unknown[];
    const args = Reflect.getMetadata('__routeArguments__', RoutePlannerController, method) as Record<string, { index: number }>;
    const bodyKey = Object.keys(args).find((key) => key.startsWith('3:'));
    expect(bodyKey).toBeDefined();
    expect(types[args[bodyKey as string]?.index as number]).toBe(dto);
  });
});

/**
 * Замерено ДО исправления: `avgSpeedKmh: 0` давало
 * `RangeError: Invalid time value` — деление на ноль, Infinity в часах и
 * падение на `new Date(...).toISOString()`. Это 500 на вводе пользователя.
 */
describe('расчёт времени прибытия', () => {
  const valid = { fromLat: 51.67, fromLng: 39.21, toLat: 44.72, toLng: 37.77 };

  it('нормальный расчёт проходит и даёт время в будущем', async () => {
    await expect(accept(CalculateEtaDto, valid)).resolves.toBeDefined();
    const result = new RoutePlannerService().calculateEta(
      { lat: valid.fromLat, lng: valid.fromLng }, { lat: valid.toLat, lng: valid.toLng }, 60,
    );
    expect(Number.isFinite(result.etaHours)).toBe(true);
    expect(new Date(result.etaAt).getTime()).toBeGreaterThan(Date.now() - 1000);
  });

  it('нулевая скорость отклоняется на границе, а не падает пятисоткой', async () => {
    expect(await reject(CalculateEtaDto, { ...valid, avgSpeedKmh: 0 })).toContain('avgSpeedKmh');
  });

  it('отрицательная скорость отклоняется — раньше она молча давала прибытие во вчера', async () => {
    expect(await reject(CalculateEtaDto, { ...valid, avgSpeedKmh: -60 })).toContain('avgSpeedKmh');
  });

  it('координаты вне земного диапазона отклоняются', async () => {
    expect(await reject(CalculateEtaDto, { ...valid, fromLat: 91 })).toContain('fromLat');
    expect(await reject(CalculateEtaDto, { ...valid, toLng: 181 })).toContain('toLng');
  });

  it('строка вместо координаты отклоняется, а не приводится молча', async () => {
    expect(await reject(CalculateEtaDto, { ...valid, fromLat: '51.67' })).toContain('fromLat');
  });

  it('сервис тоже отказывает, если его позвали в обход границы', () => {
    const service = new RoutePlannerService();
    const from = { lat: valid.fromLat, lng: valid.fromLng };
    const to = { lat: valid.toLat, lng: valid.toLng };
    expect(() => service.calculateEta(from, to, 0)).toThrow(BadRequestException);
    expect(() => service.calculateEta(from, to, -60)).toThrow(BadRequestException);
    expect(() => service.calculateEta({ lat: Number.NaN, lng: 39.2 }, to, 60)).toThrow(BadRequestException);
  });
});

/**
 * Замерено ДО исправления: неизвестный тип транспорта давал
 * `{"totalKopecks": null}` — тариф без цифры; расстояние -500 давало
 * -4 200 000 копеек, то есть счёт в пользу плательщика.
 */
describe('оценка тарифа — это деньги', () => {
  const valid = { distanceKm: 500, weightTons: 20 };

  it('нормальная оценка проходит', async () => {
    await expect(accept(EstimateTariffDto, valid)).resolves.toMatchObject({ distanceKm: 500 });
    const result = new RoutePlannerService().estimateLogisticsTariff(500, 20, 'truck');
    expect(result.totalKopecks).toBe(4_200_000);
  });

  it('все три настоящих типа транспорта проходят и дают разную ставку', async () => {
    const service = new RoutePlannerService();
    const rates = (['truck', 'rail', 'vessel'] as const).map(
      (type) => service.estimateLogisticsTariff(500, 20, type).ratePerTonKmKopecks,
    );
    expect(new Set(rates).size).toBe(3);
    for (const vehicleType of ['truck', 'rail', 'vessel']) {
      await expect(accept(EstimateTariffDto, { ...valid, vehicleType })).resolves.toBeDefined();
    }
  });

  it('неизвестный тип транспорта отклоняется — раньше он давал сумму null', async () => {
    expect(await reject(EstimateTariffDto, { ...valid, vehicleType: 'вертолёт' })).toContain('vehicleType');
  });

  it('отрицательные величины отклоняются — раньше они давали тариф в минус', async () => {
    expect(await reject(EstimateTariffDto, { ...valid, distanceKm: -500 })).toContain('distanceKm');
    expect(await reject(EstimateTariffDto, { ...valid, weightTons: -20 })).toContain('weightTons');
  });

  it('строка вместо числа отклоняется — умножение приводило её молча', async () => {
    expect(await reject(EstimateTariffDto, { ...valid, distanceKm: '500' })).toContain('distanceKm');
  });

  it('сервис тоже отказывает, а не считает NaN или минус', () => {
    const service = new RoutePlannerService();
    expect(() => service.estimateLogisticsTariff(500, 20, 'вертолёт' as never)).toThrow(BadRequestException);
    expect(() => service.estimateLogisticsTariff(-500, 20, 'truck')).toThrow(BadRequestException);
    expect(() => service.estimateLogisticsTariff(Number.NaN, 20, 'truck')).toThrow(BadRequestException);
  });
});

describe('положение машины и геозоны', () => {
  it('нормальное положение проходит', async () => {
    await expect(accept(UpdateVehiclePositionDto, { lat: 51.67, lng: 39.21, speed: 72, heading: 180 }))
      .resolves.toMatchObject({ lat: 51.67 });
  });

  it('координаты вне диапазона отклоняются', async () => {
    expect(await reject(UpdateVehiclePositionDto, { lat: 91, lng: 39.21 })).toContain('lat');
    expect(await reject(UpdateVehiclePositionDto, { lat: 51.67, lng: -181 })).toContain('lng');
  });

  it('лишнее поле срезается whitelist и не доезжает до точки', async () => {
    const result = await accept(UpdateVehiclePositionDto, { lat: 51.67, lng: 39.21, timestamp: 'подделка' });
    expect(result).not.toHaveProperty('timestamp');
  });

  /**
   * Здесь, в отличие от железнодорожного модуля, россыпь тела ничего не
   * проносила: сервис не строит запись с полем после спреда, а `whitelist`
   * срезает недекорированные поля ещё в пайпе. Замерено прогоном мутаций —
   * возврат `...body` не роняет ни одной проверки.
   *
   * Поимённое перечисление в контроллере оставлено сознательно: оно снимает
   * скрытый риск на будущее, когда в DTO появится поле, которому в точке GPS
   * делать нечего. Но выдавать его за исправление сегодняшнего дефекта нельзя,
   * и этот тест существует, чтобы никто так не прочитал.
   */
  it('в теле остаются только объявленные поля, что бы ни прислали', async () => {
    const body = await accept(UpdateVehiclePositionDto, {
      lat: 51.67, lng: 39.21, speed: 72, timestamp: 'подделка', vehicleId: 'чужой',
    });
    const declared = ['lat', 'lng', 'speed', 'heading'];
    expect(Object.keys(body).every((key) => declared.includes(key))).toBe(true);
    expect(body).not.toHaveProperty('vehicleId');
  });

  it('настоящая геозона проходит', async () => {
    await expect(accept(RegisterGeofencesDto, {
      zones: [{ id: 'z-1', name: 'Элеватор', lat: 51.67, lng: 39.21, radiusMeters: 500, type: 'ELEVATOR' }],
    })).resolves.toBeDefined();
  });

  it('пустой список зон отклоняется', async () => {
    expect(await reject(RegisterGeofencesDto, { zones: [] })).toContain('zones');
  });

  it('зона без обязательных полей отклоняется — раньше её проносило as any', async () => {
    expect(await reject(RegisterGeofencesDto, { zones: [{}] })).toContain('id');
  });

  it('неизвестный тип зоны отклоняется', async () => {
    expect(await reject(RegisterGeofencesDto, {
      zones: [{ id: 'z-1', name: 'Зона', lat: 51.67, lng: 39.21, radiusMeters: 500, type: 'СКЛАД' }],
    })).toContain('type');
  });

  it('нулевой и отрицательный радиус отклоняются', async () => {
    for (const radiusMeters of [0, -500]) {
      expect(await reject(RegisterGeofencesDto, {
        zones: [{ id: 'z-1', name: 'Зона', lat: 51.67, lng: 39.21, radiusMeters, type: 'ELEVATOR' }],
      })).toContain('radiusMeters');
    }
  });
});
