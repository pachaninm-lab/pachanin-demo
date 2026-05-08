import { describe, expect, it } from 'vitest';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import { handlePlatformV7ServerActionRouteBody } from '@/lib/platform-v7/server-action-route-handler';

describe('platform-v7 server action route dispute gate', () => {
  it('blocks dispute opening when dispute id is missing', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'open_dispute',
      actorId: 'buyer-1',
      entityId: 'deal-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'open_dispute',
      actorId: 'buyer-1',
      actorRole: 'buyer',
      entityId: 'deal-1',
      entityType: 'deal',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      idempotencyKey,
      evidenceRefs: ['evidence-1'],
      occurredAt: '2026-05-08T04:50:00.000Z',
      summary: 'Dispute opening boundary checked.',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.body.disputeGateSummary).toMatchObject({
      status: 'blocked_missing_dispute_id',
      canReachDisputeRuntimeBoundary: false,
      canClaimDisputeOpened: false,
      canClaimDisputeResolved: false,
      mayAffectMoney: true,
    });
  });

  it('exposes ready dispute gate for dispute opening with explicit dispute id and evidence', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'open_dispute',
      actorId: 'buyer-1',
      entityId: 'deal-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'open_dispute',
      actorId: 'buyer-1',
      actorRole: 'buyer',
      entityId: 'deal-1',
      entityType: 'deal',
      disputeId: 'dispute-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      idempotencyKey,
      evidenceRefs: ['evidence-1'],
      occurredAt: '2026-05-08T04:50:00.000Z',
      summary: 'Dispute opening boundary checked.',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(result.body.disputeGateSummary).toMatchObject({
      status: 'ready_for_dispute_runtime_boundary',
      canReachDisputeRuntimeBoundary: true,
      canClaimDisputeOpened: false,
      canClaimDisputeResolved: false,
      mayAffectMoney: true,
    });
  });

  it('accepts dispute id from payload for clients that cannot send top-level fields', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'open_dispute',
      actorId: 'buyer-1',
      entityId: 'deal-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'open_dispute',
      actorId: 'buyer-1',
      actorRole: 'buyer',
      entityId: 'deal-1',
      entityType: 'deal',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      idempotencyKey,
      evidenceRefs: ['evidence-1'],
      occurredAt: '2026-05-08T04:50:00.000Z',
      summary: 'Dispute opening boundary checked.',
      payload: { disputeId: 'dispute-1' },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(result.body.disputeGateSummary).toMatchObject({
      status: 'ready_for_dispute_runtime_boundary',
      canReachDisputeRuntimeBoundary: true,
    });
  });

  it('exposes blocked dispute gate for dispute resolution without evidence', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'resolve_dispute',
      actorId: 'arbitrator-1',
      entityId: 'deal-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'resolve_dispute',
      actorId: 'arbitrator-1',
      actorRole: 'arbitrator',
      entityId: 'deal-1',
      entityType: 'deal',
      disputeId: 'dispute-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      idempotencyKey,
      occurredAt: '2026-05-08T04:50:00.000Z',
      summary: 'Dispute resolution boundary checked.',
    });

    expect(result.body.disputeGateSummary).toMatchObject({
      status: 'blocked_missing_evidence_refs',
      canReachDisputeRuntimeBoundary: false,
      canClaimDisputeOpened: false,
      canClaimDisputeResolved: false,
      mayAffectMoney: true,
    });
  });
});
