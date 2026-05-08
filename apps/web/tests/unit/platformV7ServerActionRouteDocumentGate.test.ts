import { describe, expect, it } from 'vitest';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import { handlePlatformV7ServerActionRouteBody } from '@/lib/platform-v7/server-action-route-handler';

describe('platform-v7 server action route document gate', () => {
  it('blocks document upload when document id is missing', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'upload_document',
      actorId: 'seller-1',
      entityId: 'deal-1',
      dealId: 'deal-1',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'upload_document',
      actorId: 'seller-1',
      actorRole: 'seller',
      entityId: 'deal-1',
      entityType: 'deal',
      dealId: 'deal-1',
      idempotencyKey,
      occurredAt: '2026-05-08T04:20:00.000Z',
      summary: 'Document upload boundary checked.',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.body.documentGateSummary).toMatchObject({
      status: 'blocked_missing_document_id',
      canReachDocumentRuntimeBoundary: false,
      canClaimDocumentAccepted: false,
      requiresExternalConfirmation: false,
    });
  });

  it('exposes ready document gate for document upload boundary with explicit document id', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'upload_document',
      actorId: 'seller-1',
      entityId: 'deal-1',
      dealId: 'deal-1',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'upload_document',
      actorId: 'seller-1',
      actorRole: 'seller',
      entityId: 'deal-1',
      entityType: 'deal',
      documentId: 'doc-1',
      dealId: 'deal-1',
      idempotencyKey,
      occurredAt: '2026-05-08T04:20:00.000Z',
      summary: 'Document upload boundary checked.',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(result.body.documentGateSummary).toMatchObject({
      status: 'ready_for_document_runtime_boundary',
      canReachDocumentRuntimeBoundary: true,
      canClaimDocumentAccepted: false,
      requiresExternalConfirmation: false,
    });
  });

  it('accepts document id from payload for clients that cannot send top-level fields', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'upload_document',
      actorId: 'seller-1',
      entityId: 'deal-1',
      dealId: 'deal-1',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'upload_document',
      actorId: 'seller-1',
      actorRole: 'seller',
      entityId: 'deal-1',
      entityType: 'deal',
      dealId: 'deal-1',
      idempotencyKey,
      occurredAt: '2026-05-08T04:20:00.000Z',
      summary: 'Document upload boundary checked.',
      payload: { documentId: 'doc-1' },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(result.body.documentGateSummary).toMatchObject({
      status: 'ready_for_document_runtime_boundary',
      canReachDocumentRuntimeBoundary: true,
    });
  });

  it('exposes blocked document gate for document acceptance without confirmation readiness', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'accept_document',
      actorId: 'operator-1',
      entityId: 'deal-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'accept_document',
      actorId: 'operator-1',
      actorRole: 'operator',
      entityId: 'deal-1',
      entityType: 'deal',
      documentId: 'doc-1',
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

  it('allows document acceptance to reach runtime boundary when explicit confirmation readiness is present', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'accept_document',
      actorId: 'operator-1',
      entityId: 'deal-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'accept_document',
      actorId: 'operator-1',
      actorRole: 'operator',
      entityId: 'deal-1',
      entityType: 'deal',
      documentId: 'doc-1',
      externalConfirmationReady: true,
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      idempotencyKey,
      occurredAt: '2026-05-08T04:20:00.000Z',
      summary: 'Document acceptance boundary checked.',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(result.body.documentGateSummary).toMatchObject({
      status: 'ready_for_document_runtime_boundary',
      canReachDocumentRuntimeBoundary: true,
      canClaimDocumentAccepted: false,
      requiresExternalConfirmation: true,
    });
  });

  it('allows document acceptance without treating it as a direct money operation', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'accept_document',
      actorId: 'operator-1',
      entityId: 'deal-1',
      dealId: 'deal-1',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'accept_document',
      actorId: 'operator-1',
      actorRole: 'operator',
      entityId: 'deal-1',
      entityType: 'deal',
      documentId: 'doc-1',
      externalConfirmationReady: true,
      dealId: 'deal-1',
      idempotencyKey,
      occurredAt: '2026-05-08T04:20:00.000Z',
      summary: 'Document acceptance boundary checked.',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(result.body.documentGateSummary).toMatchObject({
      status: 'ready_for_document_runtime_boundary',
      canReachDocumentRuntimeBoundary: true,
      canClaimDocumentAccepted: false,
      requiresExternalConfirmation: true,
    });
    expect(result.body.auditSummary).toMatchObject({
      canProceed: true,
      moneyAuditComplete: true,
    });
    expect(result.body.moneyGuardSummary).toMatchObject({
      status: 'not_money_boundary',
      canReachMoneyRuntimeBoundary: true,
      canClaimMoneyMoved: false,
      amountValid: true,
    });
  });

  it('accepts document confirmation readiness from payload for compatibility', () => {
    const idempotencyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'accept_document',
      actorId: 'operator-1',
      entityId: 'deal-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      attemptId: 'attempt-1',
    });

    const result = handlePlatformV7ServerActionRouteBody({
      boundaryId: 'accept_document',
      actorId: 'operator-1',
      actorRole: 'operator',
      entityId: 'deal-1',
      entityType: 'deal',
      documentId: 'doc-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      idempotencyKey,
      occurredAt: '2026-05-08T04:20:00.000Z',
      summary: 'Document acceptance boundary checked.',
      payload: { externalConfirmationReady: true },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(result.body.documentGateSummary).toMatchObject({
      status: 'ready_for_document_runtime_boundary',
      canReachDocumentRuntimeBoundary: true,
      canClaimDocumentAccepted: false,
    });
  });
});
