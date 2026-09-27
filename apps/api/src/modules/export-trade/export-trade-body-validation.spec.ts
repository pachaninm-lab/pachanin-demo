import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  ApplyPhytoDto,
  CalculateIncotermsDto,
  ConvertCurrencyDto,
  SubmitCustomsDto,
} from './dto/export-trade.dto';
import { ExportTradeController } from './export-trade.controller';
import { ExportTradeService } from './export-trade.service';
import { CBR_RATES, INCOTERMS_RULES } from './export-trade.contract';

/**
 * V1.4.2 / V2.2.1 / V2.2.2 — граница запроса экспортного модуля.
 *
 * Четыре тела объявлялись инлайн-типом. Дальше это превращалось в три разных
 * способа испортить деньги, и все три замерены на живом сервисе.
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
  const code = readFileSync(join(__dirname, 'export-trade.controller.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/^\s*\/\/.*$/gmu, '');

  it('инлайн-тел не осталось', () => {
    expect(code).not.toMatch(/@Body\(\)\s+body:\s*\{/u);
  });

  it.each([
    ['calculateIncoterms', CalculateIncotermsDto],
    ['convert', ConvertCurrencyDto],
    ['submitCustoms', SubmitCustomsDto],
    ['applyPhyto', ApplyPhytoDto],
  ])('%s несёт класс DTO в метаданных маршрута', (method, dto) => {
    const types = Reflect.getMetadata('design:paramtypes', ExportTradeController.prototype, method) as unknown[];
    const args = Reflect.getMetadata('__routeArguments__', ExportTradeController, method) as Record<string, { index: number }>;
    const bodyKey = Object.keys(args).find((key) => key.startsWith('3:'));
    expect(bodyKey).toBeDefined();
    expect(types[args[bodyKey as string]?.index as number]).toBe(dto);
  });
});

/**
 * Самое дорогое из измеренного. `priceRub` строкой не складывался с фрахтом и
 * страховкой, а КОНКАТЕНИРОВАЛСЯ: «500» + 175000 + 1 давало «5001750001»
 * вместо 175 501 — завышение в 28 500 раз, и итог уходил в ответ строкой.
 */
describe('цена строкой: сложение против конкатенации', () => {
  const valid = { priceRub: 500, incoterms: 'CIF', currency: 'USD' };

  it('строка вместо цены отклоняется на границе', async () => {
    expect(await reject(CalculateIncotermsDto, { ...valid, priceRub: '500' })).toContain('priceRub');
  });

  it('сервис тоже отказывает, если его позвали в обход границы', () => {
    expect(() => new ExportTradeService().calculateIncotermsPrice({ ...valid, priceRub: '500' } as never))
      .toThrow(BadRequestException);
  });

  it('на числе итог остаётся числом и считается сложением', () => {
    const result = new ExportTradeService().calculateIncotermsPrice({ ...valid, priceRub: 500 } as never);
    expect(typeof result.totalRub).toBe('number');
    expect(result.totalRub).toBe(result.basePriceRub + result.freightRub + result.insuranceRub);
  });
});

/**
 * Замерено: неизвестный базис давал
 * `TypeError: Cannot read properties of undefined (reading 'costIncludes')`,
 * то есть 500; неизвестная валюта — `totalCurrency: null`.
 */
describe('справочники индексируются только собственными ключами', () => {
  const valid = { priceRub: 1_000_000, incoterms: 'CIF', currency: 'USD' };

  it('все одиннадцать настоящих базисов проходят', async () => {
    for (const incoterms of ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF']) {
      await expect(accept(CalculateIncotermsDto, { ...valid, incoterms })).resolves.toBeDefined();
    }
  });

  it('все четыре настоящие валюты проходят', async () => {
    for (const currency of ['RUB', 'USD', 'EUR', 'CNY']) {
      await expect(accept(CalculateIncotermsDto, { ...valid, currency })).resolves.toBeDefined();
    }
  });

  it('неизвестный базис отклоняется — раньше это был TypeError и 500', async () => {
    expect(await reject(CalculateIncotermsDto, { ...valid, incoterms: 'XXX' })).toContain('incoterms');
  });

  it('неизвестная валюта отклоняется — раньше сумма уезжала как null', async () => {
    expect(await reject(CalculateIncotermsDto, { ...valid, currency: 'ЗЛТ' })).toContain('currency');
  });

  /**
   * Тот же класс дефекта ревью нашло в тарифе планировщика маршрутов. Здесь он
   * закрыт заранее: обе таблицы без прототипа, поиск по собственному ключу.
   */
  it.each(['toString', 'constructor', '__proto__', 'valueOf', 'hasOwnProperty'])(
    'унаследованный ключ %s не считается ни базисом, ни валютой',
    (key) => {
      const service = new ExportTradeService();
      expect(() => service.calculateIncotermsPrice({ priceRub: 1000, incoterms: key, currency: 'USD' } as never))
        .toThrow(BadRequestException);
      expect(() => service.calculateIncotermsPrice({ priceRub: 1000, incoterms: 'CIF', currency: key } as never))
        .toThrow(BadRequestException);
      expect(() => service.convertCurrency(1000, key as never)).toThrow(BadRequestException);
    },
  );

  /**
   * Как и в планировщике маршрутов, защита взаимно покрывающая, и это
   * измерено: снятие проверки собственного ключа отдельно не роняет ничего —
   * нулевой прототип её закрывает, — а возврат прототипа таблицам роняет
   * проверки унаследованных ключей. Ни один слой не выдаётся за несущий.
   */
  it('обе таблицы объявлены без прототипа', () => {
    expect(Object.getPrototypeOf(CBR_RATES)).toBeNull();
    expect(Object.getPrototypeOf(INCOTERMS_RULES)).toBeNull();
  });
});

describe('знак и диапазон денежных величин', () => {
  const valid = { priceRub: 1_000_000, incoterms: 'CIF', currency: 'USD' };

  it('отрицательная цена отклоняется — раньше давала отрицательный итог', async () => {
    expect(await reject(CalculateIncotermsDto, { ...valid, priceRub: -1_000_000 })).toContain('priceRub');
  });

  it('отрицательные расстояние и объём отклоняются', async () => {
    expect(await reject(CalculateIncotermsDto, { ...valid, distanceKm: -500 })).toContain('distanceKm');
    expect(await reject(CalculateIncotermsDto, { ...valid, volumeTons: -20 })).toContain('volumeTons');
  });

  it('невозможные величины отклоняются — раньше давали 3.5e+32', async () => {
    expect(await reject(CalculateIncotermsDto, { ...valid, distanceKm: 1e15 })).toContain('distanceKm');
    expect(await reject(CalculateIncotermsDto, { ...valid, volumeTons: 1e15 })).toContain('volumeTons');
  });

  it('доля страховки вне ста процентов отклоняется', async () => {
    expect(await reject(CalculateIncotermsDto, { ...valid, includeInsurancePct: -1 })).toContain('includeInsurancePct');
    expect(await reject(CalculateIncotermsDto, { ...valid, includeInsurancePct: 101 })).toContain('includeInsurancePct');
  });

  /**
   * Проверяется свойство, а не декоратор. Замерено прогоном мутаций: при
   * наличии @Min/@Max снятие @IsNumber() с цены не роняет ничего — @Min
   * сравнивает через >= и сам отклоняет строку, NaN и бесконечность, а
   * сторож сервиса ловит их вторым слоем. Декоратор оставлен как заявление о
   * намерении, но несущим не считается. Тот же случай, что с capacityTons в
   * железнодорожном модуле.
   */
  it('NaN и бесконечность не проходят как цена', async () => {
    for (const priceRub of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(await reject(CalculateIncotermsDto, { ...valid, priceRub })).toContain('priceRub');
    }
  });
});

describe('конвертация валюты', () => {
  it('нормальная конвертация проходит и даёт число', async () => {
    await expect(accept(ConvertCurrencyDto, { amountRub: 1_000_000, toCurrency: 'USD' })).resolves.toBeDefined();
    const result = new ExportTradeService().convertCurrency(1_000_000, 'USD');
    expect(Number.isFinite(result.amount)).toBe(true);
  });

  it('неизвестная валюта отклоняется — раньше давала amount: null', async () => {
    expect(await reject(ConvertCurrencyDto, { amountRub: 1_000_000, toCurrency: 'ЗЛТ' })).toContain('toCurrency');
  });

  it('отрицательная сумма отклоняется', async () => {
    expect(await reject(ConvertCurrencyDto, { amountRub: -1, toCurrency: 'USD' })).toContain('amountRub');
  });
});

describe('таможня и фитосанитария', () => {
  it('нормальная декларация проходит', async () => {
    await expect(accept(SubmitCustomsDto, {
      goodsDescription: 'Пшеница мягкая 4 класс', tnvedCode: '1001990000', totalValueRub: 5_000_000,
    })).resolves.toBeDefined();
  });

  it('код ТН ВЭД не из цифр отклоняется', async () => {
    expect(await reject(SubmitCustomsDto, {
      goodsDescription: 'Пшеница', tnvedCode: 'ABC', totalValueRub: 1,
    })).toContain('tnvedCode');
  });

  it('нормальная заявка на фитосертификат проходит', async () => {
    await expect(accept(ApplyPhytoDto, {
      culture: 'Пшеница', volumeTons: 5000, producerInn: '7707083893', destinationCountry: 'Египет',
    })).resolves.toBeDefined();
  });

  it('ИНН не из десяти или двенадцати цифр отклоняется', async () => {
    expect(await reject(ApplyPhytoDto, {
      culture: 'Пшеница', volumeTons: 5000, producerInn: '770708', destinationCountry: 'Египет',
    })).toContain('producerInn');
  });
});
