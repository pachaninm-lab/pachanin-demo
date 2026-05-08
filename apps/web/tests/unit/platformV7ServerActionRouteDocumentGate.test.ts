import { describe, expect, it } from 'vitest';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import { handlePlatformV7ServerActionRouteBody } from '@/lib/platform-v7/server-action-route-handler';

describe('platform-v7 server action route document gate', () => {
  it('exposes ready document gate for document upload boundary', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'upload_document',
      actorId: 'seller-1',
      entityId: 'doc-1',
      dealId: 'deal-1',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'upload_document',
      actorId: 'seller-1',
      actorRole: 'seller',
      entityId: 'doc-1',
      entityType: 'document_record',
      dealId: 'deal-1',
      idempotencyKey,
      occurredAt: '2026-05-08T04:20:00.000Z',
      summary: 'Document upload boundary checked.',
    });

    expect(result.body.documentGateSummary).toMatchObject({
      status: 'ready_for_document_runtime_boundary',
      canReachDocumentRuntimeBoundary: true,
      canClaimDocumentAccepted: false,
      requiresExternalConfirmation: false,
    });
  });

  it('exposes blocked document gate for document acceptance without confirmation readiness', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'accept_document',
      actorId: 'operator-1',
      entityId: 'doc-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'accept_document',
      actorId: 'operator-1',
      actorRole: 'operator',
      entityId: 'doc-1',
      entityType: 'document_record',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      idempotencyKey,
      occurredAt: '2026-05-08T04:20:00.000Z',
      summary: 'Document acceptance boundary checked.',
    });

    expect(result.body.documentGateSummary).toMatchObject({
      status: 'blocked_external_confirmation_required',
      canReachDocumentRuntimeBoundary: false,
      canClaimDocumentAccepted: false,
      requiresExternalConfirmation: true,
    });
  });
});
