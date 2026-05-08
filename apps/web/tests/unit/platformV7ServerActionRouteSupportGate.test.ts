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

  it('blocks support message append when support case id is missing', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'append_support_message',
      actorId: 'operator-1',
      entityId: 'message-1',
      dealId: 'deal-1',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'append_support_message',
      actorId: 'operator-1',
      actorRole: 'operator',
      entityId: 'message-1',
      entityType: 'support_message',
      dealId: 'deal-1',
      idempotencyKey,
      occurredAt: '2026-05-08T05:00:00.000Z',
      summary: 'Support message boundary checked.',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.body.supportGateSummary).toMatchObject({
      status: 'blocked_missing_support_case_id',
      canReachSupportRuntimeBoundary: false,
      canClaimSupportCaseCreated: false,
      canClaimSupportMessageAppended: false,
    });
  });

  it('exposes ready support gate for support message append with explicit support case id', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'append_support_message',
      actorId: 'operator-1',
      entityId: 'message-1',
      dealId: 'deal-1',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'append_support_message',
      actorId: 'operator-1',
      actorRole: 'operator',
      entityId: 'message-1',
      entityType: 'support_message',
      supportCaseId: 'support-1',
      dealId: 'deal-1',
      idempotencyKey,
      occurredAt: '2026-05-08T05:00:00.000Z',
      summary: 'Support message boundary checked.',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(result.body.supportGateSummary).toMatchObject({
      status: 'ready_for_support_runtime_boundary',
      canReachSupportRuntimeBoundary: true,
      canClaimSupportCaseCreated: false,
      canClaimSupportMessageAppended: false,
    });
  });

  it('accepts support case id from payload for compatibility with clients that cannot send top-level fields', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'append_support_message',
      actorId: 'operator-1',
      entityId: 'message-1',
      dealId: 'deal-1',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'append_support_message',
      actorId: 'operator-1',
      actorRole: 'operator',
      entityId: 'message-1',
      entityType: 'support_message',
      dealId: 'deal-1',
      idempotencyKey,
      occurredAt: '2026-05-08T05:00:00.000Z',
      summary: 'Support message boundary checked.',
      payload: { supportCaseId: 'support-1' },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(result.body.supportGateSummary).toMatchObject({
      status: 'ready_for_support_runtime_boundary',
      canReachSupportRuntimeBoundary: true,
    });
  });
});
