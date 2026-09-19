import { getPlatformV7ApiBoundary } from './api-boundary-contracts';
import { isPlatformV7DirectMoneyBoundary } from './direct-money-boundaries';
import type { PlatformV7ServerActionContractResponse } from './server-action-contract-wrapper';
import type { PlatformV7ServerAuditBoundaryResult } from './server-audit-boundary';
import type { PlatformV7ServerIdempotencyBoundaryResult } from './server-idempotency-boundary';

export type PlatformV7ServerMoneyOperationGuardStatus =
  | 'not_money_boundary'
  | 'blocked_missing_deal_id'
  | 'blocked_missing_amount_or_currency'
  | 'blocked_invalid_amount'
  | 'blocked_idempotency_boundary'
  | 'blocked_audit_boundary'
  | 'blocked_external_confirmation_required'
  | 'ready_for_money_runtime_boundary';

export type PlatformV7ServerMoneyOperationGuardInput = {
  readonly response: PlatformV7ServerActionContractResponse;
  readonly dealId?: string;
  readonly amountMinor?: number;
  readonly currency?: string;
  readonly externalConfirmationReady?: boolean;
  readonly idempotencyBoundary: PlatformV7ServerIdempotencyBoundaryResult;
  readonly auditBoundary: PlatformV7ServerAuditBoundaryResult;
};

export type PlatformV7ServerMoneyOperationGuardResult = {
  readonly status: PlatformV7ServerMoneyOperationGuardStatus;
  readonly canReachMoneyRuntimeBoundary: boolean;
  readonly canClaimMoneyMoved: false;
  readonly requiresBankOrExternalConfirmation: boolean;
  readonly amountValid: boolean;
  readonly reason: string;
};

const hasText = (value: string | undefined): boolean => typeof value === 'string' && value.trim().length > 0;

export function checkPlatformV7ServerMoneyOperationGuard(
  input: PlatformV7ServerMoneyOperationGuardInput,
): PlatformV7ServerMoneyOperationGuardResult {
  const boundary = getPlatformV7ApiBoundary(input.response.boundaryId);

  if (boundary?.affectsMoney !== true || !isPlatformV7DirectMoneyBoundary(input.response.boundaryId)) {
    return {
      status: 'not_money_boundary',
      canReachMoneyRuntimeBoundary: true,
      canClaimMoneyMoved: false,
      requiresBankOrExternalConfirmation: false,
      amountValid: true,
      reason: 'Boundary may affect money decisions elsewhere, but it is not a direct money operation.',
    };
  }

  if (!hasText(input.dealId)) {
    return {
      status: 'blocked_missing_deal_id',
      canReachMoneyRuntimeBoundary: false,
      canClaimMoneyMoved: false,
      requiresBankOrExternalConfirmation: boundary.requiresExternalConfirmation,
      amountValid: false,
      reason: 'Money-affecting boundary requires deal id.',
    };
  }

  if (input.amountMinor === undefined || !hasText(input.currency)) {
    return {
      status: 'blocked_missing_amount_or_currency',
      canReachMoneyRuntimeBoundary: false,
      canClaimMoneyMoved: false,
      requiresBankOrExternalConfirmation: boundary.requiresExternalConfirmation,
      amountValid: false,
      reason: 'Money-affecting boundary requires amount and currency.',
    };
  }

  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    return {
      status: 'blocked_invalid_amount',
      canReachMoneyRuntimeBoundary: false,
      canClaimMoneyMoved: false,
      requiresBankOrExternalConfirmation: boundary.requiresExternalConfirmation,
      amountValid: false,
      reason: 'Money amount must be a positive safe integer in minor units.',
    };
  }

  if (!input.idempotencyBoundary.canProceed) {
    return {
      status: 'blocked_idempotency_boundary',
      canReachMoneyRuntimeBoundary: false,
      canClaimMoneyMoved: false,
      requiresBankOrExternalConfirmation: boundary.requiresExternalConfirmation,
      amountValid: true,
      reason: 'Money operation cannot proceed until idempotency boundary is ready.',
    };
  }

  if (!input.auditBoundary.canProceed || !input.auditBoundary.moneyAuditComplete) {
    return {
      status: 'blocked_audit_boundary',
      canReachMoneyRuntimeBoundary: false,
      canClaimMoneyMoved: false,
      requiresBankOrExternalConfirmation: boundary.requiresExternalConfirmation,
      amountValid: true,
      reason: 'Money operation cannot proceed until critical append-only audit boundary is ready.',
    };
  }

  if (boundary.requiresExternalConfirmation === true && input.externalConfirmationReady !== true) {
    return {
      status: 'blocked_external_confirmation_required',
      canReachMoneyRuntimeBoundary: false,
      canClaimMoneyMoved: false,
      requiresBankOrExternalConfirmation: true,
      amountValid: true,
      reason: 'Money confirmation requires bank or external confirmation before it may reach runtime boundary.',
    };
  }

  return {
    status: 'ready_for_money_runtime_boundary',
    canReachMoneyRuntimeBoundary: true,
    canClaimMoneyMoved: false,
    requiresBankOrExternalConfirmation: boundary.requiresExternalConfirmation,
    amountValid: true,
    reason: 'Money guard is ready for runtime boundary, but no money movement is executed in this layer.',
  };
}

export function getPlatformV7ServerMoneyOperationGuardSummary(result: PlatformV7ServerMoneyOperationGuardResult) {
  return {
    status: result.status,
    canReachMoneyRuntimeBoundary: result.canReachMoneyRuntimeBoundary,
    canClaimMoneyMoved: result.canClaimMoneyMoved,
    requiresBankOrExternalConfirmation: result.requiresBankOrExternalConfirmation,
    amountValid: result.amountValid,
  };
}
