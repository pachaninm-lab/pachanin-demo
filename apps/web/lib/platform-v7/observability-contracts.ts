export type PlatformV7ObservableSignal =
  | 'frontend_error'
  | 'route_render_failure'
  | 'action_feedback_failure'
  | 'integration_request'
  | 'integration_response'
  | 'integration_timeout'
  | 'money_mismatch'
  | 'manual_reconciliation_required'
  | 'sla_breach'
  | 'document_blocker'
  | 'dispute_opened'
  | 'bank_action_requested'
  | 'deployment_health'
  | 'feature_flag_changed'
  | 'kill_switch_triggered';

export type PlatformV7Severity = 'info' | 'warning' | 'critical';

export type PlatformV7ObservabilityEvent = {
  readonly signal: PlatformV7ObservableSignal;
  readonly severity: PlatformV7Severity;
  readonly entityType: string;
  readonly entityId: string;
  readonly message: string;
  readonly createdAt: string;
  readonly requiresOperatorAction: boolean;
};

export type PlatformV7FeatureFlag = {
  readonly key: string;
  readonly enabled: boolean;
  readonly mode: 'test' | 'controlled_pilot' | 'disabled';
  readonly owner: 'product' | 'operations' | 'bank' | 'compliance';
  readonly rollbackPlan: string;
};

export type PlatformV7KillSwitch = {
  readonly key: string;
  readonly scope: 'money' | 'external_integrations' | 'document_signing' | 'auction' | 'support' | 'all_platform_v7';
  readonly enabled: boolean;
  readonly reason: string;
  readonly owner: 'operator' | 'bank' | 'compliance' | 'engineering';
};

export const PLATFORM_V7_REQUIRED_OBSERVABILITY_SIGNALS: readonly PlatformV7ObservableSignal[] = [
  'frontend_error',
  'route_render_failure',
  'action_feedback_failure',
  'integration_request',
  'integration_response',
  'integration_timeout',
  'money_mismatch',
  'manual_reconciliation_required',
  'sla_breach',
  'document_blocker',
  'dispute_opened',
  'bank_action_requested',
  'deployment_health',
  'feature_flag_changed',
  'kill_switch_triggered',
];

export const PLATFORM_V7_CRITICAL_SIGNALS: readonly PlatformV7ObservableSignal[] = [
  'route_render_failure',
  'integration_timeout',
  'money_mismatch',
  'manual_reconciliation_required',
  'sla_breach',
  'bank_action_requested',
  'kill_switch_triggered',
];

export const PLATFORM_V7_REQUIRED_FEATURE_FLAGS: readonly PlatformV7FeatureFlag[] = [
  { key: 'platform_v7_money_actions', enabled: false, mode: 'controlled_pilot', owner: 'bank', rollbackPlan: 'disable money actions and keep read-only money view' },
  { key: 'platform_v7_external_connectors', enabled: false, mode: 'controlled_pilot', owner: 'compliance', rollbackPlan: 'disable outbound connector requests and keep manual status' },
  { key: 'platform_v7_auction_flow', enabled: true, mode: 'controlled_pilot', owner: 'product', rollbackPlan: 'fall back to manual proposal comparison' },
  { key: 'platform_v7_driver_field_shell', enabled: true, mode: 'controlled_pilot', owner: 'operations', rollbackPlan: 'fall back to dispatch call and offline event queue' },
  { key: 'platform_v7_support_operator_queue', enabled: true, mode: 'controlled_pilot', owner: 'operations', rollbackPlan: 'route cases to operator inbox without automated SLA escalation' },
];

export const PLATFORM_V7_REQUIRED_KILL_SWITCHES: readonly PlatformV7KillSwitch[] = [
  { key: 'disable_money_actions', scope: 'money', enabled: false, reason: 'bank or reconciliation risk', owner: 'bank' },
  { key: 'disable_external_integrations', scope: 'external_integrations', enabled: false, reason: 'external connector error or compliance stop', owner: 'compliance' },
  { key: 'disable_document_signing', scope: 'document_signing', enabled: false, reason: 'signature or authority check issue', owner: 'compliance' },
  { key: 'disable_auction_flow', scope: 'auction', enabled: false, reason: 'price or proposal integrity issue', owner: 'operator' },
  { key: 'disable_platform_v7', scope: 'all_platform_v7', enabled: false, reason: 'critical operational incident', owner: 'engineering' },
];

export function classifyPlatformV7Signal(signal: PlatformV7ObservableSignal): PlatformV7Severity {
  if (PLATFORM_V7_CRITICAL_SIGNALS.includes(signal)) return 'critical';
  if (signal === 'document_blocker' || signal === 'dispute_opened' || signal === 'action_feedback_failure') return 'warning';
  return 'info';
}

export function requiresPlatformV7OperatorAction(signal: PlatformV7ObservableSignal): boolean {
  return classifyPlatformV7Signal(signal) !== 'info';
}
