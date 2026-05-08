import { describe, expect, it } from 'vitest';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import { checkPlatformV7ServerIdempotencyBoundary } from '@/lib/platform-v7/server-idempotency-boundary';
import type { PlatformV7ApiBoundaryId } from '@/lib/platform-v7/api-boundary-contracts';
import type { PlatformV7ServerActionContractResponse } from '@/lib/platform-v7/server-action-contract-wrapper';

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

describe('platform-v7 server idempotency boundary', () => {
  it('does not require idempotency for read boundaries', () => {
    const result = checkPlatformV7ServerIdempotencyBoundary(response('list_batches'));

    expect(result).toMatchObject({
      status: 'not_required_read_boundary',
      canProceed: true,
      requiresIdempotencyRecord: false,
      keyValid: true,
      moneyKey: false,
    });
  });

  it('blocks sensitive write boundaries without idempotency key', () => {
    const result = checkPlatformV7ServerIdempotencyBoundary(response('request_money_reserve'));

    expect(result).toMatchObject({
      status: 'blocked_missing_idempotency_key',
      canProceed: false,
      requiresIdempotencyRecord: true,
      keyValid: false,
      moneyKey: false,
    });
  });

  it('blocks invalid idempotency keys before write boundary', () => {
    const result = checkPlatformV7ServerIdempotencyBoundary(response('assign_driver'), 'bad-key');

    expect(result).toMatchObject({
      status: 'blocked_invalid_idempotency_key',
      canProceed: false,
      requiresIdempotencyRecord: true,
      keyValid: false,
    });
  });

  it('blocks money boundaries when amount or currency is missing from idempotency key', () => {
    const key = buildPlatformV7IdempotencyKey({
      boundaryId: 'request_money_reserve',
      actorId: 'buyer-1',
      entityId: 'money-1',
      dealId: 'deal-1',
    });

    const result = checkPlatformV7ServerIdempotencyBoundary(response('request_money_reserve'), key);

    expect(result).toMatchObject({
      status: 'blocked_money_key_incomplete',
      canProceed: false,
      requiresIdempotencyRecord: true,
      keyValid: true,
      moneyKey: false,
    });
  });

  it('allows money boundaries to reach durable idempotency record check with full money key', () => {
    const key = buildPlatformV7IdempotencyKey({
      boundaryId: 'request_money_reserve',
      actorId: 'buyer-1',
      entityId: 'money-1',
      dealId: 'deal-1',
      amountMinor: 100_000,
      currency: 'RUB',
      attemptId: 'attempt-1',
    });

    const result = checkPlatformV7ServerIdempotencyBoundary(response('request_money_reserve'), key);

    expect(result).toMatchObject({
      status: 'ready_for_idempotency_record',
      canProceed: true,
      requiresIdempotencyRecord: true,
      keyValid: true,
      moneyKey: true,
    });
  });
});
