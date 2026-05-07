import type { PlatformV7ApiBoundaryId } from './api-boundary-contracts';

export type PlatformV7IdempotencyKeyInput = {
  readonly boundaryId: PlatformV7ApiBoundaryId;
  readonly actorId: string;
  readonly entityId: string;
  readonly dealId?: string;
  readonly amountMinor?: number;
  readonly currency?: string;
  readonly attemptId?: string;
};

export type PlatformV7IdempotencyKeyValidationResult = {
  readonly ok: boolean;
  readonly issues: readonly string[];
};

const normalizePart = (value: string | number | undefined): string => {
  if (value === undefined) return 'none';

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

export function buildPlatformV7IdempotencyKey(input: PlatformV7IdempotencyKeyInput): string {
  const parts = [
    'p7',
    normalizePart(input.boundaryId),
    `actor-${normalizePart(input.actorId)}`,
    `entity-${normalizePart(input.entityId)}`,
    `deal-${normalizePart(input.dealId)}`,
    `amount-${normalizePart(input.amountMinor)}`,
    `currency-${normalizePart(input.currency)}`,
    `attempt-${normalizePart(input.attemptId)}`,
  ];

  return parts.join(':');
}

export function validatePlatformV7IdempotencyKey(key: string): PlatformV7IdempotencyKeyValidationResult {
  const issues: string[] = [];
  const parts = key.split(':');

  if (parts.length !== 8) {
    issues.push('Idempotency key must contain 8 parts.');
  }

  if (parts[0] !== 'p7') {
    issues.push('Idempotency key must start with p7 namespace.');
  }

  if (!parts[1]) {
    issues.push('Idempotency key must include boundary id.');
  }

  if (!parts[2]?.startsWith('actor-') || parts[2] === 'actor-none') {
    issues.push('Idempotency key must include actor id.');
  }

  if (!parts[3]?.startsWith('entity-') || parts[3] === 'entity-none') {
    issues.push('Idempotency key must include entity id.');
  }

  if (!parts[4]?.startsWith('deal-')) {
    issues.push('Idempotency key must include deal segment.');
  }

  if (!parts[5]?.startsWith('amount-')) {
    issues.push('Idempotency key must include amount segment.');
  }

  if (!parts[6]?.startsWith('currency-')) {
    issues.push('Idempotency key must include currency segment.');
  }

  if (!parts[7]?.startsWith('attempt-')) {
    issues.push('Idempotency key must include attempt segment.');
  }

  return { ok: issues.length === 0, issues };
}

export function isPlatformV7MoneyIdempotencyKey(key: string): boolean {
  return key.includes(':amount-') && !key.includes(':amount-none') && key.includes(':currency-') && !key.includes(':currency-none');
}

export function getPlatformV7IdempotencyKeySummary(key: string) {
  const [namespace, boundaryId, actor, entity, deal, amount, currency, attempt] = key.split(':');

  return {
    namespace,
    boundaryId,
    actor,
    entity,
    deal,
    amount,
    currency,
    attempt,
    valid: validatePlatformV7IdempotencyKey(key).ok,
    moneyKey: isPlatformV7MoneyIdempotencyKey(key),
  };
}
