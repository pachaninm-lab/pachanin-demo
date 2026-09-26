/**
 * Значения, пересекающие границу запроса экспортного модуля, объявлены здесь
 * один раз: DTO и сервис читают отсюда и не заводят своих копий.
 */

export const INCOTERMS_CODES = [
  'EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF',
] as const;
export type IncotermsCode = (typeof INCOTERMS_CODES)[number];

export const CURRENCIES = ['RUB', 'USD', 'EUR', 'CNY'] as const;
export type Currency = (typeof CURRENCIES)[number];

export type IncotermsRule = { risk: string; costIncludes: string[]; modes: string[] };

/**
 * Курсы и правила лежат в таблицах БЕЗ прототипа, и это не украшение.
 * Обычный объектный литерал наследует Object.prototype, поэтому поиск по ключу
 * «toString», «constructor», «valueOf» или «__proto__» возвращает
 * унаследованный член, а не undefined, и проверка «не найдено» пропускает его
 * насквозь. Этот класс дефекта уже был найден ревью в тарифе планировщика
 * маршрутов; здесь он закрыт заранее, а не после замечания.
 */
function frozenTable<T>(entries: Record<string, T>): Readonly<Record<string, T>> {
  return Object.freeze(Object.assign(Object.create(null) as Record<string, T>, entries));
}

/** Курсы ЦБ РФ (заглушка — в production берутся ежедневно с cbr.ru). */
export const CBR_RATES = frozenTable<number>({ RUB: 1, USD: 89.5, EUR: 96.2, CNY: 12.3 });

export const INCOTERMS_RULES = frozenTable<IncotermsRule>({
  EXW: { risk: 'Переходит у продавца на складе', costIncludes: ['none'], modes: ['all'] },
  FCA: { risk: 'Переходит при передаче перевозчику', costIncludes: ['origin_charges'], modes: ['all'] },
  CPT: { risk: 'Переходит при передаче первому перевозчику', costIncludes: ['freight_to_dest'], modes: ['all'] },
  CIP: { risk: 'Переходит при передаче первому перевозчику', costIncludes: ['freight_to_dest', 'insurance'], modes: ['all'] },
  DAP: { risk: 'Переходит в месте назначения (без выгрузки)', costIncludes: ['freight_to_dest', 'destination_customs'], modes: ['all'] },
  DPU: { risk: 'Переходит после выгрузки в месте назначения', costIncludes: ['freight_to_dest', 'unloading', 'destination_customs'], modes: ['all'] },
  DDP: { risk: 'Переходит в месте назначения (с растаможкой)', costIncludes: ['freight_to_dest', 'destination_customs', 'import_duties'], modes: ['all'] },
  FAS: { risk: 'Переходит вдоль борта судна', costIncludes: ['inland_freight'], modes: ['sea', 'inland_waterway'] },
  FOB: { risk: 'Переходит на борту судна', costIncludes: ['inland_freight', 'loading'], modes: ['sea', 'inland_waterway'] },
  CFR: { risk: 'Переходит на борту в порту отгрузки', costIncludes: ['inland_freight', 'loading', 'ocean_freight'], modes: ['sea', 'inland_waterway'] },
  CIF: { risk: 'Переходит на борту в порту отгрузки', costIncludes: ['inland_freight', 'loading', 'ocean_freight', 'insurance'], modes: ['sea', 'inland_waterway'] },
});

/** Курс берётся только по собственному ключу таблицы и только числом. */
export function exchangeRateFor(currency: string): number | undefined {
  if (!Object.hasOwn(CBR_RATES, currency)) return undefined;
  const rate = CBR_RATES[currency];
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : undefined;
}

/** Правило берётся только по собственному ключу таблицы и только объектом. */
export function incotermsRuleFor(code: string): IncotermsRule | undefined {
  if (!Object.hasOwn(INCOTERMS_RULES, code)) return undefined;
  const rule = INCOTERMS_RULES[code];
  return rule && Array.isArray(rule.costIncludes) ? rule : undefined;
}

export const FREIGHT_RATE_RUB_PER_TON_KM = 350;
export const DEFAULT_DISTANCE_KM = 500;
export const DEFAULT_VOLUME_TONS = 1;
export const DEFAULT_INSURANCE_PCT = 0.1;

export const PRICE_MIN_RUB = 0;
export const PRICE_MAX_RUB = 1_000_000_000_000;
export const DISTANCE_MIN_KM = 0;
export const DISTANCE_MAX_KM = 40_000;
export const VOLUME_MIN_TONS = 0;
export const VOLUME_MAX_TONS = 200_000;
export const INSURANCE_PCT_MIN = 0;
export const INSURANCE_PCT_MAX = 100;

export const TNVED_PATTERN = /^\d{4,10}$/u;
export const INN_PATTERN = /^(\d{10}|\d{12})$/u;
export const GOODS_DESCRIPTION_MAX = 500;
export const CULTURE_MAX = 120;
export const COUNTRY_MAX = 120;
