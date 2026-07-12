import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * A validated JSON object with no undefined values. Keeping the index value as
 * Prisma.InputJsonValue makes nested command/event payloads assignable to the
 * Prisma JSON write contract without weakening the boundary to `unknown`.
 */
export type JsonRecord = Record<string, Prisma.InputJsonValue>;

const DECIMAL_6 = /^\d+(?:\.\d{1,6})?$/;
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export function invalid(field: string, message: string): never {
  throw new UnprocessableEntityException({
    code: 'UNPROCESSABLE_ENTITY',
    field,
    message,
  });
}

export function record(value: unknown, field = 'payload'): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid(field, 'Передай объект с подтверждёнными данными операции.');
  }
  return value as JsonRecord;
}

export function requiredString(payload: JsonRecord, field: string, min = 1): string {
  const candidate = payload[field];
  const value = typeof candidate === 'string' ? candidate.trim() : '';
  if (value.length < min) invalid(field, `Заполни поле «${field}».`);
  return value;
}

export function optionalString(payload: JsonRecord, field: string): string | undefined {
  const candidate = payload[field];
  const value = typeof candidate === 'string' ? candidate.trim() : '';
  return value || undefined;
}

export function requiredIso(payload: JsonRecord, field: string): Date {
  const value = requiredString(payload, field);
  if (!ISO_WITH_ZONE.test(value)) invalid(field, 'Укажи точное время с часовым поясом.');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) invalid(field, 'Укажи корректное время.');
  return parsed;
}

export function requiredDecimal(payload: JsonRecord, field: string, allowZero = false): string {
  const value = requiredString(payload, field);
  if (!DECIMAL_6.test(value)) invalid(field, 'Используй положительное число с точностью не более 6 знаков после запятой.');
  const micro = decimalToMicro(value, field);
  if (allowZero ? micro < 0n : micro <= 0n) invalid(field, allowZero ? 'Значение не может быть отрицательным.' : 'Значение должно быть больше нуля.');
  return microToDecimal(micro);
}

export function decimalToMicro(value: string, field: string): bigint {
  if (!DECIMAL_6.test(value)) invalid(field, 'Некорректное десятичное значение.');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}

export function microToDecimal(value: bigint): string {
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, '0');
  return `${whole}.${fraction}`;
}

export function optionalCoordinate(payload: JsonRecord, field: string, min: number, max: number): number | undefined {
  const candidate = payload[field];
  if (candidate === undefined || candidate === null || candidate === '') return undefined;
  const value = typeof candidate === 'number' ? candidate : Number(candidate);
  if (!Number.isFinite(value) || value < min || value > max) invalid(field, `Значение ${field} вне допустимого диапазона.`);
  return value;
}

export function requiredArray(payload: JsonRecord, field: string): Prisma.InputJsonValue[] {
  const value = payload[field];
  if (!Array.isArray(value) || value.length === 0) invalid(field, `Добавь хотя бы одну запись в «${field}».`);
  return value;
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
