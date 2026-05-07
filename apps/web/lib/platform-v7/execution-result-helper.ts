import type { PlatformV7ApiBoundaryId } from './api-boundary-contracts';
import type { PlatformV7ExecutionGateResult } from './execution-gate-helper';

export type PlatformV7ExecutionResultStatus = 'accepted_for_runtime' | 'blocked' | 'contract_only';

export type PlatformV7ExecutionResult = {
  readonly boundaryId: PlatformV7ApiBoundaryId;
  readonly status: PlatformV7ExecutionResultStatus;
  readonly safeMessage: string;
  readonly nextAction: string;
  readonly canAffectRuntime: boolean;
  readonly canClaimExecuted: false;
  readonly issues: readonly string[];
  readonly payloadIssues: readonly string[];
};

const unique = (values: readonly string[]) => Array.from(new Set(values.filter(Boolean)));

export function buildPlatformV7ExecutionResult(gateResult: PlatformV7ExecutionGateResult): PlatformV7ExecutionResult {
  const blockingIssues = gateResult.issues.filter((issue) => issue.code !== 'contract_only_boundary');
  const issueMessages = unique(blockingIssues.map((issue) => issue.message));
  const payloadIssues = unique(gateResult.payloadIssues);

  if (blockingIssues.length > 0 || payloadIssues.length > 0) {
    return {
      boundaryId: gateResult.boundaryId,
      status: 'blocked',
      safeMessage: 'Действие не принято: есть ошибки проверки условий, роли или данных.',
      nextAction: 'Исправить ошибки проверки и повторить действие после повторной пред-проверки.',
      canAffectRuntime: false,
      canClaimExecuted: false,
      issues: issueMessages,
      payloadIssues,
    };
  }

  if (gateResult.issues.some((issue) => issue.code === 'contract_only_boundary')) {
    return {
      boundaryId: gateResult.boundaryId,
      status: 'contract_only',
      safeMessage: 'Действие прошло контрактную проверку, но реальное исполнение требует server runtime.',
      nextAction: 'Подключить server route, persistence, auth/RBAC и append-only audit runtime перед боевым исполнением.',
      canAffectRuntime: false,
      canClaimExecuted: false,
      issues: unique(gateResult.issues.map((issue) => issue.message)),
      payloadIssues: [],
    };
  }

  return {
    boundaryId: gateResult.boundaryId,
    status: 'accepted_for_runtime',
    safeMessage: 'Действие принято только для runtime-обработки; факт исполнения должен подтвердить server runtime.',
    nextAction: 'Передать envelope в server runtime и записать append-only audit event после фактического результата.',
    canAffectRuntime: true,
    canClaimExecuted: false,
    issues: [],
    payloadIssues: [],
  };
}

export function isPlatformV7ExecutionBlocked(result: PlatformV7ExecutionResult): boolean {
  return result.status === 'blocked';
}

export function canPlatformV7ExecutionResultClaimExecuted(result: PlatformV7ExecutionResult): boolean {
  return result.canClaimExecuted === true;
}

export function getPlatformV7ExecutionResultSummary(result: PlatformV7ExecutionResult) {
  return {
    boundaryId: result.boundaryId,
    status: result.status,
    canAffectRuntime: result.canAffectRuntime,
    canClaimExecuted: result.canClaimExecuted,
    issueCount: result.issues.length + result.payloadIssues.length,
  };
}
