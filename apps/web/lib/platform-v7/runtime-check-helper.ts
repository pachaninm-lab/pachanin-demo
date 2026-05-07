export type PlatformV7RuntimeCheckId =
  | 'server_routes'
  | 'auth'
  | 'rbac'
  | 'entity_acl'
  | 'payload_validation'
  | 'persistence'
  | 'append_only_audit'
  | 'idempotency_store'
  | 'transaction_state_store'
  | 'trip_runtime'
  | 'money_reconciliation'
  | 'observability'
  | 'feature_flags'
  | 'kill_switches'
  | 'external_confirmation_boundary';

export type PlatformV7RuntimeCheckStatus = 'ready' | 'missing' | 'manual_review';

export type PlatformV7RuntimeCheck = {
  readonly id: PlatformV7RuntimeCheckId;
  readonly label: string;
  readonly status: PlatformV7RuntimeCheckStatus;
  readonly critical: boolean;
  readonly moneyCritical: boolean;
  readonly summary: string;
};

export type PlatformV7RuntimeReadinessStatus =
  | 'contract_only'
  | 'runtime_blocked'
  | 'controlled_runtime_ready';

export type PlatformV7RuntimeReadinessResult = {
  readonly status: PlatformV7RuntimeReadinessStatus;
  readonly canRunServerActions: boolean;
  readonly canAffectMoney: boolean;
  readonly canClaimRealExecution: boolean;
  readonly missingCritical: readonly PlatformV7RuntimeCheckId[];
  readonly missingMoneyCritical: readonly PlatformV7RuntimeCheckId[];
  readonly manualReview: readonly PlatformV7RuntimeCheckId[];
  readonly summary: string;
};

export const PLATFORM_V7_RUNTIME_CHECKS: readonly PlatformV7RuntimeCheck[] = [
  {
    id: 'server_routes',
    label: 'Server routes',
    status: 'missing',
    critical: true,
    moneyCritical: true,
    summary: 'API routes must exist before any boundary can move from contract to runtime.',
  },
  {
    id: 'auth',
    label: 'Authentication',
    status: 'missing',
    critical: true,
    moneyCritical: true,
    summary: 'Every server action must know the actor identity.',
  },
  {
    id: 'rbac',
    label: 'Role access control',
    status: 'missing',
    critical: true,
    moneyCritical: true,
    summary: 'Server runtime must enforce role boundaries, not only UI visibility.',
  },
  {
    id: 'entity_acl',
    label: 'Entity access control',
    status: 'missing',
    critical: true,
    moneyCritical: true,
    summary: 'Actor access must be checked against the deal, trip, document, dispute or money record.',
  },
  {
    id: 'payload_validation',
    label: 'Payload validation',
    status: 'ready',
    critical: true,
    moneyCritical: true,
    summary: 'Contract-level payload validation exists, but server wiring is still required.',
  },
  {
    id: 'persistence',
    label: 'Persistence',
    status: 'missing',
    critical: true,
    moneyCritical: true,
    summary: 'Runtime needs durable storage before any state change can be trusted.',
  },
  {
    id: 'append_only_audit',
    label: 'Append-only audit',
    status: 'missing',
    critical: true,
    moneyCritical: true,
    summary: 'Audit events must be persisted append-only, not only built in memory.',
  },
  {
    id: 'idempotency_store',
    label: 'Idempotency store',
    status: 'missing',
    critical: true,
    moneyCritical: true,
    summary: 'Runtime must store idempotency keys to block duplicate actions.',
  },
  {
    id: 'transaction_state_store',
    label: 'Transaction state store',
    status: 'missing',
    critical: true,
    moneyCritical: true,
    summary: 'Deals, money, documents, trips and disputes need a durable state store.',
  },
  {
    id: 'trip_runtime',
    label: 'Trip runtime',
    status: 'missing',
    critical: true,
    moneyCritical: true,
    summary: 'Driver checkpoints and trip audit must be backed by server runtime, durable trip state and append-only audit before they can affect execution.',
  },
  {
    id: 'money_reconciliation',
    label: 'Money reconciliation',
    status: 'missing',
    critical: false,
    moneyCritical: true,
    summary: 'Money boundaries need reconciliation before they can affect real money state.',
  },
  {
    id: 'observability',
    label: 'Observability',
    status: 'manual_review',
    critical: false,
    moneyCritical: true,
    summary: 'Signal contracts exist, but runtime alerts and dashboards are not wired.',
  },
  {
    id: 'feature_flags',
    label: 'Feature flags',
    status: 'missing',
    critical: false,
    moneyCritical: true,
    summary: 'Money and external boundaries need runtime feature flags.',
  },
  {
    id: 'kill_switches',
    label: 'Kill switches',
    status: 'missing',
    critical: false,
    moneyCritical: true,
    summary: 'Runtime must be able to stop money, document and connector actions safely.',
  },
  {
    id: 'external_confirmation_boundary',
    label: 'External confirmation boundary',
    status: 'missing',
    critical: false,
    moneyCritical: true,
    summary: 'Bank, document and connector confirmations must come from external-confirmation boundaries.',
  },
];

export function assessPlatformV7RuntimeReadiness(
  checks: readonly PlatformV7RuntimeCheck[] = PLATFORM_V7_RUNTIME_CHECKS,
): PlatformV7RuntimeReadinessResult {
  const missingCritical = checks.filter((check) => check.critical && check.status !== 'ready').map((check) => check.id);
  const missingMoneyCritical = checks
    .filter((check) => check.moneyCritical && check.status !== 'ready')
    .map((check) => check.id);
  const manualReview = checks.filter((check) => check.status === 'manual_review').map((check) => check.id);

  if (missingCritical.length > 0) {
    return {
      status: 'contract_only',
      canRunServerActions: false,
      canAffectMoney: false,
      canClaimRealExecution: false,
      missingCritical,
      missingMoneyCritical,
      manualReview,
      summary: 'Platform-v7 remains contract-only until critical runtime checks are ready.',
    };
  }

  if (missingMoneyCritical.length > 0) {
    return {
      status: 'runtime_blocked',
      canRunServerActions: true,
      canAffectMoney: false,
      canClaimRealExecution: false,
      missingCritical,
      missingMoneyCritical,
      manualReview,
      summary: 'Server runtime can be considered for non-money actions only; money boundaries remain blocked.',
    };
  }

  return {
    status: 'controlled_runtime_ready',
    canRunServerActions: true,
    canAffectMoney: true,
    canClaimRealExecution: false,
    missingCritical,
    missingMoneyCritical,
    manualReview,
    summary: 'Runtime prerequisites are ready for controlled runtime wiring; external confirmations still decide real-world effects.',
  };
}

export function markPlatformV7RuntimeChecksReady(
  ids: readonly PlatformV7RuntimeCheckId[],
  checks: readonly PlatformV7RuntimeCheck[] = PLATFORM_V7_RUNTIME_CHECKS,
): readonly PlatformV7RuntimeCheck[] {
  const readyIds = new Set(ids);

  return checks.map((check) => (readyIds.has(check.id) ? { ...check, status: 'ready' as const } : check));
}

export function getPlatformV7RuntimeReadinessSummary(result: PlatformV7RuntimeReadinessResult) {
  return {
    status: result.status,
    canRunServerActions: result.canRunServerActions,
    canAffectMoney: result.canAffectMoney,
    canClaimRealExecution: result.canClaimRealExecution,
    missingCriticalCount: result.missingCritical.length,
    missingMoneyCriticalCount: result.missingMoneyCritical.length,
    manualReviewCount: result.manualReview.length,
  };
}
