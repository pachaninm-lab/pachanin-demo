import { getPlatformV7ApiBoundary } from './api-boundary-contracts';
import type { PlatformV7ServerActionContractResponse } from './server-action-contract-wrapper';
import type { PlatformV7ServerAuditBoundaryResult } from './server-audit-boundary';
import type { PlatformV7ServerIdempotencyBoundaryResult } from './server-idempotency-boundary';

export type PlatformV7ServerDocumentGateStatus =
  | 'not_document_boundary'
  | 'blocked_missing_deal_id'
  | 'blocked_missing_document_id'
  | 'blocked_idempotency_boundary'
  | 'blocked_audit_boundary'
  | 'blocked_external_confirmation_required'
  | 'ready_for_document_runtime_boundary';

export type PlatformV7ServerDocumentGateInput = {
  readonly response: PlatformV7ServerActionContractResponse;
  readonly dealId?: string;
  readonly documentId?: string;
  readonly externalConfirmationReady?: boolean;
  readonly idempotencyBoundary: PlatformV7ServerIdempotencyBoundaryResult;
  readonly auditBoundary: PlatformV7ServerAuditBoundaryResult;
};

export type PlatformV7ServerDocumentGateResult = {
  readonly status: PlatformV7ServerDocumentGateStatus;
  readonly canReachDocumentRuntimeBoundary: boolean;
  readonly canClaimDocumentAccepted: false;
  readonly requiresExternalConfirmation: boolean;
  readonly reason: string;
};

const hasText = (value: string | undefined): boolean => typeof value === 'string' && value.trim().length > 0;
const isDocumentBoundary = (boundaryId: string): boolean =>
  boundaryId === 'upload_document' || boundaryId === 'accept_document';

export function checkPlatformV7ServerDocumentGate(
  input: PlatformV7ServerDocumentGateInput,
): PlatformV7ServerDocumentGateResult {
  const boundary = getPlatformV7ApiBoundary(input.response.boundaryId);

  if (!isDocumentBoundary(input.response.boundaryId)) {
    return {
      status: 'not_document_boundary',
      canReachDocumentRuntimeBoundary: true,
      canClaimDocumentAccepted: false,
      requiresExternalConfirmation: false,
      reason: 'Boundary does not change document state.',
    };
  }

  if (!hasText(input.dealId)) {
    return {
      status: 'blocked_missing_deal_id',
      canReachDocumentRuntimeBoundary: false,
      canClaimDocumentAccepted: false,
      requiresExternalConfirmation: boundary?.requiresExternalConfirmation === true,
      reason: 'Document boundary requires deal id.',
    };
  }

  if (!hasText(input.documentId)) {
    return {
      status: 'blocked_missing_document_id',
      canReachDocumentRuntimeBoundary: false,
      canClaimDocumentAccepted: false,
      requiresExternalConfirmation: boundary?.requiresExternalConfirmation === true,
      reason: 'Document boundary requires document id.',
    };
  }

  if (!input.idempotencyBoundary.canProceed) {
    return {
      status: 'blocked_idempotency_boundary',
      canReachDocumentRuntimeBoundary: false,
      canClaimDocumentAccepted: false,
      requiresExternalConfirmation: boundary?.requiresExternalConfirmation === true,
      reason: 'Document boundary cannot proceed until idempotency boundary is ready.',
    };
  }

  if (!input.auditBoundary.canProceed) {
    return {
      status: 'blocked_audit_boundary',
      canReachDocumentRuntimeBoundary: false,
      canClaimDocumentAccepted: false,
      requiresExternalConfirmation: boundary?.requiresExternalConfirmation === true,
      reason: 'Document boundary cannot proceed until append-only audit boundary is ready.',
    };
  }

  if (boundary?.requiresExternalConfirmation === true && input.externalConfirmationReady !== true) {
    return {
      status: 'blocked_external_confirmation_required',
      canReachDocumentRuntimeBoundary: false,
      canClaimDocumentAccepted: false,
      requiresExternalConfirmation: true,
      reason: 'Document acceptance requires external or manual confirmation before it may affect money.',
    };
  }

  return {
    status: 'ready_for_document_runtime_boundary',
    canReachDocumentRuntimeBoundary: true,
    canClaimDocumentAccepted: false,
    requiresExternalConfirmation: boundary?.requiresExternalConfirmation === true,
    reason: 'Document gate is ready for runtime boundary, but no document acceptance is executed in this layer.',
  };
}

export function getPlatformV7ServerDocumentGateSummary(result: PlatformV7ServerDocumentGateResult) {
  return {
    status: result.status,
    canReachDocumentRuntimeBoundary: result.canReachDocumentRuntimeBoundary,
    canClaimDocumentAccepted: result.canClaimDocumentAccepted,
    requiresExternalConfirmation: result.requiresExternalConfirmation,
  };
}
