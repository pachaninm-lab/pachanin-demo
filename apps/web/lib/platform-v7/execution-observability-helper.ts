import type { PlatformV7ExecutionResult } from './execution-result-helper';

export type PlatformV7ExecutionObservabilitySignalKind =
  | 'execution_blocked'
  | 'execution_contract_only'
  | 'execution_accepted_for_runtime'
  | 'execution_payload_issue'
  | 'execution_boundary_issue'
  | 'execution_money_boundary';

export type PlatformV7ExecutionObservabilitySeverity = 'info' | 'warning' | 'critical';

export type PlatformV7ExecutionObservabilitySignal = {
  readonly kind: PlatformV7ExecutionObservabilitySignalKind;
  readonly boundaryId: string;
  readonly severity: PlatformV7ExecutionObservabilitySeverity;
  readonly message: string;
  readonly requiresRuntimeAlert: boolean;
  readonly requiresOperatorReview: boolean;
};

const isMoneyBoundary = (boundaryId: string): boolean =>
  boundaryId.includes('money') || boundaryId.includes('dispute') || boundaryId.includes('document') || boundaryId.includes('trip');

export function buildPlatformV7ExecutionObservabilitySignals(
  result: PlatformV7ExecutionResult,
): readonly PlatformV7ExecutionObservabilitySignal[] {
  const signals: PlatformV7ExecutionObservabilitySignal[] = [];

  if (result.status === 'blocked') {
    signals.push({
      kind: 'execution_blocked',
      boundaryId: result.boundaryId,
      severity: 'warning',
      message: result.safeMessage,
      requiresRuntimeAlert: false,
      requiresOperatorReview: true,
    });
  }

  if (result.status === 'contract_only') {
    signals.push({
      kind: 'execution_contract_only',
      boundaryId: result.boundaryId,
      severity: 'info',
      message: result.safeMessage,
      requiresRuntimeAlert: false,
      requiresOperatorReview: false,
    });
  }

  if (result.status === 'accepted_for_runtime') {
    signals.push({
      kind: 'execution_accepted_for_runtime',
      boundaryId: result.boundaryId,
      severity: 'info',
      message: result.safeMessage,
      requiresRuntimeAlert: false,
      requiresOperatorReview: false,
    });
  }

  for (const issue of result.issues) {
    signals.push({
      kind: 'execution_boundary_issue',
      boundaryId: result.boundaryId,
      severity: result.status === 'blocked' ? 'warning' : 'info',
      message: issue,
      requiresRuntimeAlert: false,
      requiresOperatorReview: result.status === 'blocked',
    });
  }

  for (const issue of result.payloadIssues) {
    signals.push({
      kind: 'execution_payload_issue',
      boundaryId: result.boundaryId,
      severity: 'warning',
      message: issue,
      requiresRuntimeAlert: false,
      requiresOperatorReview: true,
    });
  }

  if (isMoneyBoundary(result.boundaryId) && result.status === 'blocked') {
    signals.push({
      kind: 'execution_money_boundary',
      boundaryId: result.boundaryId,
      severity: 'critical',
      message: `Money-sensitive boundary ${result.boundaryId} is blocked before runtime.`,
      requiresRuntimeAlert: true,
      requiresOperatorReview: true,
    });
  }

  return signals;
}

export function hasPlatformV7CriticalExecutionSignal(signals: readonly PlatformV7ExecutionObservabilitySignal[]): boolean {
  return signals.some((signal) => signal.severity === 'critical');
}

export function getPlatformV7ExecutionObservabilitySummary(signals: readonly PlatformV7ExecutionObservabilitySignal[]) {
  return {
    total: signals.length,
    critical: signals.filter((signal) => signal.severity === 'critical').length,
    warnings: signals.filter((signal) => signal.severity === 'warning').length,
    runtimeAlerts: signals.filter((signal) => signal.requiresRuntimeAlert).length,
    operatorReview: signals.filter((signal) => signal.requiresOperatorReview).length,
    mode: 'contract_only_requires_observability_runtime' as const,
  };
}
