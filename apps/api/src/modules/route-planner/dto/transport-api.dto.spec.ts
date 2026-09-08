import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';

import {
  CalculateDemurrageDto,
  CreateGU12Dto,
  RegisterWagonDto,
  UpdateWagonStatusDto,
} from '../../railway/dto/railway-api.dto';
import {
  ApplyPhytoCertificateDto,
  CalculateIncotermsDto,
  ConvertCurrencyDto,
  SubmitCustomsDeclarationDto,
} from '../../export-trade/dto/export-trade-api.dto';
import {
  CalculateEtaDto,
  EstimateTariffDto,
  RegisterGeofencesDto,
  UpdateVehiclePositionDto,
} from './route-planner-api.dto';

/**
 * V2.2.1 / V2.2.2 — транспортный контур: маршруты, вагоны, экспорт.
 *
 * Двенадцать обработчиков объявляли тело инлайн-типом. Инлайн-тип стирается до
 * `Object`, ValidationPipe его не видит, и каждое число шло прямо в
 * арифметику. Ниже сперва воспроизводится то, что из-за этого получалось —
 * ровно теми выражениями, что стоят в сервисах, — и лишь затем проверяется, что
 * теперь это отвергается на двери.
 *
 * Пайп берётся ровно той конфигурации, что в main.ts.
 */

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true });
const asBody = <T>(metatype: new () => T) => (value: unknown) =>
  pipe.transform(value, { type: 'body', metatype } as never);

const position = asBody(UpdateVehiclePositionDto);
const geofences = asBody(RegisterGeofencesDto);
const eta = asBody(CalculateEtaDto);
const tariff = asBody(EstimateTariffDto);
const wagon = asBody(RegisterWagonDto);
const wagonStatus = asBody(UpdateWagonStatusDto);
const gu12 = asBody(CreateGU12Dto);
const demurrage = asBody(CalculateDemurrageDto);
const incoterms = asBody(CalculateIncotermsDto);
const convert = asBody(ConvertCurrencyDto);
const customs = asBody(SubmitCustomsDeclarationDto);
const phyto = asBody(ApplyPhytoCertificateDto);

/** Та же арифметика, что в route-planner.service.ts. */
const etaAt = (from: { lat: number; lng: number }, to: { lat: number; lng: number }, avgSpeedKmh = 60) => {
  const R = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((from.lat * Math.PI) / 180) * Math.cos((to.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return new Date(Date.now() + (distanceKm / avgSpeedKmh) * 3600 * 1000).toISOString();
};

/** Та же арифметика, что в estimateLogisticsTariff. */
const tariffKopecks = (distanceKm: number, weightTons: number, vehicleType = 'truck') => {
  const rates: Record<string, number> = { truck: 350, rail: 180, vessel: 90 };
  return Math.round(distanceKm * weightTons * rates[vehicleType]);
};

describe('что получалось до правки — на выражениях самих сервисов', () => {
  it('avgSpeedKmh=0 роняет расчёт ETA пятисоткой, а не отвечает медленным маршрутом', () => {
    expect(() => etaAt({ lat: 55, lng: 37 }, { lat: 56, lng: 38 }, 0)).toThrow(RangeError);
  });

  it('нечисловая широта делает то же самое', () => {
    expect(() => etaAt({ lat: 'север' as never, lng: 37 }, { lat: 56, lng: 38 })).toThrow(RangeError);
  });

  it('неизвестный тип транспорта превращает весь тариф в NaN', () => {
    expect(Number.isNaN(tariffKopecks(100, 20, 'грузовик'))).toBe(true);
    // В JSON это уезжает как null: котировка без числа.
    expect(JSON.parse(JSON.stringify({ total: tariffKopecks(100, 20, 'грузовик') }))).toEqual({ total: null });
  });

  it('отрицательное расстояние даёт отрицательный тариф — деньги должны наоборот', () => {
    expect(tariffKopecks(-100, 20)).toBeLessThan(0);
  });

  it('Math.max(0, ...) не зажимает NaN, поэтому простой считается по неразобранной дате', () => {
    const hours = Math.max(0, (new Date('не дата').getTime() - new Date('2026-01-01').getTime()) / 3_600_000);
    expect(Number.isNaN(hours)).toBe(true);
  });
});

describe('маршруты — теперь отвергается на двери', () => {
  it('avgSpeedKmh=0 отвергается, отсутствующий остаётся значением по умолчанию сервиса', async () => {
    const point = { fromLat: 55, fromLng: 37, toLat: 56, toLng: 38 };
    await expect(eta({ ...point, avgSpeedKmh: 0 })).rejects.toThrow();
    await expect(eta({ ...point, avgSpeedKmh: -1 })).rejects.toThrow();
    await expect(eta(point)).resolves.toMatchObject({ fromLat: 55 });
  });

  it.each(['fromLat', 'toLat'])('%s вне диапазона широт отвергается', async (field) => {
    const point: Record<string, number> = { fromLat: 55, fromLng: 37, toLat: 56, toLng: 38 };
    await expect(eta({ ...point, [field]: 91 })).rejects.toThrow();
    await expect(eta({ ...point, [field]: 'север' })).rejects.toThrow();
    await expect(eta({ ...point, [field]: 55 })).resolves.toBeDefined();
  });

  it.each(['fromLng', 'toLng'])('%s вне диапазона долгот отвергается', async (field) => {
    const point: Record<string, number> = { fromLat: 55, fromLng: 37, toLat: 56, toLng: 38 };
    await expect(eta({ ...point, [field]: 181 })).rejects.toThrow();
    await expect(eta({ ...point, [field]: 37 })).resolves.toBeDefined();
  });

  it('тип транспорта — только ключи таблицы тарифов', async () => {
    await expect(tariff({ distanceKm: 100, weightTons: 20, vehicleType: 'грузовик' })).rejects.toThrow();
    await expect(tariff({ distanceKm: 100, weightTons: 20, vehicleType: 'rail' })).resolves.toMatchObject({
      vehicleType: 'rail',
    });
  });

  it('отрицательные расстояние и вес отвергаются по отдельности', async () => {
    await expect(tariff({ distanceKm: -100, weightTons: 20 })).rejects.toThrow();
    await expect(tariff({ distanceKm: 100, weightTons: -20 })).rejects.toThrow();
    await expect(tariff({ distanceKm: 100, weightTons: 20 })).resolves.toBeDefined();
  });

  // @Min сравнением NaN не ловит: любое сравнение с NaN ложно. Отсюда явный
  // allowNaN:false / allowInfinity:false, и это проверяется отдельно.
  it('NaN и Infinity отвергаются, хотя @Min их пропустил бы', async () => {
    await expect(tariff({ distanceKm: Number.NaN, weightTons: 20 })).rejects.toThrow();
    await expect(tariff({ distanceKm: Number.POSITIVE_INFINITY, weightTons: 20 })).rejects.toThrow();
  });

  it('позиция транспорта проверяется по координатам и курсу', async () => {
    await expect(position({ lat: 55, lng: 37, heading: 361 })).rejects.toThrow();
    await expect(position({ lat: 55, lng: 37, speed: -1 })).rejects.toThrow();
    await expect(position({ lat: 55, lng: 37 })).resolves.toMatchObject({ lat: 55 });
  });

  it('геозоны проверяются поэлементно, а не только как массив', async () => {
    const zone = { id: 'z', name: 'склад', lat: 55, lng: 37, radiusMeters: 500, type: 'WAREHOUSE' };
    await expect(geofences({ zones: [{ ...zone, radiusMeters: 0 }] })).rejects.toThrow();
    await expect(geofences({ zones: [{ ...zone, lat: 91 }] })).rejects.toThrow();
    await expect(geofences({ zones: [zone] })).resolves.toMatchObject({ zones: [expect.objectContaining({ id: 'z' })] });
  });
});

describe('вагоны — союзы типов существовали только при компиляции', () => {
  it('тип вагона больше не любая строка', async () => {
    await expect(wagon({ wagonNumber: '1', type: 'ЦИСТЕРНА', capacityTons: 60 })).rejects.toThrow();
    await expect(wagon({ wagonNumber: '1', type: 'TANK', capacityTons: 60 })).resolves.toMatchObject({ type: 'TANK' });
  });

  it('статус вагона тоже', async () => {
    await expect(wagonStatus({ status: 'СВОБОДЕН' })).rejects.toThrow();
    await expect(wagonStatus({ status: 'FREE' })).resolves.toMatchObject({ status: 'FREE' });
  });

  it('вместимость должна быть положительной и конечной', async () => {
    await expect(wagon({ wagonNumber: '1', type: 'TANK', capacityTons: 0 })).rejects.toThrow();
    await expect(wagon({ wagonNumber: '1', type: 'TANK', capacityTons: Number.NaN })).rejects.toThrow();
  });

  it('заявка ГУ-12 требует непустой список вагонов и разбираемую дату', async () => {
    const base = {
      dealId: 'd', departureStation: 'A', destinationStation: 'B', cargo: 'пшеница',
      volumeTons: 60, requestedDepartureAt: '2026-03-01T00:00:00.000Z',
    };
    await expect(gu12({ ...base, wagonIds: [] })).rejects.toThrow();
    await expect(gu12({ ...base, wagonIds: ['w1'], requestedDepartureAt: 'завтра' })).rejects.toThrow();
    await expect(gu12({ ...base, wagonIds: ['w1'] })).resolves.toMatchObject({ wagonIds: ['w1'] });
  });

  it.each(['arrivedAt', 'unloadingCompletedAt'])('простой: %s связан по отдельности', async (field) => {
    const base: Record<string, string> = {
      wagonId: 'w', arrivedAt: '2026-03-01T00:00:00.000Z', unloadingCompletedAt: '2026-03-02T00:00:00.000Z',
    };
    await expect(demurrage({ ...base, [field]: 'не дата' })).rejects.toThrow();
    await expect(demurrage(base)).resolves.toBeDefined();
  });
});

describe('экспорт — валюта решала, будет ли в ответе число', () => {
  it('валюта конвертации — только из таблицы курсов ЦБ', async () => {
    await expect(convert({ amountRub: 1000, toCurrency: 'GBP' })).rejects.toThrow();
    await expect(convert({ amountRub: 1000, toCurrency: 'CNY' })).resolves.toMatchObject({ toCurrency: 'CNY' });
  });

  it('условие поставки — из одиннадцати Incoterms, а не любые три буквы', async () => {
    const base = { priceRub: 1000, currency: 'USD' };
    await expect(incoterms({ ...base, incoterms: 'XXX' })).rejects.toThrow();
    await expect(incoterms({ ...base, incoterms: 'CIF' })).resolves.toMatchObject({ incoterms: 'CIF' });
  });

  it('доля страхования — процент, а не произвольное число', async () => {
    const base = { priceRub: 1000, currency: 'USD', incoterms: 'CIF' };
    await expect(incoterms({ ...base, includeInsurancePct: 101 })).rejects.toThrow();
    await expect(incoterms({ ...base, includeInsurancePct: -1 })).rejects.toThrow();
    await expect(incoterms({ ...base, includeInsurancePct: 10 })).resolves.toBeDefined();
  });

  it('таможенная стоимость не бывает отрицательной или NaN', async () => {
    const base = { goodsDescription: 'пшеница', tnvedCode: '1001990000' };
    await expect(customs({ ...base, totalValueRub: -1 })).rejects.toThrow();
    await expect(customs({ ...base, totalValueRub: Number.NaN })).rejects.toThrow();
    await expect(customs({ ...base, totalValueRub: 1000 })).resolves.toBeDefined();
  });

  it('ИНН производителя — по тому же правилу, что уже действует в KYC', async () => {
    const base = { culture: 'пшеница', volumeTons: 60, destinationCountry: 'Египет' };
    await expect(phyto({ ...base, producerInn: '123' })).rejects.toThrow();
    await expect(phyto({ ...base, producerInn: '12345678901' })).rejects.toThrow();
    await expect(phyto({ ...base, producerInn: '7701234567' })).resolves.toMatchObject({ producerInn: '7701234567' });
    await expect(phyto({ ...base, producerInn: '770123456789' })).resolves.toBeDefined();
  });
});
