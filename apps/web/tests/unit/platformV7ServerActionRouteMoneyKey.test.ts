import { describe, expect, it } from 'vitest';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import { handlePlatformV7ServerActionRouteBody } from '@/lib/platform-v7/server-action-route-handler';

describe('platform-v7 server action route money key boundary', () => {
  it('stops incomplete direct money idempotency keys before runtime boundary', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'request_money_reserve',
      actorId: 'buyer-1',
      entityId: 'money-1',
      dealId: 'deal-1',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'request_money_reserve',
      actorId: 'buyer-1',
      actorRole: 'buyer',
      entityId: 'money-1',
      entityType: 'money_record',
      idempotencyKey,
      payload: {
        dealId: 'deal-1',
        amountMinor: 100_000,
        currency: 'RUB',
        reason: 'Reserve request.',
      },
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Reserve boundary checked.',
    });

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      httpMeaning: 'stopped_by_server_boundary',
    });
    expect(result.body.idempotencyBoundary).toMatchObject({
      status: 'blocked_money_key_incomplete',
      canProceed: false,
      requiresIdempotencyRecord: true,
      keyValid: true,
      moneyKey: false,
    });
    expect(result.body.routeSummary).toMatchObject({
      status: 'stopped_by_server_boundary',
      canReachRuntimeBoundary: false,
      canAttemptRuntimeWrite: false,
    });
  });
});
