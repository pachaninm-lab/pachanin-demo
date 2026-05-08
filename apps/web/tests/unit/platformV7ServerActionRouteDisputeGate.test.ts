import { describe, expect, it } from 'vitest';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import { handlePlatformV7ServerActionRouteBody } from '@/lib/platform-v7/server-action-route-handler';

describe('platform-v7 server action route dispute gate', () => {
  it('exposes ready dispute gate for dispute opening with evidence', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'open_dispute',
      actorId: 'buyer-1',
      entityId: 'dispute-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'open_dispute',
      actorId: 'buyer-1',
      actorRole: 'buyer',
      entityId: 'dispute-1',
      entityType: 'dispute',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      idempotencyKey,
      evidenceRefs: ['evidence-1'],
      occurredAt: '2026-05-08T04:50:00.000Z',
      summary: 'Dispute opening boundary checked.',
    });

    expect(result.body.disputeGateSummary).toMatchObject({
      status: 'ready_for_dispute_runtime_boundary',
      canReachDisputeRuntimeBoundary: true,
      canClaimDisputeOpened: false,
      canClaimDisputeResolved: false,
      mayAffectMoney: true,
    });
  });

  it('exposes blocked dispute gate for dispute resolution without evidence', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'resolve_dispute',
      actorId: 'arbitrator-1',
      entityId: 'dispute-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'resolve_dispute',
      actorId: 'arbitrator-1',
      actorRole: 'arbitrator',
      entityId: 'dispute-1',
      entityType: 'dispute',
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
