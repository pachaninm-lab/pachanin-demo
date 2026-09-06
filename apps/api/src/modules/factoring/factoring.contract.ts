/**
 * Единственный источник правды для границы факторинга.
 *
 * Список факторинговых компаний жил в сервисе локальной константой, а тело
 * запроса объявлялось инлайн-типом, поэтому проверить его было нечем. Здесь
 * он объявлен один раз и заморожен: и DTO, и сервис читают одно и то же.
 */

export const ALLOWED_FACTORS = Object.freeze([
  'Сбербанк Факторинг',
  'ВТБ Факторинг',
  'Альфа-Банк',
  'Открытие Факторинг',
  'ПСБ Факторинг',
] as const);

export type FactorName = (typeof ALLOWED_FACTORS)[number];

/** Идентификаторы сделки и организации приходят строками; длина ограничена. */
export const FACTORING_ID_MAX = 64;

/**
 * Нижняя граница запрашиваемой суммы — одна копейка.
 *
 * Ноль и отрицательные значения не являются заявкой на финансирование.
 * Замерено, что до этой правки `-500 000 ₽` проходили до статуса APPROVED
 * и давали `approvedAmountKopecks: -50000000`.
 */
export const FACTORING_AMOUNT_MIN_KOPECKS = 1;

/**
 * Верхняя граница — не кредитный лимит, а арифметический предел здравого
 * смысла: миллиард рублей в копейках.
 *
 * Кредитное решение принимает скоринг, а не эта константа. Её задача в другом:
 * удержать значение в диапазоне, где `Math.round(amount * approvedPct)`
 * остаётся точным целым и не может молча превратиться в `Infinity` или
 * потерять разряды. Замерено, что `1e308` проходило до APPROVED.
 */
export const FACTORING_AMOUNT_MAX_KOPECKS = 100_000_000_000;

/**
 * Сумма пригодна к арифметике: целое, конечное, в границах.
 *
 * Сервис обязан отказать сам, а не полагаться на границу: вызывающий в обход
 * контроллера не должен уметь записать NaN, Infinity или минус в заявку.
 */
export function isUsableAmountKopecks(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= FACTORING_AMOUNT_MIN_KOPECKS &&
    value <= FACTORING_AMOUNT_MAX_KOPECKS
  );
}

/** Проверка по собственному списку, а не по индексации объекта с прототипом. */
export function isAllowedFactor(value: unknown): value is FactorName {
  return typeof value === 'string' && (ALLOWED_FACTORS as readonly string[]).includes(value);
}
