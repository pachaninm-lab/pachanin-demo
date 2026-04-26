export const PLATFORM_LAYERS = [
  'MARKET',
  'EXECUTION',
  'TRUST',
  'INTELLIGENCE',
] as const;

export type PlatformLayer = (typeof PLATFORM_LAYERS)[number];

export const MATURITY_STATUSES = [
  'demo',
  'sandbox',
  'pre-live',
  'controlled-pilot',
  'production',
] as const;

export type MaturityStatus = (typeof MATURITY_STATUSES)[number];

export const CANONICAL_DEAL_STATUSES = [
  'DRAFT',
  'COUNTERPARTY_CHECK',
  'OFFER_ACCEPTED',
  'CONTRACT_DRAFT',
  'CONTRACT_SIGNED',
  'MONEY_RESERVED',
  'LOGISTICS_PLANNED',
  'LOADING',
  'IN_TRANSIT',
  'ARRIVED',
  'WEIGHING',
  'LAB_ANALYSIS',
  'ACCEPTANCE_PENDING',
  'ACCEPTED',
  'DOCUMENTS_PENDING',
  'DOCUMENTS_COMPLETE',
  'RELEASE_PENDING',
  'PARTIAL_RELEASED',
  'DISPUTED',
  'FINAL_RELEASED',
  'CLOSED',
  'CANCELED',
  'DEGRADED',
] as const;

export type CanonicalDealStatus = (typeof CANONICAL_DEAL_STATUSES)[number];

export type CriticalAction =
  | 'RESERVE_MONEY'
  | 'HOLD_MONEY'
  | 'REQUEST_RELEASE'
  | 'EXECUTE_RELEASE'
  | 'REQUEST_REFUND'
  | 'EXECUTE_REFUND'
  | 'SIGN_DOCUMENT'
  | 'REPLACE_SIGNED_DOCUMENT'
  | 'CHANGE_BANK_DETAILS'
  | 'CLOSE_DISPUTE'
  | 'APPROVE_DISPUTE_DECISION'
  | 'OVERRIDE_BLOCKER'
  | 'FREEZE_COUNTERPARTY'
  | 'EXPORT_SENSITIVE_DATA';

export type CanonicalTaskGate =
  | 'LIQUIDITY'
  | 'DEAL_CONVERSION'
  | 'DEAL_RETENTION'
  | 'MONEY_SAFETY'
  | 'DOCUMENTARY_PROOF'
  | 'DISPUTE_REDUCTION'
  | 'BANK_READINESS'
  | 'REGULATORY_FIT'
  | 'SCALABLE_OPERATIONS'
  | 'ANTI_BYPASS';

export interface CanonicalModuleStatus {
  readonly module: string;
  readonly layer: PlatformLayer;
  readonly maturity: MaturityStatus;
  readonly ownerRole: string;
  readonly blocksMoneyRelease: boolean;
  readonly requiresAuditTrail: boolean;
}

export interface DealTransitionRule {
  readonly from: CanonicalDealStatus;
  readonly to: readonly CanonicalDealStatus[];
}

export const CANONICAL_DEAL_TRANSITIONS: readonly DealTransitionRule[] = [
  { from: 'DRAFT', to: ['COUNTERPARTY_CHECK', 'CANCELED'] },
  { from: 'COUNTERPARTY_CHECK', to: ['OFFER_ACCEPTED', 'CANCELED', 'DEGRADED'] },
  { from: 'OFFER_ACCEPTED', to: ['CONTRACT_DRAFT', 'CANCELED', 'DEGRADED'] },
  { from: 'CONTRACT_DRAFT', to: ['CONTRACT_SIGNED', 'CANCELED', 'DEGRADED'] },
  { from: 'CONTRACT_SIGNED', to: ['MONEY_RESERVED', 'DISPUTED', 'CANCELED', 'DEGRADED'] },
  { from: 'MONEY_RESERVED', to: ['LOGISTICS_PLANNED', 'DISPUTED', 'CANCELED', 'DEGRADED'] },
  { from: 'LOGISTICS_PLANNED', to: ['LOADING', 'DISPUTED', 'CANCELED', 'DEGRADED'] },
  { from: 'LOADING', to: ['IN_TRANSIT', 'DISPUTED', 'DEGRADED'] },
  { from: 'IN_TRANSIT', to: ['ARRIVED', 'DISPUTED', 'DEGRADED'] },
  { from: 'ARRIVED', to: ['WEIGHING', 'DISPUTED', 'DEGRADED'] },
  { from: 'WEIGHING', to: ['LAB_ANALYSIS', 'ACCEPTANCE_PENDING', 'DISPUTED', 'DEGRADED'] },
  { from: 'LAB_ANALYSIS', to: ['ACCEPTANCE_PENDING', 'DISPUTED', 'DEGRADED'] },
  { from: 'ACCEPTANCE_PENDING', to: ['ACCEPTED', 'DISPUTED', 'DEGRADED'] },
  { from: 'ACCEPTED', to: ['DOCUMENTS_PENDING', 'DISPUTED', 'DEGRADED'] },
  { from: 'DOCUMENTS_PENDING', to: ['DOCUMENTS_COMPLETE', 'DISPUTED', 'DEGRADED'] },
  { from: 'DOCUMENTS_COMPLETE', to: ['RELEASE_PENDING', 'DISPUTED', 'DEGRADED'] },
  { from: 'RELEASE_PENDING', to: ['PARTIAL_RELEASED', 'FINAL_RELEASED', 'DISPUTED', 'DEGRADED'] },
  { from: 'PARTIAL_RELEASED', to: ['FINAL_RELEASED', 'DISPUTED', 'DEGRADED'] },
  { from: 'DISPUTED', to: ['DOCUMENTS_PENDING', 'RELEASE_PENDING', 'PARTIAL_RELEASED', 'FINAL_RELEASED', 'CANCELED', 'DEGRADED'] },
  { from: 'FINAL_RELEASED', to: ['CLOSED'] },
  { from: 'CLOSED', to: [] },
  { from: 'CANCELED', to: [] },
  { from: 'DEGRADED', to: ['COUNTERPARTY_CHECK', 'CONTRACT_DRAFT', 'CONTRACT_SIGNED', 'MONEY_RESERVED', 'LOGISTICS_PLANNED', 'LOADING', 'IN_TRANSIT', 'ARRIVED', 'WEIGHING', 'LAB_ANALYSIS', 'ACCEPTANCE_PENDING', 'ACCEPTED', 'DOCUMENTS_PENDING', 'DOCUMENTS_COMPLETE', 'RELEASE_PENDING', 'DISPUTED', 'CANCELED'] },
];

const transitionMap = new Map<CanonicalDealStatus, readonly CanonicalDealStatus[]>(
  CANONICAL_DEAL_TRANSITIONS.map((rule) => [rule.from, rule.to]),
);

export function canTransitionDeal(from: CanonicalDealStatus, to: CanonicalDealStatus): boolean {
  return transitionMap.get(from)?.includes(to) ?? false;
}

export function assertDealTransition(from: CanonicalDealStatus, to: CanonicalDealStatus): void {
  if (!canTransitionDeal(from, to)) {
    throw new Error(`Invalid deal transition: ${from} -> ${to}`);
  }
}

export const CRITICAL_ACTION_REQUIREMENTS: Record<CriticalAction, readonly string[]> = {
  RESERVE_MONEY: ['authority', 'audit-event', 'idempotency-key'],
  HOLD_MONEY: ['authority', 'audit-event', 'idempotency-key'],
  REQUEST_RELEASE: ['authority', 'audit-event', 'document-gates', 'open-dispute-check', 'idempotency-key'],
  EXECUTE_RELEASE: ['authority', 'audit-event', '2fa', 'document-gates', 'open-dispute-check', 'bank-reconciliation', 'idempotency-key'],
  REQUEST_REFUND: ['authority', 'audit-event', 'dispute-decision', 'idempotency-key'],
  EXECUTE_REFUND: ['authority', 'audit-event', '2fa', 'bank-reconciliation', 'idempotency-key'],
  SIGN_DOCUMENT: ['authority', 'audit-event', 'signature-context'],
  REPLACE_SIGNED_DOCUMENT: ['authority', 'audit-event', 'correction-event', 'reason-required'],
  CHANGE_BANK_DETAILS: ['authority', 'audit-event', '2fa', 'counterparty-freeze'],
  CLOSE_DISPUTE: ['authority', 'audit-event', 'decision-required', 'money-effect-preview'],
  APPROVE_DISPUTE_DECISION: ['authority', 'audit-event', '2fa', 'signed-decision'],
  OVERRIDE_BLOCKER: ['authority', 'audit-event', 'reason-required', 'expiry-required'],
  FREEZE_COUNTERPARTY: ['authority', 'audit-event', 'reason-required'],
  EXPORT_SENSITIVE_DATA: ['authority', 'audit-event', 'data-scope'],
};

export const CANONICAL_TASK_GATES: readonly CanonicalTaskGate[] = [
  'LIQUIDITY',
  'DEAL_CONVERSION',
  'DEAL_RETENTION',
  'MONEY_SAFETY',
  'DOCUMENTARY_PROOF',
  'DISPUTE_REDUCTION',
  'BANK_READINESS',
  'REGULATORY_FIT',
  'SCALABLE_OPERATIONS',
  'ANTI_BYPASS',
];

export function isStrategicPlatformTask(gates: readonly CanonicalTaskGate[]): boolean {
  const uniqueGates = new Set(gates);
  return uniqueGates.size >= 3;
}

export const FORBIDDEN_UNPROVEN_CLAIMS = [
  'production-ready',
  'ФГИС подключен',
  'банк работает',
  'гарантируем оплату',
  'ЭДО закрыт',
  'спор решается автоматически',
] as const;

export const CANONICAL_PLATFORM_POSITIONING =
  'Market layer создает ликвидность; execution layer доводит агросделку до денег; trust layer фиксирует ответственность, документы и доказательства.' as const;
