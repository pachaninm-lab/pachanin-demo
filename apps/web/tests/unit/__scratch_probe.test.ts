import { appendFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import { handlePlatformV7ServerActionRouteBody } from '@/lib/platform-v7/server-action-route-handler';

const log = (...args: unknown[]) => appendFileSync('/tmp/probe.log', args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a, null, 1))).join(' ') + '\n');

describe('probe', () => {
  it('probe submit_proposal without idempotency key', () => {
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
        counterpartyId: 'seller-1',
        priceRubPerTon: 14500,
        volumeTons: 200,
        validUntil: '2026-05-15T00:00:00.000Z',
      },
    });

    log('STATUS', result.status, 'OK', result.ok);
    log('routeSummary', JSON.stringify(result.body.routeSummary, null, 2));
    log('auditBoundary', JSON.stringify(result.body.auditBoundary));
    expect(true).toBe(true);
  });

  it('probe submit_proposal with idempotency key', () => {
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
        counterpartyId: 'seller-1',
        priceRubPerTon: 14500,
        volumeTons: 200,
        validUntil: '2026-05-15T00:00:00.000Z',
      },
    });

    log('STATUS2', result.status, 'OK', result.ok);
    log('routeSummary2', JSON.stringify(result.body.routeSummary, null, 2));
    expect(true).toBe(true);
  });
});
