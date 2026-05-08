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
      requiresBankOrExternalConfirmation: false,
      amountValid: true,
    });
  });

  it('blocks bank money confirmation boundary without explicit external confirmation readiness', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'confirm_money_reserved',
      actorId: 'bank-1',
      entityId: 'money-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'confirm_money_reserved',
      actorId: 'bank-1',
      actorRole: 'bank',
      entityId: 'money-1',
      entityType: 'money_record',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      idempotencyKey,
      occurredAt: '2026-05-08T03:20:00.000Z',
      summary: 'Bank reserve confirmation boundary checked.',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.body.moneyGuardSummary).toMatchObject({
      status: 'blocked_external_confirmation_required',
      canReachMoneyRuntimeBoundary: false,
      canClaimMoneyMoved: false,
      requiresBankOrExternalConfirmation: true,
      amountValid: true,
    });
  });

  it('allows bank money confirmation boundary to reach runtime boundary with explicit external confirmation readiness', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'confirm_money_reserved',
      actorId: 'bank-1',
      entityId: 'money-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'confirm_money_reserved',
      actorId: 'bank-1',
      actorRole: 'bank',
      entityId: 'money-1',
      entityType: 'money_record',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      externalConfirmationReady: true,
      idempotencyKey,
      occurredAt: '2026-05-08T03:20:00.000Z',
      summary: 'Bank reserve confirmation boundary checked.',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(result.body.moneyGuardSummary).toMatchObject({
      status: 'ready_for_money_runtime_boundary',
      canReachMoneyRuntimeBoundary: true,
      canClaimMoneyMoved: false,
      requiresBankOrExternalConfirmation: true,
      amountValid: true,
    });
  });

  it('accepts external confirmation readiness from payload for bank money confirmation compatibility', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'confirm_money_released',
      actorId: 'bank-1',
      entityId: 'money-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'confirm_money_released',
      actorId: 'bank-1',
      actorRole: 'bank',
      entityId: 'money-1',
      entityType: 'money_record',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      idempotencyKey,
      occurredAt: '2026-05-08T03:20:00.000Z',
      summary: 'Bank release confirmation boundary checked.',
      payload: { externalConfirmationReady: true },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(result.body.moneyGuardSummary).toMatchObject({
      status: 'ready_for_money_runtime_boundary',
      canReachMoneyRuntimeBoundary: true,
      canClaimMoneyMoved: false,
      requiresBankOrExternalConfirmation: true,
    });
  });
});
