import { describe, expect, it } from 'vitest';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import { handlePlatformV7ServerActionRouteBody } from '@/lib/platform-v7/server-action-route-handler';

describe('platform-v7 server action route summary', () => {
  it('marks route as stopped with 409 when idempotency boundary is missing', () => {
    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'submit_proposal',
      actorId: 'buyer-1',
      actorRole: 'buyer',
      entityId: 'proposal-1',
      entityType: 'proposal',
      dealId: 'deal-1',
      occurredAt: '2026-05-08T05:50:00.000Z',
      summary: 'Proposal boundary checked.',
      payload: {
        partyId: 'seller-1',
        riskSnapshot: { status: 'clear', score: 91, source: 'test' },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({ ok: false });
    expect(result.body.routeSummary).toMatchObject({
      status: 'stopped_by_server_boundary',
      canReachRuntimeBoundary: false,
      canAttemptRuntimeWrite: false,
      canClaimExecuted: false,
      persisted: false,
      issueCount: 1,
    });
  });

  it('returns 202 when gates pass but repository is not durable', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'submit_proposal',
      actorId: 'buyer-1',
      entityId: 'proposal-1',
      dealId: 'deal-1',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'submit_proposal',
      actorId: 'buyer-1',
      actorRole: 'buyer',
      entityId: 'proposal-1',
      entityType: 'proposal',
      dealId: 'deal-1',
      idempotencyKey,
      occurredAt: '2026-05-08T05:50:00.000Z',
      summary: 'Proposal boundary checked.',
      payload: {
        partyId: 'seller-1',
        riskSnapshot: { status: 'clear', score: 91, source: 'test' },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(result.body).toMatchObject({ ok: true });
    expect(result.body.routeSummary).toMatchObject({
      status: 'ready_for_manual_runtime_review',
      canReachRuntimeBoundary: true,
      canAttemptRuntimeWrite: false,
      canClaimExecuted: false,
      persisted: false,
      requiresManualReview: true,
      issueCount: 0,
    });
  });
});
