import { describe, expect, it } from 'vitest';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import { handlePlatformV7ServerActionRouteBody } from '@/lib/platform-v7/server-action-route-handler';

describe('platform-v7 server action route idempotency exposure', () => {
  it('stops sensitive write route responses when idempotency key is missing', () => {
    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'request_money_reserve',
      actorId: 'buyer-1',
      actorRole: 'buyer',
      entityId: 'money-1',
      entityType: 'money_record',
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
      status: 'blocked_missing_idempotency_key',
      canProceed: false,
      requiresIdempotencyRecord: true,
      keyValid: false,
      moneyKey: false,
    });
    expect(result.body.routeSummary).toMatchObject({
      status: 'stopped_by_server_boundary',
      canReachRuntimeBoundary: false,
      canAttemptRuntimeWrite: false,
    });
  });

  it('stops invalid money-looking idempotency keys before runtime boundary', () => {
    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'request_money_reserve',
      actorId: 'buyer-1',
      actorRole: 'buyer',
      entityId: 'money-1',
      entityType: 'money_record',
      idempotencyKey: 'wrong:request_money_reserve:actor-buyer:entity-money:deal-1:amount-100000:currency-rub:attempt-1',
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
      status: 'blocked_invalid_idempotency_key',
      canProceed: false,
      requiresIdempotencyRecord: true,
      keyValid: false,
      moneyKey: false,
    });
    expect(result.body.routeSummary).toMatchObject({
      status: 'stopped_by_server_boundary',
      canReachRuntimeBoundary: false,
      canAttemptRuntimeWrite: false,
    });
  });

  it('exposes ready idempotency boundary when money key is complete', () => {
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

    expect(result.status).toBe(202);
    expect(result.body.idempotencySummary).toMatchObject({
      status: 'ready_for_idempotency_record',
      canProceed: true,
      requiresIdempotencyRecord: true,
      keyValid: true,
      moneyKey: true,
    });
  });
});
