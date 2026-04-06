import { normalizeStatusCode } from './canonical-models';

export type WorkflowLane = 'deal' | 'payment' | 'dispute' | 'shipment' | 'document';
export type TransitionRule = {
  lane: WorkflowLane;
  from: string;
  to: string;
  allowed: boolean;
  reasonCode?: string;
  owner?: string;
  requiresEvidence?: boolean;
  requiresDocs?: boolean;
};

const RULES: TransitionRule[] = [
  { lane: 'deal', from: 'DRAFT', to: 'AWAITING_SIGN', allowed: true, owner: 'commercial' },
  { lane: 'deal', from: 'AWAITING_SIGN', to: 'SIGNED', allowed: true, owner: 'seller_buyer', requiresDocs: true },
  { lane: 'deal', from: 'SIGNED', to: 'PREPAYMENT_RESERVED', allowed: true, owner: 'finance', requiresDocs: true },
  { lane: 'deal', from: 'PREPAYMENT_RESERVED', to: 'LOADING', allowed: true, owner: 'logistics' },
  { lane: 'deal', from: 'LOADING', to: 'IN_TRANSIT', allowed: true, owner: 'driver', requiresEvidence: true },
  { lane: 'deal', from: 'IN_TRANSIT', to: 'ARRIVED', allowed: true, owner: 'receiving', requiresEvidence: true },
  { lane: 'deal', from: 'ARRIVED', to: 'QUALITY_CHECK', allowed: true, owner: 'lab', requiresEvidence: true },
  { lane: 'deal', from: 'QUALITY_CHECK', to: 'ACCEPTED', allowed: true, owner: 'buyer', requiresDocs: true },
  { lane: 'deal', from: 'ACCEPTED', to: 'FINAL_PAYMENT', allowed: true, owner: 'finance', requiresDocs: true },
  { lane: 'deal', from: 'FINAL_PAYMENT', to: 'SETTLED', allowed: true, owner: 'finance', requiresDocs: true },
  { lane: 'deal', from: 'SETTLED', to: 'CLOSED', allowed: true, owner: 'operator' },
  { lane: 'deal', from: 'ACCEPTED', to: 'DISPUTE_OPEN', allowed: true, owner: 'operator', requiresEvidence: true },
  { lane: 'deal', from: 'DISPUTE_OPEN', to: 'PARTIAL_SETTLEMENT', allowed: true, owner: 'operator', requiresEvidence: true },
  { lane: 'deal', from: 'PARTIAL_SETTLEMENT', to: 'ARBITRATION_DECISION', allowed: true, owner: 'support_manager', requiresEvidence: true },
  { lane: 'deal', from: 'ARBITRATION_DECISION', to: 'FINAL_PAYMENT', allowed: true, owner: 'finance', requiresDocs: true },
  { lane: 'payment', from: 'PENDING', to: 'HOLD_ACTIVE', allowed: true, owner: 'finance' },
  { lane: 'payment', from: 'HOLD_ACTIVE', to: 'READY_FOR_RELEASE', allowed: true, owner: 'finance', requiresDocs: true },
  { lane: 'payment', from: 'READY_FOR_RELEASE', to: 'PARTIAL_RELEASE', allowed: true, owner: 'finance', requiresDocs: true },
  { lane: 'payment', from: 'READY_FOR_RELEASE', to: 'PAID', allowed: true, owner: 'finance', requiresDocs: true },
  { lane: 'payment', from: 'PARTIAL_RELEASE', to: 'PAID', allowed: true, owner: 'finance', requiresDocs: true },
  { lane: 'payment', from: 'PAID', to: 'REVERSED', allowed: false, reasonCode: 'payment_reversal_manual_only', owner: 'risk' },
  { lane: 'dispute', from: 'OPEN', to: 'TRIAGE', allowed: true, owner: 'operator', requiresEvidence: true },
  { lane: 'dispute', from: 'TRIAGE', to: 'EVIDENCE_COLLECTION', allowed: true, owner: 'operator' },
  { lane: 'dispute', from: 'EVIDENCE_COLLECTION', to: 'LAB_REVIEW', allowed: true, owner: 'lab', requiresEvidence: true },
  { lane: 'dispute', from: 'LAB_REVIEW', to: 'DECISION', allowed: true, owner: 'support_manager', requiresEvidence: true },
  { lane: 'dispute', from: 'DECISION', to: 'EXECUTED', allowed: true, owner: 'finance', requiresDocs: true },
  { lane: 'dispute', from: 'EXECUTED', to: 'CLOSED', allowed: true, owner: 'operator' },
  { lane: 'shipment', from: 'ASSIGNED', to: 'DRIVER_CONFIRMED', allowed: true, owner: 'driver' },
  { lane: 'shipment', from: 'DRIVER_CONFIRMED', to: 'AT_LOADING', allowed: true, owner: 'driver', requiresEvidence: true },
  { lane: 'shipment', from: 'AT_LOADING', to: 'LOADED', allowed: true, owner: 'driver', requiresEvidence: true },
  { lane: 'shipment', from: 'LOADED', to: 'IN_TRANSIT', allowed: true, owner: 'driver', requiresEvidence: true },
  { lane: 'shipment', from: 'IN_TRANSIT', to: 'AT_UNLOADING', allowed: true, owner: 'driver', requiresEvidence: true },
  { lane: 'shipment', from: 'AT_UNLOADING', to: 'UNLOADED', allowed: true, owner: 'receiving', requiresEvidence: true },
  { lane: 'shipment', from: 'UNLOADED', to: 'CONFIRMED', allowed: true, owner: 'operator', requiresDocs: true },
  { lane: 'document', from: 'DRAFT', to: 'GENERATED', allowed: true, owner: 'system' },
  { lane: 'document', from: 'GENERATED', to: 'SIGNED', allowed: true, owner: 'counterparty', requiresDocs: true },
  { lane: 'document', from: 'SIGNED', to: 'ARCHIVED', allowed: true, owner: 'operator' },
];

export function listTransitionRules(lane?: WorkflowLane) {
  return lane ? RULES.filter((item) => item.lane === lane) : [...RULES];
}

export function evaluateStatusTransition(input: {
  lane: WorkflowLane;
  from?: string | null;
  to?: string | null;
  docsReady?: boolean;
  evidenceReady?: boolean;
}) {
  const from = normalizeStatusCode(input.from);
  const to = normalizeStatusCode(input.to);
  if (from && to && from === to) return { allowed: true, owner: 'operator', reasonCodes: [], rule: null };
  const rule = RULES.find((item) => item.lane === input.lane && item.from === from && item.to === to);
  if (!rule) {
    return { allowed: false, owner: 'operator', reasonCodes: ['transition_not_allowed'], rule: null };
  }
  const reasons: string[] = [];
  if (!rule.allowed) reasons.push(rule.reasonCode || 'transition_manual_only');
  if (rule.requiresDocs && !input.docsReady) reasons.push('documents_not_ready');
  if (rule.requiresEvidence && !input.evidenceReady) reasons.push('evidence_not_ready');
  return {
    allowed: reasons.length === 0,
    owner: rule.owner || 'operator',
    reasonCodes: reasons,
    rule
  };
}

export function buildStatusPolicySummary() {
  return {
    lanes: ['deal', 'payment', 'dispute', 'shipment', 'document'] as WorkflowLane[],
    transitions: RULES.length,
    blockedByDefault: RULES.filter((item) => !item.allowed).length,
    requiresDocs: RULES.filter((item) => item.requiresDocs).length,
    requiresEvidence: RULES.filter((item) => item.requiresEvidence).length
  };
}
