import { getPlatformV7ApiBoundary } from './api-boundary-contracts';
import { isPlatformV7DirectMoneyBoundary } from './direct-money-boundaries';
import { getPlatformV7IdempotencyKeySummary, validatePlatformV7IdempotencyKey } from './idempotency-key-helper';
import type { PlatformV7ServerActionContractResponse } from './server-action-contract-wrapper';

export type PlatformV7ServerIdempotencyBoundaryStatus =
  | 'not_required_read_boundary'
  | 'blocked_missing_idempotency_key'
  | 'blocked_invalid_idempotency_key'
  | 'blocked_money_key_incomplete'
  | 'ready_for_idempotency_record';

export type PlatformV7ServerIdempotencyBoundaryResult = {
  readonly status: PlatformV7ServerIdempotencyBoundaryStatus;
  readonly canProceed: boolean;
  readonly requiresIdempotencyRecord: boolean;
  readonly keyValid: boolean;
  readonly moneyKey: boolean;
  readonly reason: string;
};

export function checkPlatformV7ServerIdempotencyBoundary(
  response: PlatformV7ServerActionContractResponse,
  idempotencyKey?: string,
): PlatformV7ServerIdempotencyBoundaryResult {
  const boundary = getPlatformV7ApiBoundary(response.boundaryId);

  if (boundary?.requiresIdempotencyKey !== true) {
    return {
      status: 'not_required_read_boundary',
      canProceed: true,
      requiresIdempotencyRecord: false,
      keyValid: true,
      moneyKey: false,
      reason: 'Boundary does not require idempotency record.',
    };
  }

  if (!idempotencyKey?.trim()) {
    return {
      status: 'blocked_missing_idempotency_key',
      canProceed: false,
      requiresIdempotencyRecord: true,
      keyValid: false,
      moneyKey: false,
      reason: 'Idempotency key is required before sensitive server action can proceed.',
    };
  }

  const validation = validatePlatformV7IdempotencyKey(idempotencyKey);
  const summary = getPlatformV7IdempotencyKeySummary(idempotencyKey);

  if (!validation.ok) {
    return {
      status: 'blocked_invalid_idempotency_key',
      canProceed: false,
      requiresIdempotencyRecord: true,
      keyValid: false,
      moneyKey: summary.moneyKey,
      reason: validation.issues.join(' '),
    };
  }

  if (isPlatformV7DirectMoneyBoundary(response.boundaryId) && !summary.moneyKey) {
    return {
      status: 'blocked_money_key_incomplete',
      canProceed: false,
      requiresIdempotencyRecord: true,
      keyValid: true,
      moneyKey: false,
      reason: 'Direct money boundary requires amount and currency in idempotency key.',
    };
  }

  return {
    status: 'ready_for_idempotency_record',
    canProceed: true,
    requiresIdempotencyRecord: true,
    keyValid: true,
    moneyKey: summary.moneyKey,
    reason: 'Idempotency boundary is ready for durable idempotency record check.',
  };
}

export function getPlatformV7ServerIdempotencyBoundarySummary(result: PlatformV7ServerIdempotencyBoundaryResult) {
  return {
    status: result.status,
    canProceed: result.canProceed,
    requiresIdempotencyRecord: result.requiresIdempotencyRecord,
    keyValid: result.keyValid,
    moneyKey: result.moneyKey,
  };
}
