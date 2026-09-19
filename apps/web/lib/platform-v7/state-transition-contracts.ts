export type PlatformV7StateEntity =
  | 'lot'
  | 'rfq'
  | 'proposal'
  | 'deal'
  | 'money'
  | 'document'
  | 'trip'
  | 'dispute';

export type PlatformV7TransitionGuard =
  | 'readiness_required'
  | 'counterparty_required'
  | 'deal_required'
  | 'money_reserved_required'
  | 'documents_required'
  | 'external_confirmation_required'
  | 'manual_review_required'
  | 'evidence_required'
  | 'decision_required'
  | 'none';

export type PlatformV7StateTransition = {
  readonly entity: PlatformV7StateEntity;
  readonly from: string;
  readonly to: string;
  readonly guard: PlatformV7TransitionGuard;
  readonly actorRoles: readonly string[];
  readonly affectsMoney: boolean;
  readonly summary: string;
};

export const PLATFORM_V7_STATE_TRANSITIONS: readonly PlatformV7StateTransition[] = [
  { entity: 'lot', from: 'draft', to: 'readiness_review', guard: 'readiness_required', actorRoles: ['seller', 'operator'], affectsMoney: false, summary: 'Lot cannot enter the market until batch readiness is checked.' },
  { entity: 'lot', from: 'readiness_review', to: 'published', guard: 'documents_required', actorRoles: ['seller', 'operator'], affectsMoney: false, summary: 'Published lot requires basic document and quality readiness.' },
  { entity: 'lot', from: 'published', to: 'proposal_received', guard: 'counterparty_required', actorRoles: ['buyer'], affectsMoney: false, summary: 'Buyer proposal attaches counterparty and commercial terms to the lot.' },
  { entity: 'lot', from: 'proposal_received', to: 'deal_draft', guard: 'counterparty_required', actorRoles: ['seller', 'buyer', 'operator'], affectsMoney: false, summary: 'Accepted proposal can create a deal draft only after both sides are linked.' },

  { entity: 'rfq', from: 'draft', to: 'published', guard: 'readiness_required', actorRoles: ['buyer', 'operator'], affectsMoney: false, summary: 'Buyer demand is published only after quality, volume, basis and document requirements are clear.' },
  { entity: 'rfq', from: 'published', to: 'matched', guard: 'counterparty_required', actorRoles: ['seller', 'operator'], affectsMoney: false, summary: 'RFQ match requires a real seller-side batch or lot candidate.' },
  { entity: 'rfq', from: 'matched', to: 'proposal_received', guard: 'counterparty_required', actorRoles: ['seller'], affectsMoney: false, summary: 'Seller proposal can answer the RFQ only with attached terms and availability.' },

  { entity: 'proposal', from: 'submitted', to: 'under_review', guard: 'counterparty_required', actorRoles: ['seller', 'buyer', 'operator'], affectsMoney: false, summary: 'Submitted proposal enters review before it can be accepted.' },
  { entity: 'proposal', from: 'under_review', to: 'accepted', guard: 'counterparty_required', actorRoles: ['seller', 'buyer'], affectsMoney: false, summary: 'Acceptance requires linked parties and visible commercial terms.' },
  { entity: 'proposal', from: 'under_review', to: 'rejected', guard: 'none', actorRoles: ['seller', 'buyer', 'operator'], affectsMoney: false, summary: 'Proposal can be rejected without creating a deal.' },
  { entity: 'proposal', from: 'accepted', to: 'deal_created', guard: 'deal_required', actorRoles: ['operator'], affectsMoney: false, summary: 'Accepted proposal creates a deal container before money or logistics actions.' },

  { entity: 'deal', from: 'draft', to: 'terms_confirmed', guard: 'counterparty_required', actorRoles: ['seller', 'buyer', 'operator'], affectsMoney: false, summary: 'Deal terms must be confirmed before money reserve.' },
  { entity: 'deal', from: 'terms_confirmed', to: 'money_requested', guard: 'deal_required', actorRoles: ['buyer', 'bank', 'operator'], affectsMoney: true, summary: 'Money request can start only from confirmed deal terms.' },
  { entity: 'deal', from: 'money_requested', to: 'in_execution', guard: 'money_reserved_required', actorRoles: ['bank', 'operator'], affectsMoney: true, summary: 'Execution starts only after reserve or bank-side confirmation boundary is visible.' },
  { entity: 'deal', from: 'in_execution', to: 'acceptance_review', guard: 'documents_required', actorRoles: ['elevator', 'lab', 'surveyor', 'operator'], affectsMoney: false, summary: 'Acceptance review requires execution documents and quality/weight evidence.' },
  { entity: 'deal', from: 'acceptance_review', to: 'money_decision', guard: 'external_confirmation_required', actorRoles: ['bank', 'operator'], affectsMoney: true, summary: 'Money decision requires external or manual confirmation boundaries.' },
  { entity: 'deal', from: 'money_decision', to: 'closed', guard: 'decision_required', actorRoles: ['bank', 'operator'], affectsMoney: true, summary: 'Deal closes only after money release, hold, dispute decision or manual review outcome.' },

  { entity: 'money', from: 'not_requested', to: 'reserve_requested', guard: 'deal_required', actorRoles: ['buyer', 'operator'], affectsMoney: true, summary: 'Reserve request requires a deal container.' },
  { entity: 'money', from: 'reserve_requested', to: 'reserved', guard: 'external_confirmation_required', actorRoles: ['bank'], affectsMoney: true, summary: 'Reserved state requires bank confirmation or explicit manual-review boundary.' },
  { entity: 'money', from: 'reserved', to: 'held', guard: 'documents_required', actorRoles: ['bank', 'operator'], affectsMoney: true, summary: 'Hold is allowed when documents, quality, weight or dispute blockers exist.' },
  { entity: 'money', from: 'reserved', to: 'ready_to_release', guard: 'documents_required', actorRoles: ['bank', 'operator'], affectsMoney: true, summary: 'Ready-to-release requires documents and acceptance evidence.' },
  { entity: 'money', from: 'ready_to_release', to: 'released', guard: 'external_confirmation_required', actorRoles: ['bank'], affectsMoney: true, summary: 'Released state requires bank-side confirmation boundary; platform does not release money by itself.' },
  { entity: 'money', from: 'held', to: 'manual_review', guard: 'manual_review_required', actorRoles: ['bank', 'operator', 'compliance'], affectsMoney: true, summary: 'Manual review keeps funds blocked until the reason is closed.' },

  { entity: 'document', from: 'missing', to: 'requested', guard: 'deal_required', actorRoles: ['seller', 'buyer', 'operator'], affectsMoney: false, summary: 'Document request must be linked to deal, lot, trip or acceptance requirement.' },
  { entity: 'document', from: 'requested', to: 'uploaded', guard: 'none', actorRoles: ['seller', 'buyer', 'elevator', 'lab', 'surveyor', 'logistics'], affectsMoney: false, summary: 'Uploaded document is not treated as externally confirmed.' },
  { entity: 'document', from: 'uploaded', to: 'under_review', guard: 'manual_review_required', actorRoles: ['operator', 'compliance'], affectsMoney: false, summary: 'Uploaded document can require manual review before money impact.' },
  { entity: 'document', from: 'under_review', to: 'accepted', guard: 'external_confirmation_required', actorRoles: ['operator', 'compliance'], affectsMoney: true, summary: 'Accepted document can influence money only after confirmation boundary is explicit.' },
  { entity: 'document', from: 'under_review', to: 'rejected', guard: 'manual_review_required', actorRoles: ['operator', 'compliance'], affectsMoney: true, summary: 'Rejected document can block money and execution.' },

  { entity: 'trip', from: 'planned', to: 'driver_assigned', guard: 'counterparty_required', actorRoles: ['logistics', 'operator'], affectsMoney: false, summary: 'Driver assignment requires linked logistics order and actor.' },
  { entity: 'trip', from: 'driver_assigned', to: 'loading_started', guard: 'documents_required', actorRoles: ['driver', 'logistics'], affectsMoney: false, summary: 'Loading starts only with route and pickup instructions visible.' },
  { entity: 'trip', from: 'loading_started', to: 'in_transit', guard: 'documents_required', actorRoles: ['driver', 'logistics'], affectsMoney: false, summary: 'Transit requires loading confirmation, weight or photo evidence boundary.' },
  { entity: 'trip', from: 'in_transit', to: 'arrived', guard: 'none', actorRoles: ['driver'], affectsMoney: false, summary: 'Arrival is a field action with time and location evidence.' },
  { entity: 'trip', from: 'arrived', to: 'accepted', guard: 'documents_required', actorRoles: ['elevator', 'surveyor', 'operator'], affectsMoney: true, summary: 'Accepted trip can affect money only with receiving, weight and evidence records.' },
  { entity: 'trip', from: 'arrived', to: 'incident_opened', guard: 'evidence_required', actorRoles: ['driver', 'logistics', 'operator'], affectsMoney: true, summary: 'Incident requires evidence and may block money or acceptance.' },

  { entity: 'dispute', from: 'draft', to: 'opened', guard: 'evidence_required', actorRoles: ['seller', 'buyer', 'operator'], affectsMoney: true, summary: 'Opened dispute requires reason and evidence link.' },
  { entity: 'dispute', from: 'opened', to: 'evidence_review', guard: 'evidence_required', actorRoles: ['operator', 'arbitrator'], affectsMoney: true, summary: 'Evidence review freezes decision until relevant documents and events are visible.' },
  { entity: 'dispute', from: 'evidence_review', to: 'decision_ready', guard: 'decision_required', actorRoles: ['arbitrator', 'operator'], affectsMoney: true, summary: 'Decision-ready state requires documented reasoning and money impact.' },
  { entity: 'dispute', from: 'decision_ready', to: 'resolved', guard: 'decision_required', actorRoles: ['arbitrator', 'bank', 'operator'], affectsMoney: true, summary: 'Resolved dispute must point to decision, money action and audit event.' },
];

export function getPlatformV7TransitionsForEntity(entity: PlatformV7StateEntity) {
  return PLATFORM_V7_STATE_TRANSITIONS.filter((transition) => transition.entity === entity);
}

export function getPlatformV7AllowedNextStates(entity: PlatformV7StateEntity, from: string) {
  return PLATFORM_V7_STATE_TRANSITIONS.filter((transition) => transition.entity === entity && transition.from === from).map(
    (transition) => transition.to,
  );
}

export function canPlatformV7Transition(entity: PlatformV7StateEntity, from: string, to: string): boolean {
  return PLATFORM_V7_STATE_TRANSITIONS.some(
    (transition) => transition.entity === entity && transition.from === from && transition.to === to,
  );
}

export function getPlatformV7TransitionGuard(entity: PlatformV7StateEntity, from: string, to: string) {
  return PLATFORM_V7_STATE_TRANSITIONS.find(
    (transition) => transition.entity === entity && transition.from === from && transition.to === to,
  )?.guard;
}

export function doesPlatformV7TransitionAffectMoney(entity: PlatformV7StateEntity, from: string, to: string): boolean {
  return (
    PLATFORM_V7_STATE_TRANSITIONS.find(
      (transition) => transition.entity === entity && transition.from === from && transition.to === to,
    )?.affectsMoney === true
  );
}

export function getPlatformV7StateTransitionSummary() {
  const moneyAffecting = PLATFORM_V7_STATE_TRANSITIONS.filter((transition) => transition.affectsMoney);

  return {
    total: PLATFORM_V7_STATE_TRANSITIONS.length,
    entities: Array.from(new Set(PLATFORM_V7_STATE_TRANSITIONS.map((transition) => transition.entity))),
    moneyAffecting: moneyAffecting.length,
    mode: 'contract_only_requires_runtime_state_machine' as const,
  };
}
