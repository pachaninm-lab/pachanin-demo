/**
 * Money in integer minor units (kopecks). 1 RUB = 100 kopecks.
 *
 * Behavior-neutral utility (PR-A of MONEY_MINOR_UNITS_AUDIT.md). Nothing in the
 * runtime calls this yet — it is the tested foundation the later kopecks
 * migration (PR-B MoneyEngine arithmetic, PR-C schema) will build on. No field
 * renames, no schema change, no MoneyEngine/SettlementEngine edits.
 *
 * Rationale: floating-point roubles accumulate IEEE-754 error and allow
 * fractional kopecks. Storing/operating on integer kopecks makes money exact.
 */

const KOPECKS_PER_RUBLE = 100;

/** True when `value` is a finite, safe integer. */
export function isWholeKopecks(value: number): boolean {
  return Number.isInteger(value) && Number.isSafeInteger(value);
}

function assertFinite(value: number, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`money: ${label} must be a finite number, got ${value}`);
  }
}

/**
 * Converts roubles (float, ≤ 2 decimals) to integer kopecks using half-up
 * rounding. Throws on NaN/Infinity. Note: callers should pass values with at
 * most two decimal places; binary-unrepresentable inputs (e.g. 1.005) follow
 * IEEE-754 and are out of scope for this converter.
 */
export function toKopecks(rub: number): number {
  assertFinite(rub, 'rub');
  return Math.round(rub * KOPECKS_PER_RUBLE);
}

/** Converts integer kopecks back to roubles (for display / legacy `*Rub` mirrors). */
export function fromKopecks(kopecks: number): number {
  assertFinite(kopecks, 'kopecks');
  return kopecks / KOPECKS_PER_RUBLE;
}

/**
 * Formats kopecks as a Russian rouble string, e.g. 123456 → "1 234,56 ₽".
 * Deterministic (no Intl/ICU dependency): space thousands separator, comma
 * decimal, two fraction digits.
 */
export function formatRub(kopecks: number): string {
  assertFinite(kopecks, 'kopecks');
  const sign = kopecks < 0 ? '-' : '';
  const abs = Math.abs(Math.round(kopecks));
  const rub = Math.floor(abs / KOPECKS_PER_RUBLE);
  const kop = abs % KOPECKS_PER_RUBLE;
  const rubStr = String(rub).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${rubStr},${String(kop).padStart(2, '0')} ₽`;
}

/**
 * Splits an integer-kopecks total by `ratio` into `[a, b]` so that a + b always
 * equals the original total (b absorbs the rounding remainder). Mirrors the
 * existing dispute SPLIT rule (a = round(total*ratio), b = total - a).
 */
export function splitKopecks(totalKopecks: number, ratio: number): [number, number] {
  assertFinite(totalKopecks, 'totalKopecks');
  assertFinite(ratio, 'ratio');
  if (!isWholeKopecks(totalKopecks)) {
    throw new Error(`money: splitKopecks total must be integer kopecks, got ${totalKopecks}`);
  }
  const a = Math.round(totalKopecks * ratio);
  return [a, totalKopecks - a];
}

/** Money snapshot in integer kopecks for invariant checks. */
export interface MoneyKopecksSnapshot {
  totalKopecks: number;
  releasedKopecks: number;
  disputedKopecks: number;
  heldKopecks: number;
}

/**
 * Asserts the core money invariants on an integer-kopecks snapshot. Throws on
 * any violation. (Idempotency / no-double-release is enforced at the engine
 * level; here the conservation bound prevents the *effect* of an over/double
 * release.)
 *
 *  - all amounts are whole kopecks;
 *  - no negative release;
 *  - release ≤ available (total − disputed − held);
 *  - disputed + held + released ≤ total.
 */
export function assertMoneyInvariants(s: MoneyKopecksSnapshot): void {
  const fields: (keyof MoneyKopecksSnapshot)[] = [
    'totalKopecks',
    'releasedKopecks',
    'disputedKopecks',
    'heldKopecks',
  ];
  for (const f of fields) {
    if (!isWholeKopecks(s[f])) {
      throw new Error(`money: ${f} must be integer kopecks, got ${s[f]}`);
    }
  }
  if (s.releasedKopecks < 0) {
    throw new Error(`money: releasedKopecks must not be negative, got ${s.releasedKopecks}`);
  }
  if (s.disputedKopecks < 0 || s.heldKopecks < 0 || s.totalKopecks < 0) {
    throw new Error('money: total/disputed/held must not be negative');
  }
  const available = s.totalKopecks - s.disputedKopecks - s.heldKopecks;
  if (s.releasedKopecks > available) {
    throw new Error(
      `money: release ${s.releasedKopecks} exceeds available ${available} (total ${s.totalKopecks} − disputed ${s.disputedKopecks} − held ${s.heldKopecks})`,
    );
  }
  if (s.disputedKopecks + s.heldKopecks + s.releasedKopecks > s.totalKopecks) {
    throw new Error('money: disputed + held + released must not exceed total');
  }
}
