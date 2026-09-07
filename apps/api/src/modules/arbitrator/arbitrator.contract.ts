/**
 * Граница разрешения спора.
 *
 * Тело `resolve` объявлялось инлайн-типом, поэтому `splitPct` не проверялся
 * ничем, а сервис считал долю прямо из него:
 *
 *   const buyerShare = (holdAmount * BigInt(Math.trunc(splitPct)) + 50n) / 100n;
 *   const sellerShare = holdAmount - buyerShare;
 *
 * Замерено на настоящем `resolve()` при холде 100 000 копеек:
 *
 *   splitPct 500    → выплачено 500 000      (пятикратно холду)
 *   splitPct -100   → выплачено 199 999      (двукратно, всё продавцу)
 *   splitPct 10 000 → выплачено 10 000 000   (стократно)
 *   splitPct NaN    → RangeError на BigInt   (500 на вводе арбитра)
 *
 * Эскроу не может выплатить больше, чем удерживает. Здесь это свойство
 * объявлено и проверяется, а не подразумевается.
 */

export const DISPUTE_OUTCOMES = Object.freeze([
  'BUYER_WINS',
  'SELLER_WINS',
  'SPLIT',
  'CANCELLED',
] as const);

export type DisputeOutcomeName = (typeof DISPUTE_OUTCOMES)[number];

export const SPLIT_PCT_MIN = 0;
export const SPLIT_PCT_MAX = 100;

/** Причина решения — обязательный текст, а не пустая строка. */
export const DISPUTE_REASON_MAX = 2000;
export const DISPUTE_NOTE_MAX = 2000;

/**
 * Доля пригодна к арифметике: целое от 0 до 100.
 *
 * Дробь отвергается, а не усекается молча: `Math.trunc` превращал 50.7 в 50
 * без следа, и арбитр не узнавал, что решение записано не тем числом.
 */
export function isUsableSplitPct(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= SPLIT_PCT_MIN &&
    value <= SPLIT_PCT_MAX
  );
}

export function isDisputeOutcome(value: unknown): value is DisputeOutcomeName {
  return typeof value === 'string' && (DISPUTE_OUTCOMES as readonly string[]).includes(value);
}

/**
 * Деление холда на две доли с сохранением суммы.
 *
 * Округление половины вверх выполняется в целочисленном пространстве, как и
 * раньше, но доля продавца считается вычитанием, поэтому
 * `buyerShare + sellerShare === holdAmount` выполняется тождественно, а не
 * по счастливому совпадению. Обе доли неотрицательны, потому что `splitPct`
 * уже проверен диапазоном 0..100 — и проверен здесь ещё раз, чтобы функция
 * оставалась верной независимо от вызывающего.
 */
export function splitHold(
  holdAmount: bigint,
  splitPct: number,
): { buyerShare: bigint; sellerShare: bigint } {
  if (!isUsableSplitPct(splitPct)) {
    throw new RangeError(`DISPUTE_SPLIT_PCT_INVALID: ${String(splitPct)}`);
  }
  if (holdAmount < 0n) {
    throw new RangeError(`DISPUTE_HOLD_NEGATIVE: ${String(holdAmount)}`);
  }
  const buyerShare = (holdAmount * BigInt(splitPct) + 50n) / 100n;
  const sellerShare = holdAmount - buyerShare;
  return { buyerShare, sellerShare };
}
