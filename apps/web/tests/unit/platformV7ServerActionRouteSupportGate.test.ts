import { describe, expect, it } from 'vitest';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import { handlePlatformV7ServerActionRouteBody } from '@/lib/platform-v7/server-action-route-handler';

describe('platform-v7 server action route support gate', () => {
  it('exposes ready support gate for support case creation', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'create_support_case',
      actorId: 'seller-1',
      entityId: 'deal-1',
      dealId: 'deal-1',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'create_support_case',
      actorId: 'seller-1',
      actorRole: 'seller',
      entityId: 'deal-1',
      entityType: 'deal',
      dealId: 'deal-1',
      idempotencyKey,
      occurredAt: '2026-05-08T05:00:00.000Z',
      summary: 'Support case boundary checked.',
    });

    expect(result.body.supportGateSummary).toMatchObject({
      status: 'ready_for_support_runtime_boundary',
      canReachSupportRuntimeBoundary: true,
      canClaimSupportCaseCreated: false,
      canClaimSupportMessageAppended: false,
    });
  });

  it('exposes ready support gate for support message append without claiming append', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'append_support_message',
      actorId: 'operator-1',
      entityId: 'support-1',
      dealId: 'deal-1',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'append_support_message',
      actorId: 'operator-1',
      actorRole: 'operator',
      entityId: 'support-1',
      entityType: 'support_case',
      dealId: 'deal-1',
      idempotencyKey,
      occurredAt: '2026-05-08T05:00:00.000Z',
      summary: 'Support message boundary checked.',
    });

    expect(result.body.supportGateSummary).toMatchObject({
      status: 'ready_for_support_runtime_boundary',
      canReachSupportRuntimeBoundary: true,
      canClaimSupportCaseCreated: false,
      canClaimSupportMessageAppended: false,
    });
  });
});
