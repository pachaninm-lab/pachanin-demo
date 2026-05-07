import type { PlatformV7ApiBoundaryId } from './api-boundary-contracts';
import type { PlatformV7ExecutionEnvelopeInput } from './execution-envelope-helper';
import type { PlatformV7PersistenceRepository } from './persistence-repository';
import { runPlatformV7ServiceBoundary } from './service-boundary-runner';

export type PlatformV7ServerActionContractStatus = 'not_accepted' | 'contract_checked' | 'runtime_candidate';

export type PlatformV7ServerActionContractResponse = {
  readonly boundaryId: PlatformV7ApiBoundaryId;
  readonly status: PlatformV7ServerActionContractStatus;
  readonly httpStatus: 200 | 202 | 400 | 403 | 409;
  readonly message: string;
  readonly nextAction: string;
  readonly canClaimExecuted: false;
  readonly persisted: false;
  readonly attemptedRuntimeWrite: false;
  readonly issueCount: number;
  readonly signalCount: number;
  readonly repositoryDurable: boolean;
};

export function buildPlatformV7ServerActionContractResponse(
  input: PlatformV7ExecutionEnvelopeInput,
  repository: PlatformV7PersistenceRepository,
): PlatformV7ServerActionContractResponse {
  const run = runPlatformV7ServiceBoundary(input, repository);
  const issueCount = run.result.issues.length + run.result.payloadIssues.length;

  if (run.result.status === 'blocked') {
    const forbidden = run.gate.issues.some((issue) => issue.code === 'role_not_allowed');

    return {
      boundaryId: run.result.boundaryId,
      status: 'not_accepted',
      httpStatus: forbidden ? 403 : 400,
      message: run.result.safeMessage,
      nextAction: run.result.nextAction,
      canClaimExecuted: false,
      persisted: false,
      attemptedRuntimeWrite: false,
      issueCount,
      signalCount: run.observabilitySignals.length,
      repositoryDurable: run.repository.durable,
    };
  }

  if (run.result.status === 'contract_only') {
    return {
      boundaryId: run.result.boundaryId,
      status: 'contract_checked',
      httpStatus: 202,
      message: run.result.safeMessage,
      nextAction: run.result.nextAction,
      canClaimExecuted: false,
      persisted: false,
      attemptedRuntimeWrite: false,
      issueCount,
      signalCount: run.observabilitySignals.length,
      repositoryDurable: run.repository.durable,
    };
  }

  return {
    boundaryId: run.result.boundaryId,
    status: 'runtime_candidate',
    httpStatus: run.repository.durable ? 202 : 409,
    message: run.repository.durable
      ? run.result.safeMessage
      : 'Действие прошло проверку, но durable repository не подключён.',
    nextAction: run.repository.durable
      ? run.result.nextAction
      : 'Подключить durable repository adapter перед server runtime записью.',
    canClaimExecuted: false,
    persisted: false,
    attemptedRuntimeWrite: false,
    issueCount,
    signalCount: run.observabilitySignals.length,
    repositoryDurable: run.repository.durable,
  };
}

export function getPlatformV7ServerActionContractSummary(response: PlatformV7ServerActionContractResponse) {
  return {
    boundaryId: response.boundaryId,
    status: response.status,
    httpStatus: response.httpStatus,
    canClaimExecuted: response.canClaimExecuted,
    persisted: response.persisted,
    attemptedRuntimeWrite: response.attemptedRuntimeWrite,
    repositoryDurable: response.repositoryDurable,
    issueCount: response.issueCount,
    signalCount: response.signalCount,
  };
}
