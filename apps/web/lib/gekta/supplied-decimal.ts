import type { GektaLocale } from './content';

export const ARITHMETIC_SCALE = BigInt(1000);
export const ARITHMETIC_PRECISION = BigInt(1_000_000_000_000);
export const ARITHMETIC_NUMBER = '((?:\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3}){1,2}|\\d{1,9})(?:[.,]\\d{1,3})?)';
const suppliedNumberPattern = new RegExp(`^${ARITHMETIC_NUMBER}$`, 'u');

/** Parse a positive decimal onto the common three-place integer scale. */
export function parseSuppliedNumber(value: string, decimalNotationEstablished = false): bigint | null {
  if (!suppliedNumberPattern.test(value)) return null;
  // Outside a field with established decimal notation, a three-digit suffix
  // after a nonzero integer could represent a thousands group.
  const grouped = /[ \u00a0\u202f]/u.test(value);
  if (!decimalNotationEstablished && !grouped && /[.,]\d{3}$/u.test(value) && !/^0[.,]/u.test(value)) return null;
  const [whole, fraction = ''] = value.replace(/[ \u00a0\u202f]/gu, '').replace(',', '.').split('.');
  return BigInt(whole) * ARITHMETIC_SCALE + BigInt(fraction.padEnd(3, '0'));
}

export function arithmeticDecimal(numerator: bigint, denominator: bigint, locale: GektaLocale, decimals?: number): string {
  const precision = decimals === undefined ? ARITHMETIC_PRECISION : BigInt(10) ** BigInt(decimals);
  const magnitude = numerator < BigInt(0) ? -numerator : numerator;
  const rounded = (magnitude * precision * BigInt(2) + denominator) / (denominator * BigInt(2));
  const whole = rounded / precision;
  const padded = String(rounded % precision).padStart(decimals ?? 12, '0');
  const fraction = decimals === undefined ? padded.replace(/0+$/u, '') : decimals === 0 ? '' : padded;
  const sign = numerator < BigInt(0) && rounded !== BigInt(0) ? '−' : '';
  return `${sign}${whole}${fraction ? `${locale === 'ru' ? ',' : '.'}${fraction}` : ''}`;
}

const suppliedFormFields: Readonly<Record<string, string>> = {
  ref: '[\\p{L}\\d][\\p{L}\\d-]{0,40}',
  crop: '[\\p{L}]+(?:[ -][\\p{L}]+){0,3}',
  year: '\\d{4}',
};

/** Static full-sentence forms admit typed operands and keep extra context out. */
export function compileSuppliedForm(form: string, fields: Readonly<Record<string, string>> = {}): RegExp {
  const expression = form.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&').replace(/@(\w+)/gu,
    (_token, field: string) => fields[field] ?? suppliedFormFields[field] ?? `(?<${field}>${ARITHMETIC_NUMBER})`);
  return new RegExp(`^${expression}$`, 'iu');
}
