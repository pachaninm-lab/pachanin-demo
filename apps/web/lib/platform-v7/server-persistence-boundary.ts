import type { PlatformV7PersistenceRepository } from './persistence-repository';
import { getPlatformV7RepositoryReadinessSummary } from './persistence-repository';
import type { PlatformV7ServerActionContractResponse } from './server-action-contract-wrapper';

export type PlatformV7ServerPersistenceBoundaryStatus =
  | 'blocked_memory_adapter'
  | 'blocked_contract_response'
  | 'ready_for_durable_write';

export type PlatformV7ServerPersistenceBoundaryResult = {
  readonly status: PlatformV7ServerPersistenceBoundaryStatus;
  readonly canAttemptRuntimeWrite: boolean;
  readonly canPersist: boolean;
  readonly persisted: false;
  readonly attemptedRuntimeWrite: false;
  readonly repositoryDurable: boolean;
  readonly reason: string;
};

export function checkPlatformV7ServerPersistenceBoundary(
  response: PlatformV7ServerActionContractResponse,
  repository: PlatformV7PersistenceRepository,
): PlatformV7ServerPersistenceBoundaryResult {
  const repositorySummary = getPlatformV7RepositoryReadinessSummary(repository);

  if (!repositorySummary.durable) {
    return {
      status: 'blocked_memory_adapter',
      canAttemptRuntimeWrite: false,
      canPersist: false,
      persisted: false,
      attemptedRuntimeWrite: false,
      repositoryDurable: false,
      reason: 'Durable repository adapter is required before server runtime writes.',
    };
  }

  if (response.status !== 'runtime_candidate') {
    return {
      status: 'blocked_contract_response',
      canAttemptRuntimeWrite: false,
      canPersist: false,
      persisted: false,
      attemptedRuntimeWrite: false,
      repositoryDurable: true,
      reason: 'Only runtime_candidate responses may reach durable write boundary.',
    };
  }

  return {
    status: 'ready_for_durable_write',
    canAttemptRuntimeWrite: true,
    canPersist: true,
    persisted: false,
    attemptedRuntimeWrite: false,
    repositoryDurable: true,
    reason: 'Durable write boundary is ready, but write execution is not implemented in this layer.',
  };
}

export function getPlatformV7ServerPersistenceBoundarySummary(result: PlatformV7ServerPersistenceBoundaryResult) {
  return {
    status: result.status,
    canAttemptRuntimeWrite: result.canAttemptRuntimeWrite,
    canPersist: result.canPersist,
    persisted: result.persisted,
    attemptedRuntimeWrite: result.attemptedRuntimeWrite,
    repositoryDurable: result.repositoryDurable,
  };
}
