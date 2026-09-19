import { describe, expect, it } from 'vitest';
import { checkPlatformV7ServerDocumentGate } from '@/lib/platform-v7/server-document-gate';
import type { PlatformV7ApiBoundaryId } from '@/lib/platform-v7/api-boundary-contracts';
import type { PlatformV7ServerActionContractResponse } from '@/lib/platform-v7/server-action-contract-wrapper';
import type { PlatformV7ServerAuditBoundaryResult } from '@/lib/platform-v7/server-audit-boundary';
import type { PlatformV7ServerIdempotencyBoundaryResult } from '@/lib/platform-v7/server-idempotency-boundary';

const response = (boundaryId: PlatformV7ApiBoundaryId): PlatformV7ServerActionContractResponse => ({
  boundaryId,
  status: 'contract_checked',
  httpStatus: 202,
  message: 'checked',
  nextAction: 'next',
  canClaimExecuted: false,
  persisted: false,
  attemptedRuntimeWrite: false,
  issueCount: 1,
  signalCount: 1,
  repositoryDurable: false,
});

const idempotencyReady: PlatformV7ServerIdempotencyBoundaryResult = {
  status: 'ready_for_idempotency_record',
  canProceed: true,
  requiresIdempotencyRecord: true,
  keyValid: true,
  moneyKey: false,
  reason: 'ready',
};

const auditReady: PlatformV7ServerAuditBoundaryResult = {
  status: 'ready_for_append_only_audit_record',
  canProceed: true,
  requiresAuditRecord: true,
  auditEventValid: true,
  appendOnly: true,
  moneyAuditComplete: true,
  reason: 'ready',
};

describe('platform-v7 server document gate', () => {
  it('does not block non-document boundaries', () => {
    const result = checkPlatformV7ServerDocumentGate({
      response: response('create_batch'),
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result).toMatchObject({
      status: 'not_document_boundary',
      canReachDocumentRuntimeBoundary: true,
      canClaimDocumentAccepted: false,
      requiresExternalConfirmation: false,
    });
  });

  it('blocks document boundaries without document id', () => {
    const result = checkPlatformV7ServerDocumentGate({
      response: response('upload_document'),
      dealId: 'deal-1',
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result.status).toBe('blocked_missing_document_id');
    expect(result.canReachDocumentRuntimeBoundary).toBe(false);
  });

  it('blocks document acceptance without external confirmation readiness', () => {
    const result = checkPlatformV7ServerDocumentGate({
      response: response('accept_document'),
      dealId: 'deal-1',
      documentId: 'doc-1',
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result).toMatchObject({
      status: 'blocked_external_confirmation_required',
      canReachDocumentRuntimeBoundary: false,
      canClaimDocumentAccepted: false,
      requiresExternalConfirmation: true,
    });
  });

  it('allows document upload to reach runtime boundary without accepting document', () => {
    const result = checkPlatformV7ServerDocumentGate({
      response: response('upload_document'),
      dealId: 'deal-1',
      documentId: 'doc-1',
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result).toMatchObject({
      status: 'ready_for_document_runtime_boundary',
      canReachDocumentRuntimeBoundary: true,
      canClaimDocumentAccepted: false,
      requiresExternalConfirmation: false,
    });
  });

  it('allows document acceptance to reach runtime boundary only with confirmation readiness', () => {
    const result = checkPlatformV7ServerDocumentGate({
      response: response('accept_document'),
      dealId: 'deal-1',
      documentId: 'doc-1',
      externalConfirmationReady: true,
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result).toMatchObject({
      status: 'ready_for_document_runtime_boundary',
      canReachDocumentRuntimeBoundary: true,
      canClaimDocumentAccepted: false,
      requiresExternalConfirmation: true,
    });
  });
});
