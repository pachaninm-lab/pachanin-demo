export type PlatformV7ExecutionRole =
  | 'seller'
  | 'buyer'
  | 'logistics'
  | 'driver'
  | 'elevator'
  | 'lab'
  | 'surveyor'
  | 'bank'
  | 'operator'
  | 'arbitrator'
  | 'compliance'
  | 'investor'
  | 'executive';

export type PlatformV7EntityId = string;
export type PlatformV7IsoDateTime = string;
export type PlatformV7RubAmount = number;
export type PlatformV7Tons = number;
export type PlatformV7Basis = 'EXW' | 'FCA' | 'CPT' | 'DAP';
export type PlatformV7ExecutionGate = 'publication' | 'deal_creation' | 'shipment' | 'acceptance' | 'money_release' | 'none';

export interface PlatformV7Blocker {
  id: PlatformV7EntityId;
  title: string;
  reason: string;
  responsibleRole: PlatformV7ExecutionRole;
  blocks: PlatformV7ExecutionGate;
  severity: 'warning' | 'critical';
  createdAt: PlatformV7IsoDateTime;
}

export interface PlatformV7NextAction {
  id: PlatformV7EntityId;
  title: string;
  responsibleRole: PlatformV7ExecutionRole;
  targetRoute: string;
  disabled?: boolean;
  disabledReason?: string;
  createsAuditEvent: boolean;
}

export interface PlatformV7ReadinessFactor {
  status: 'missing' | 'partial' | 'ready' | 'blocked' | 'manual_review';
  score: number;
  reason: string;
  responsibleRole: PlatformV7ExecutionRole;
}

export interface PlatformV7MoneyTree {
  id: PlatformV7EntityId;
  dealId: PlatformV7EntityId;
  totalDealAmountRub: PlatformV7RubAmount;
  reservedAmountRub: PlatformV7RubAmount;
  readyToReleaseRub: PlatformV7RubAmount;
  heldAmountRub: PlatformV7RubAmount;
  disputedAmountRub: PlatformV7RubAmount;
  manualReviewAmountRub: PlatformV7RubAmount;
  releasedAmountRub: PlatformV7RubAmount;
  returnedAmountRub: PlatformV7RubAmount;
  feeAmountRub: PlatformV7RubAmount;
  reconciliationStatus: 'balanced' | 'amount_mismatch' | 'awaiting_bank_event' | 'manual_review';
}

export interface PlatformV7DocumentRequirement {
  id: PlatformV7EntityId;
  dealId: PlatformV7EntityId;
  type: 'sdiz' | 'fgis_batch' | 'etrn' | 'acceptance_act' | 'lab_protocol' | 'invoice' | 'upd' | 'quality_certificate' | 'transport_order';
  responsibleRole: PlatformV7ExecutionRole;
  status: 'missing' | 'draft' | 'uploaded' | 'signed' | 'sent' | 'confirmed' | 'rejected' | 'manual_review';
  blocks: PlatformV7ExecutionGate;
  nextAction: PlatformV7NextAction;
  source: 'manual' | 'edo' | 'fgis' | 'bank' | 'lab' | 'elevator' | 'logistics' | 'operator';
  externalReference?: string;
}

export const PLATFORM_V7_EXECUTION_CHAIN = [
  'batch',
  'readiness',
  'lot_or_rfq',
  'proposal',
  'deal',
  'money_reserve',
  'fgis_sdiz',
  'logistics',
  'trip',
  'driver',
  'elevator',
  'weighing',
  'lab',
  'documents',
  'money_release_or_hold',
  'dispute',
  'evidence',
  'decision',
  'closed',
] as const;

export const PLATFORM_V7_EXECUTION_ROLES = [
  'seller',
  'buyer',
  'logistics',
  'driver',
  'elevator',
  'lab',
  'surveyor',
  'bank',
  'operator',
  'arbitrator',
  'compliance',
  'investor',
  'executive',
] as const satisfies readonly PlatformV7ExecutionRole[];

export function isPlatformV7MoneyTreeBalanced(tree: PlatformV7MoneyTree): boolean {
  const activeBucketsRub = tree.readyToReleaseRub + tree.heldAmountRub + tree.disputedAmountRub + tree.manualReviewAmountRub + tree.releasedAmountRub + tree.returnedAmountRub + tree.feeAmountRub;
  return activeBucketsRub <= tree.totalDealAmountRub && tree.reservedAmountRub <= tree.totalDealAmountRub;
}
