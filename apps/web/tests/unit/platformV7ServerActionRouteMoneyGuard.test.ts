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
      payload: {
        dealId: 'deal-1',
        amountMinor: 100_000,
        currency: 'RUB',
        bankReferenceId: 'bank-evt-1',
        confirmedAt: '2026-05-08T05:00:00.000Z',
      },
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
      payload: {
        dealId: 'deal-1',
        amountMinor: 100_000,
        currency: 'RUB',
        bankReferenceId: 'bank-evt-1',
        confirmedAt: '2026-05-08T05:00:00.000Z',
      },
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

  it.each([
    ['confirm_money_released', false], ['confirm_money_released', true],
    ['unregistered_money_operation', false], ['unregistered_money_operation', true],
  ] as const)('rejects %s with readiness=%s without a contradictory review or runtime claim', (boundaryId, ready) => {
    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId, actorId: 'bank-1', actorRole: 'bank',
      entityId: 'money-1', entityType: 'money_record', dealId: 'deal-1',
      amountMinor: 100_000, currency: 'RUB',
      idempotencyKey: 'rejected-contract-regression-intent',
      occurredAt: '2026-05-08T03:20:00.000Z', summary: 'Rejected contract regression.',
      payload: { externalConfirmationReady: ready, dealId: 'deal-1', amountMinor: 100_000,
        currency: 'RUB', bankReferenceId: 'bank-evt-1', confirmedAt: '2026-05-08T05:00:00.000Z' },
    });
    expect(result).toMatchObject({ ok: false, status: 400, httpMeaning: 'not_accepted' });
    expect(result.body).toMatchObject({
      ok: false, acceptedForReview: false,
      response: { status: 'not_accepted', canClaimExecuted: false, persisted: false, attemptedRuntimeWrite: false },
      executionClaim: { executed: false, persisted: false, moneyMoved: false, externalConfirmed: false,
        stage: 'stopped_by_server_boundary' },
      routeSummary: { status: 'stopped_by_server_boundary', runtimeStage: 'stopped_by_server_boundary',
        canReachRuntimeBoundary: false, canAttemptRuntimeWrite: false, canClaimExecuted: false, persisted: false },
      persistenceSummary: { canAttemptRuntimeWrite: false, persisted: false, attemptedRuntimeWrite: false },
    });
    const summary = result.body.routeSummary as { issueCount: number; issues: readonly { boundary: string; status: string }[] };
    expect(summary.issueCount).toBeGreaterThan(0);
    expect(summary.issueCount).toBe(summary.issues.length);
    expect(summary.issues).toContainEqual(expect.objectContaining({ boundary: 'contract', status: 'not_accepted' }));
  });

  it('preserves payload readiness compatibility for the supported reserve confirmation without claiming execution', () => {
    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'confirm_money_reserved', actorId: 'bank-1', actorRole: 'bank',
      entityId: 'money-1', entityType: 'money_record', dealId: 'deal-1',
      amountMinor: 100_000, currency: 'RUB',
      idempotencyKey: buildPlatformV7IdempotencyKey({
        boundaryId: 'confirm_money_reserved', actorId: 'bank-1', entityId: 'money-1',
        dealId: 'deal-1', amountMinor: 100_000, currency: 'RUB', attemptId: 'payload-compatibility',
      }),
      occurredAt: '2026-05-08T03:20:00.000Z', summary: 'Reserve readiness contract only.',
      payload: { externalConfirmationReady: true, dealId: 'deal-1', amountMinor: 100_000,
        currency: 'RUB', bankReferenceId: 'bank-evt-1', confirmedAt: '2026-05-08T05:00:00.000Z' },
    });
    expect(result).toMatchObject({ ok: true, status: 202, httpMeaning: 'accepted_for_manual_review' });
    expect(result.body.moneyGuardSummary).toMatchObject({
      status: 'ready_for_money_runtime_boundary', canReachMoneyRuntimeBoundary: true,
      canClaimMoneyMoved: false, requiresBankOrExternalConfirmation: true,
    });
    expect(result.body.executionClaim).toMatchObject({
      executed: false, persisted: false, moneyMoved: false, externalConfirmed: false,
    });
    expect(result.body.routeSummary).toMatchObject({
      canClaimExecuted: false, persisted: false, canAttemptRuntimeWrite: false,
    });
  });

});
