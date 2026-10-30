import { Reflector } from '@nestjs/core';

import { RATE_LIMIT_OPTIONS } from '../../common/decorators/rate-limit.decorator';
import { ExportsController } from './exports.controller';

/**
 * ASVS 5.0 V2.4.1: выгрузки ограничены по частоте.
 *
 * Проверка идёт через Reflector — тем же способом, которым метаданные читает
 * сам RateLimitGuard. Текстовый поиск «@RateLimit» по файлу показал бы лишь
 * наличие строки: декоратор, применённый не к тому методу или не
 * зарегистрированный, выглядел бы точно так же.
 */

type Options = {
  name: string;
  scope: 'ip' | 'user' | 'org';
  limit: number;
  windowSeconds: number;
};

function optionsFor(method: keyof ExportsController): Options | undefined {
  return new Reflector().get<Options>(
    RATE_LIMIT_OPTIONS,
    ExportsController.prototype[method] as unknown as (...args: unknown[]) => unknown,
  );
}

const HANDLERS: Array<keyof ExportsController> = [
  'exportDeals',
  'exportEvidence',
  'exportLedger',
  'exportOutboxStatus',
  'getDealReport',
  'regulatoryReport',
];

describe('V2.4.1: массовые выгрузки ограничены по частоте', () => {
  it('метаданные читаются тем же ключом, что и у guard', () => {
    // Ключ импортируется из самого декоратора, а не выписывается строкой:
    // разойдясь с тем, что читает RateLimitGuard, проверки ниже стали бы
    // бессмысленными, оставаясь зелёными. Первая версия этого теста как раз
    // угадывала ключ и угадала неверно.
    expect(RATE_LIMIT_OPTIONS).toBe('rate_limit_options');
    expect(optionsFor('exportDeals')).toBeDefined();
  });

  it('каждый маршрут контроллера несёт ограничение', () => {
    const missing = HANDLERS.filter((handler) => optionsFor(handler) === undefined);
    expect(missing).toEqual([]);
  });

  it('ограничение привязано к действующему лицу, а не к сетевому адресу', () => {
    // За одним адресом законно работает целый офис; учётная запись, уводящая
    // данные, остаётся той же при смене адреса.
    const scopes = HANDLERS.map((handler) => optionsFor(handler)?.scope);
    expect(new Set(scopes)).toEqual(new Set(['user']));
  });

  it('имена ограничений различны, иначе бюджет был бы общим на все выгрузки', () => {
    const names = HANDLERS.map((handler) => optionsFor(handler)?.name);
    expect(new Set(names).size).toBe(HANDLERS.length);
  });

  it('самая дорогая выгрузка ограничена строже полной выгрузки реестра', () => {
    const registry = optionsFor('exportDeals');
    const regulatory = optionsFor('regulatoryReport');
    const perDeal = optionsFor('getDealReport');
    expect(regulatory!.limit).toBeLessThan(registry!.limit);
    expect(registry!.limit).toBeLessThan(perDeal!.limit);
  });

  it('окно измеряется минутами, а не секундами', () => {
    for (const handler of HANDLERS) {
      expect(optionsFor(handler)!.windowSeconds).toBeGreaterThanOrEqual(300);
    }
  });
});
