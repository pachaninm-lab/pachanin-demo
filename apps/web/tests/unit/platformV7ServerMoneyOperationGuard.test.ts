import { describe, expect, it } from 'vitest';
import { checkPlatformV7ServerMoneyOperationGuard } from '@/lib/platform-v7/server-money-operation-guard';
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
  moneyKey: true,
  reason: 'ready',
};

const idempotencyBlocked: PlatformV7ServerIdempotencyBoundaryResult = {
  ...idempotencyReady,
  status: 'blocked_missing_idempotency_key',
  canProceed: false,
  keyValid: false,
  moneyKey: false,
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

const auditBlocked: PlatformV7ServerAuditBoundaryResult = {
  ...auditReady,
  status: 'blocked_missing_audit_event',
  canProceed: false,
  auditEventValid: false,
  appendOnly: false,
  moneyAuditComplete: false,
};

describe('platform-v7 server money operation guard', () => {
  it('does not block non-money boundaries', () => {
    const result = checkPlatformV7ServerMoneyOperationGuard({
      response: response('create_batch'),
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result).toMatchObject({
      status: 'not_money_boundary',
      canReachMoneyRuntimeBoundary: true,
      canClaimMoneyMoved: false,
      amountValid: true,
    });
  });

  it('blocks money boundaries without deal id', () => {
    const result = checkPlatformV7ServerMoneyOperationGuard({
      response: response('request_money_reserve'),
      amountMinor: 100_000,
      currency: 'RUB',
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result.status).toBe('blocked_missing_deal_id');
    expect(result.canReachMoneyRuntimeBoundary).toBe(false);
  });

  it('blocks money boundaries without amount or currency', () => {
    const result = checkPlatformV7ServerMoneyOperationGuard({
      response: response('request_money_reserve'),
      dealId: 'deal-1',
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result.status).toBe('blocked_missing_amount_or_currency');
    expect(result.amountValid).toBe(false);
  });

  it('blocks money boundaries with invalid amount', () => {
    const result = checkPlatformV7ServerMoneyOperationGuard({
      response: response('request_money_reserve'),
      dealId: 'deal-1',
      amountMinor: 0,
      currency: 'RUB',
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result.status).toBe('blocked_invalid_amount');
    expect(result.amountValid).toBe(false);
  });

  it('blocks money boundaries when idempotency boundary is not ready', () => {
    const result = checkPlatformV7ServerMoneyOperationGuard({
      response: response('request_money_reserve'),
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      idempotencyBoundary: idempotencyBlocked,
      auditBoundary: auditReady,
    });

    expect(result.status).toBe('blocked_idempotency_boundary');
    expect(result.canReachMoneyRuntimeBoundary).toBe(false);
  });

  it('blocks money boundaries when audit boundary is not ready', () => {
    const result = checkPlatformV7ServerMoneyOperationGuard({
      response: response('request_money_reserve'),
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditBlocked,
    });

    expect(result.status).toBe('blocked_audit_boundary');
    expect(result.canReachMoneyRuntimeBoundary).toBe(false);
  });

  it('allows complete money boundary to reach runtime boundary without claiming money movement', () => {
    const result = checkPlatformV7ServerMoneyOperationGuard({
      response: response('request_money_reserve'),
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      idempotencyBoundary: idempotencyReady,
      auditBoundary: auditReady,
    });

    expect(result).toMatchObject({
      status: 'ready_for_money_runtime_boundary',
      canReachMoneyRuntimeBoundary: true,
      canClaimMoneyMoved: false,
      requiresBankOrExternalConfirmation: false,
      amountValid: true,
    });
  });
});
