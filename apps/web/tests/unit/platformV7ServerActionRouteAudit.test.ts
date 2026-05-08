import { describe, expect, it } from 'vitest';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import { handlePlatformV7ServerActionRouteBody } from '@/lib/platform-v7/server-action-route-handler';

describe('platform-v7 server action route audit exposure', () => {
  it('exposes audit boundary for read route responses without requiring audit record', () => {
    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'list_batches',
      actorId: 'seller-1',
      actorRole: 'seller',
      entityId: 'batch-list',
      entityType: 'grain_batch',
      occurredAt: '2026-05-08T03:00:00.000Z',
      summary: 'Batch list boundary checked.',
    });

    expect(result.status).toBe(202);
    expect(result.body.auditSummary).toMatchObject({
      status: 'not_required_read_boundary',
      canProceed: true,
      requiresAuditRecord: false,
      auditEventValid: true,
    });
  });

  it('exposes invalid audit boundary for write responses without idempotency key', () => {
    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'create_batch',
      actorId: 'seller-1',
      actorRole: 'seller',
      entityId: 'batch-1',
      entityType: 'grain_batch',
      occurredAt: '2026-05-08T03:00:00.000Z',
      summary: 'Create batch boundary checked.',
    });

    expect(result.status).toBe(202);
    expect(result.body.auditBoundary).toMatchObject({
      status: 'blocked_invalid_audit_event',
      canProceed: false,
      requiresAuditRecord: true,
      auditEventValid: false,
      appendOnly: true,
    });
  });

  it('exposes ready audit boundary for complete money route responses', () => {
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
      occurredAt: '2026-05-08T03:00:00.000Z',
      summary: 'Reserve request boundary checked.',
    });

    expect(result.status).toBe(202);
    expect(result.body.auditSummary).toMatchObject({
      status: 'ready_for_append_only_audit_record',
      canProceed: true,
      requiresAuditRecord: true,
      auditEventValid: true,
      appendOnly: true,
      moneyAuditComplete: true,
    });
  });
});
