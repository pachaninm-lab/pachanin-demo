import { describe, expect, it } from 'vitest';
import {
  buildPlatformV7IdempotencyKey,
  getPlatformV7IdempotencyKeySummary,
  isPlatformV7MoneyIdempotencyKey,
  validatePlatformV7IdempotencyKey,
} from '@/lib/platform-v7/idempotency-key-helper';

describe('platform-v7 idempotency key helper', () => {
  it('builds stable keys for the same execution input', () => {
    const input = {
      boundaryId: 'confirm_money_released' as const,
      actorId: 'bank-1',
      entityId: 'money-1',
      dealId: 'deal-1',
      amountMinor: 964800000,
      currency: 'RUB',
      attemptId: 'attempt-1',
    };

    expect(buildPlatformV7IdempotencyKey(input)).toBe(buildPlatformV7IdempotencyKey(input));
  });

  it('changes keys when amount or attempt changes', () => {
    const base = {
      boundaryId: 'confirm_money_released' as const,
      actorId: 'bank-1',
      entityId: 'money-1',
      dealId: 'deal-1',
      currency: 'RUB',
    };

    const first = buildPlatformV7IdempotencyKey({ ...base, amountMinor: 100, attemptId: 'a1' });
    const second = buildPlatformV7IdempotencyKey({ ...base, amountMinor: 101, attemptId: 'a1' });
    const third = buildPlatformV7IdempotencyKey({ ...base, amountMinor: 100, attemptId: 'a2' });

    expect(first).not.toBe(second);
    expect(first).not.toBe(third);
  });

  it('validates required namespace, actor and entity segments', () => {
    const valid = buildPlatformV7IdempotencyKey({
      boundaryId: 'open_dispute',
      actorId: 'seller-1',
      entityId: 'dispute-1',
      dealId: 'deal-1',
      amountMinor: 1000,
      currency: 'RUB',
      attemptId: 'first',
    });

    expect(validatePlatformV7IdempotencyKey(valid)).toEqual({ ok: true, issues: [] });
    expect(validatePlatformV7IdempotencyKey('wrong')).toMatchObject({ ok: false });
  });

  it('detects money idempotency keys', () => {
    const moneyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'confirm_money_reserved',
      actorId: 'bank-1',
      entityId: 'money-1',
      dealId: 'deal-1',
      amountMinor: 100,
      currency: 'RUB',
    });
    const nonMoneyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'assign_driver',
      actorId: 'logistics-1',
      entityId: 'trip-1',
      dealId: 'deal-1',
    });

    expect(isPlatformV7MoneyIdempotencyKey(moneyKey)).toBe(true);
    expect(isPlatformV7MoneyIdempotencyKey(nonMoneyKey)).toBe(false);
  });

  it('returns a readable summary', () => {
    const key = buildPlatformV7IdempotencyKey({
      boundaryId: 'confirm_money_released',
      actorId: 'bank-1',
      entityId: 'money-1',
      dealId: 'deal-1',
      amountMinor: 100,
      currency: 'RUB',
      attemptId: 'first',
    });

    expect(getPlatformV7IdempotencyKeySummary(key)).toMatchObject({
      namespace: 'p7',
      boundaryId: 'confirm_money_released',
      valid: true,
      moneyKey: true,
    });
  });
});
