import { describe, expect, it } from 'vitest';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import { handlePlatformV7ServerActionRouteBody } from '@/lib/platform-v7/server-action-route-handler';

describe('platform-v7 server action route money guard', () => {
  it('exposes blocked money guard when amount and currency are absent', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'request_money_reserve',
      actorId: 'buyer-1',
      entityId: 'money-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'request_money_reserve',
      actorId: 'buyer-1',
      actorRole: 'buyer',
      entityId: 'money-1',
      entityType: 'money_record',
      dealId: 'deal-1',
      idempotencyKey,
      occurredAt: '2026-05-08T03:20:00.000Z',
      summary: 'Reserve boundary checked.',
    });

    expect(result.body.moneyGuardSummary).toMatchObject({
      status: 'blocked_missing_amount_or_currency',
      canReachMoneyRuntimeBoundary: false,
      canClaimMoneyMoved: false,
      amountValid: false,
    });
  });

  it('exposes ready money guard for complete reserve request boundary', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'request_money_reserve',
      actorId: 'buyer-1',
      entityId: 'money-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'request_money_reserve',
      actorId: 'buyer-1',
      actorRole: 'buyer',
      entityId: 'money-1',
      entityType: 'money_record',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      idempotencyKey,
      occurredAt: '2026-05-08T03:20:00.000Z',
      summary: 'Reserve boundary checked.',
    });

    expect(result.body.moneyGuardSummary).toMatchObject({
      status: 'ready_for_money_runtime_boundary',
      canReachMoneyRuntimeBoundary: true,
      canClaimMoneyMoved: false,
      amountValid: true,
    });
  });
});
