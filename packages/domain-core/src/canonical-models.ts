export const CANONICAL_DATA_SOURCES = [
  'runtime_snapshot',
  'postgres',
  'sandbox_fixture',
  'edo',
  'fgis_zerno',
  'bank',
  'gps',
  'lab',
  'smartagro',
  'operator_override'
] as const;

export const LOT_STATUSES = ['DRAFT', 'OPEN', 'BIDDING', 'MATCHED', 'IN_DEAL', 'CLOSED', 'CANCELLED'] as const;
export const DEAL_STATUSES = ['DRAFT', 'AWAITING_SIGN', 'SIGNED', 'PREPAYMENT_RESERVED', 'LOADING', 'IN_TRANSIT', 'ARRIVED', 'QUALITY_CHECK', 'ACCEPTED', 'FINAL_PAYMENT', 'SETTLED', 'CLOSED', 'DISPUTE_OPEN', 'EXPERTISE', 'ARBITRATION_DECISION', 'PARTIAL_SETTLEMENT', 'CANCELLATION'] as const;
export const PAYMENT_STATES = ['PENDING', 'HOLD_ACTIVE', 'READY_FOR_RELEASE', 'PARTIAL_RELEASE', 'PAID', 'FAILED', 'REVERSED'] as const;
export const DISPUTE_STATES = ['OPEN', 'UNDER_REVIEW', 'EXPERTISE', 'DECISION', 'PARTIAL_OUTCOME', 'RESOLVED', 'CLOSED'] as const;
export const DOCUMENT_STATES = ['MISSING', 'DRAFT', 'GENERATED', 'SIGNED', 'EXPIRED', 'DISPUTED', 'ARCHIVED'] as const;
export const MANDATORY_DEAL_DOCUMENT_TYPES = ['CONTRACT', 'TTN', 'WEIGH_TICKET'] as const;
export const WORKFLOW_READONLY_STATUSES = ['CLOSED', 'SETTLED', 'REJECTED', 'DECLINED', 'EXECUTED', 'CANCELLED', 'ARCHIVED'] as const;

export const ACTION_RIGHTS_BY_ROLE: Record<string, string[]> = {
  FARMER: ['lot.create', 'lot.publish', 'deal.sign', 'document.upload'],
  BUYER: ['bid.place', 'deal.accept', 'payment.reserve'],
  LOGISTICIAN: ['shipment.assign', 'shipment.update'],
  DRIVER: ['evidence.capture', 'checkpoint.complete'],
  LAB: ['lab.protocol_issue'],
  ELEVATOR: ['receiving.complete', 'weight.confirm'],
  ACCOUNTING: ['payment.release', 'settlement.export'],
  SUPPORT_MANAGER: ['blocker.assign', 'override.apply', 'dispute.route'],
  ADMIN: ['override.apply', 'config.change', 'connector.enable']
};

export function normalizeStatusCode(value?: string | null) {
  return String(value || '').trim().toUpperCase().replace(/[-\s]+/g, '_');
}

export function isReadonlyWorkflowStatus(value?: string | null) {
  const normalized = normalizeStatusCode(value);
  return WORKFLOW_READONLY_STATUSES.includes(normalized as (typeof WORKFLOW_READONLY_STATUSES)[number]);
}

export function normalizeSourceSystem(value?: string | null) {
  const normalized = String(value || '').trim().toLowerCase();
  return (CANONICAL_DATA_SOURCES as readonly string[]).includes(normalized) ? normalized : 'runtime_snapshot';
}
