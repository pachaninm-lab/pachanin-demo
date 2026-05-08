import { describe, expect, it } from 'vitest';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import { handlePlatformV7ServerActionRouteBody } from '@/lib/platform-v7/server-action-route-handler';

describe('platform-v7 server action route risk review gate', () => {
  it('exposes ready risk review gate for clear party snapshot from top-level route fields', () => {
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
      occurredAt: '2026-05-08T05:20:00.000Z',
      summary: 'Proposal boundary checked.',
      partyId: 'seller-1',
      riskSnapshot: { status: 'clear', score: 91, source: 'test' },
    });

    expect(result.body.riskReviewGateSummary).toMatchObject({
      status: 'ready_for_risk_review_boundary',
      canReachRiskReviewBoundary: true,
      canClaimPartyCleared: false,
      requiresManualReview: false,
    });
  });

  it('keeps payload fallback for clear party snapshot', () => {
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
      occurredAt: '2026-05-08T05:20:00.000Z',
      summary: 'Proposal boundary checked.',
      payload: {
        partyId: 'seller-1',
        riskSnapshot: { status: 'clear', score: 91, source: 'test' },
      },
    });

    expect(result.body.riskReviewGateSummary).toMatchObject({
      status: 'ready_for_risk_review_boundary',
      canReachRiskReviewBoundary: true,
      requiresManualReview: false,
    });
  });

  it('exposes blocked risk review gate when snapshot is missing', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'accept_proposal',
      actorId: 'seller-1',
      entityId: 'proposal-1',
      dealId: 'deal-1',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'accept_proposal',
      actorId: 'seller-1',
      actorRole: 'seller',
      entityId: 'proposal-1',
      entityType: 'proposal',
      dealId: 'deal-1',
      idempotencyKey,
      occurredAt: '2026-05-08T05:20:00.000Z',
      summary: 'Proposal accept boundary checked.',
      partyId: 'buyer-1',
    });

    expect(result.body.riskReviewGateSummary).toMatchObject({
      status: 'blocked_missing_risk_snapshot',
      canReachRiskReviewBoundary: false,
      canClaimPartyCleared: false,
      requiresManualReview: true,
    });
  });
});
