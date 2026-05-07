import { assessPlatformV7RuntimeReadiness, getPlatformV7RuntimeReadinessSummary } from './runtime-check-helper';
import { getPlatformV7ApiBoundaryReadinessSummary } from './api-boundary-contracts';
import { getPlatformV7ApiPayloadReadinessSummary } from './api-payload-contracts';

export type PlatformV7ControlledPilotBoundaryReport = {
  readonly status: 'controlled_pilot_contract_layer';
  readonly canClaimProductionReady: false;
  readonly canClaimLiveIntegrations: false;
  readonly canClaimRealMoneyMovement: false;
  readonly canClaimServerRuntime: boolean;
  readonly canClaimRealExecution: false;
  readonly apiBoundaries: ReturnType<typeof getPlatformV7ApiBoundaryReadinessSummary>;
  readonly payloadBoundaries: ReturnType<typeof getPlatformV7ApiPayloadReadinessSummary>;
  readonly runtimeReadiness: ReturnType<typeof getPlatformV7RuntimeReadinessSummary>;
  readonly allowedClaim: string;
  readonly forbiddenClaims: readonly string[];
  readonly nextRuntimePrerequisites: readonly string[];
};

export function buildPlatformV7ControlledPilotBoundaryReport(): PlatformV7ControlledPilotBoundaryReport {
  const runtime = assessPlatformV7RuntimeReadiness();

  return {
    status: 'controlled_pilot_contract_layer',
    canClaimProductionReady: false,
    canClaimLiveIntegrations: false,
    canClaimRealMoneyMovement: false,
    canClaimServerRuntime: runtime.canRunServerActions,
    canClaimRealExecution: false,
    apiBoundaries: getPlatformV7ApiBoundaryReadinessSummary(),
    payloadBoundaries: getPlatformV7ApiPayloadReadinessSummary(),
    runtimeReadiness: getPlatformV7RuntimeReadinessSummary(runtime),
    allowedClaim:
      'Platform-v7 has a controlled-pilot contract layer for execution boundaries, payload validation, idempotency, audit, preflight checks, observability signals and runtime readiness checks.',
    forbiddenClaims: [
      'production-ready',
      'fully live',
      'fully integrated',
      'real money movement confirmed',
      'server runtime implemented',
      'database persistence implemented',
      'live bank integration active',
      'external confirmations active',
    ],
    nextRuntimePrerequisites: [
      'server routes',
      'auth',
      'RBAC',
      'entity ACL',
      'durable persistence',
      'append-only audit runtime',
      'idempotency store',
      'transaction state store',
      'money reconciliation runtime',
      'feature flags',
      'kill switches',
      'external confirmation boundaries',
    ],
  };
}

export function canPlatformV7BoundaryReportClaimProductionReady(report = buildPlatformV7ControlledPilotBoundaryReport()): boolean {
  return report.canClaimProductionReady === true;
}

export function getPlatformV7BoundaryReportCompactSummary(report = buildPlatformV7ControlledPilotBoundaryReport()) {
  return {
    status: report.status,
    canClaimProductionReady: report.canClaimProductionReady,
    canClaimServerRuntime: report.canClaimServerRuntime,
    canClaimRealExecution: report.canClaimRealExecution,
    runtimeStatus: report.runtimeReadiness.status,
    missingCriticalCount: report.runtimeReadiness.missingCriticalCount,
    missingMoneyCriticalCount: report.runtimeReadiness.missingMoneyCriticalCount,
  };
}
