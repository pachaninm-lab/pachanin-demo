import { describe, expect, it } from 'vitest';
import { createPlatformV7MemoryPersistenceRepository, type PlatformV7PersistenceRepository } from '@/lib/platform-v7/persistence-repository';
import { checkPlatformV7ServerPersistenceBoundary } from '@/lib/platform-v7/server-persistence-boundary';
import type { PlatformV7ServerActionContractResponse } from '@/lib/platform-v7/server-action-contract-wrapper';

const response = (status: PlatformV7ServerActionContractResponse['status']): PlatformV7ServerActionContractResponse => ({
  boundaryId: 'request_money_reserve',
  actionId: 'money.request_reserve',
  serviceName: 'money',
  status,
  httpStatus: status === 'not_accepted' ? 403 : 202,
  message: 'checked',
  nextAction: 'next',
  canClaimExecuted: false,
  persisted: false,
  attemptedRuntimeWrite: false,
  issueCount: status === 'contract_checked' ? 1 : 0,
  signalCount: 1,
  repositoryDurable: false,
});

const durableRepository: PlatformV7PersistenceRepository = {
  ...createPlatformV7MemoryPersistenceRepository(),
  mode: 'durable_adapter_required',
};

describe('platform-v7 server persistence boundary', () => {
  it('blocks server writes with memory repository adapter', () => {
    const result = checkPlatformV7ServerPersistenceBoundary(
      response('contract_checked'),
      createPlatformV7MemoryPersistenceRepository(),
    );

    expect(result).toMatchObject({
      status: 'blocked_memory_adapter',
      canAttemptRuntimeWrite: false,
      canPersist: false,
      persisted: false,
      attemptedRuntimeWrite: false,
      repositoryDurable: false,
    });
  });

  it('blocks durable repository when response is not runtime candidate', () => {
    const result = checkPlatformV7ServerPersistenceBoundary(response('contract_checked'), durableRepository);

    expect(result).toMatchObject({
      status: 'blocked_contract_response',
      canAttemptRuntimeWrite: false,
      canPersist: false,
      repositoryDurable: true,
    });
  });

  it('allows only runtime candidates to reach durable write boundary', () => {
    const result = checkPlatformV7ServerPersistenceBoundary(response('runtime_candidate'), durableRepository);

    expect(result).toMatchObject({
      status: 'ready_for_durable_write',
      canAttemptRuntimeWrite: true,
      canPersist: true,
      persisted: false,
      attemptedRuntimeWrite: false,
      repositoryDurable: true,
    });
  });
});
