import { checkPlatformV7ExecutionGate, type PlatformV7ExecutionGateResult } from './execution-gate-helper';
import { buildPlatformV7ExecutionResult, type PlatformV7ExecutionResult } from './execution-result-helper';
import {
  buildPlatformV7ExecutionObservabilitySignals,
  type PlatformV7ExecutionObservabilitySignal,
} from './execution-observability-helper';
import { getPlatformV7RepositoryReadinessSummary, type PlatformV7PersistenceRepository } from './persistence-repository';
import type { PlatformV7ExecutionEnvelopeInput } from './execution-envelope-helper';

export type PlatformV7ServiceBoundaryRunResult = {
  readonly gate: PlatformV7ExecutionGateResult;
  readonly result: PlatformV7ExecutionResult;
  readonly observabilitySignals: readonly PlatformV7ExecutionObservabilitySignal[];
  readonly repository: ReturnType<typeof getPlatformV7RepositoryReadinessSummary>;
  readonly attemptedRuntimeWrite: false;
  readonly persisted: false;
};

export function runPlatformV7ServiceBoundary(
  input: PlatformV7ExecutionEnvelopeInput,
  repository: PlatformV7PersistenceRepository,
): PlatformV7ServiceBoundaryRunResult {
  const gate = checkPlatformV7ExecutionGate(input);
  const result = buildPlatformV7ExecutionResult(gate);
  const observabilitySignals = buildPlatformV7ExecutionObservabilitySignals(result);

  return {
    gate,
    result,
    observabilitySignals,
    repository: getPlatformV7RepositoryReadinessSummary(repository),
    attemptedRuntimeWrite: false,
    persisted: false,
  };
}

export function canPlatformV7ServiceBoundaryPersist(run: PlatformV7ServiceBoundaryRunResult): boolean {
  return run.repository.durable === true && run.result.canAffectRuntime === true && run.result.canClaimExecuted === false;
}

export function getPlatformV7ServiceBoundarySummary(run: PlatformV7ServiceBoundaryRunResult) {
  return {
    boundaryId: run.result.boundaryId,
    status: run.result.status,
    attemptedRuntimeWrite: run.attemptedRuntimeWrite,
    persisted: run.persisted,
    repositoryDurable: run.repository.durable,
    signalCount: run.observabilitySignals.length,
    canPersist: canPlatformV7ServiceBoundaryPersist(run),
  };
}
