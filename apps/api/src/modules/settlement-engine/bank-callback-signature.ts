import { BadRequestException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';

export const BANK_CALLBACK_TOLERANCE_SECONDS = 300;
export const BANK_CALLBACK_PATH = '/api/settlement-engine/bank-callback';

export type JsonRecord = Record<string, unknown>;

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableJsonValue(item)]),
    );
  }
  return value;
}

export function canonicalizeBankPayload(body: JsonRecord): string {
  return JSON.stringify(stableJsonValue(body));
}

export function expectedBankOperationId(dealId: string, operation: unknown): string {
  if (operation === 'RESERVE') return `bank-reserve:${dealId}`;
  if (operation === 'RELEASE') return `bank-release:${dealId}`;
  throw new BadRequestException('Unsupported bank operation');
}

export function buildBankSignaturePayload(input: {
  partnerId: string;
  keyId: string;
  timestamp: number;
  eventId: string;
  body: JsonRecord;
}): string {
  const bodyHash = createHash('sha256').update(canonicalizeBankPayload(input.body)).digest('hex');
  return [
    'POST',
    BANK_CALLBACK_PATH,
    input.partnerId,
    input.keyId,
    String(input.timestamp),
    input.eventId,
    bodyHash,
  ].join('\n');
}

export function secureSignatureMatch(actual: string | undefined, expected: string): boolean {
  const actualBuffer = Buffer.from(actual ?? '', 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
