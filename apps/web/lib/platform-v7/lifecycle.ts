export type PlatformV7LotStatus =
  | 'draft'
  | 'needs_documents'
  | 'needs_quality'
  | 'needs_fgis'
  | 'ready_for_publication'
  | 'published'
  | 'offer_received'
  | 'under_negotiation'
  | 'reserved'
  | 'deal_created'
  | 'cancelled'
  | 'expired'
  | 'blocked';

export type PlatformV7RfqStatus = 'draft' | 'published' | 'matching' | 'offers_received' | 'offer_selected' | 'deal_created' | 'expired' | 'cancelled' | 'blocked';
export type PlatformV7OfferStatus = 'draft' | 'submitted' | 'under_review' | 'countered' | 'accepted' | 'rejected' | 'withdrawn' | 'expired' | 'deal_created';
export type PlatformV7DealStatus =
  | 'draft'
  | 'awaiting_party_confirmation'
  | 'awaiting_compliance_check'
  | 'awaiting_money_reserve'
  | 'money_reserved'
  | 'awaiting_documents'
  | 'awaiting_logistics'
  | 'in_loading'
  | 'in_transit'
  | 'arrived'
  | 'weighing'
  | 'quality_check'
  | 'acceptance_pending'
  | 'accepted'
  | 'release_basis_ready'
  | 'release_requested'
  | 'released'
  | 'closed'
  | 'disputed'
  | 'cancelled'
  | 'blocked';

export type PlatformV7DocumentStatus = 'missing' | 'draft' | 'uploaded' | 'signed' | 'sent' | 'confirmed' | 'rejected' | 'expired' | 'manual_review';
export type PlatformV7TripStatus = 'created' | 'carrier_assigned' | 'driver_assigned' | 'accepted_by_driver' | 'arrived_to_loading' | 'loading_started' | 'loaded' | 'departed' | 'in_transit' | 'arrived_to_destination' | 'weighing' | 'unloaded' | 'accepted' | 'completed' | 'deviation' | 'blocked' | 'cancelled';
export type PlatformV7DisputeStatus = 'none' | 'claim_created' | 'evidence_collection' | 'under_review' | 'decision_pending' | 'decision_issued' | 'bank_basis_sent' | 'resolved' | 'cancelled';

export interface PlatformV7LifecycleTransition<TStatus extends string> {
  readonly from: TStatus;
  readonly to: TStatus;
  readonly event: string;
}

export interface PlatformV7LifecycleDecision<TStatus extends string> {
  readonly allowed: boolean;
  readonly from: TStatus;
  readonly to: TStatus;
  readonly reason: string;
}

const dealTransitions: readonly PlatformV7LifecycleTransition<PlatformV7DealStatus>[] = [
  { from: 'draft', to: 'awaiting_party_confirmation', event: 'submit_deal' },
  { from: 'awaiting_party_confirmation', to: 'awaiting_compliance_check', event: 'parties_confirmed' },
  { from: 'awaiting_compliance_check', to: 'awaiting_money_reserve', event: 'compliance_clear' },
  { from: 'awaiting_money_reserve', to: 'money_reserved', event: 'bank_reserve_confirmed' },
  { from: 'money_reserved', to: 'awaiting_documents', event: 'reserve_ready' },
  { from: 'awaiting_documents', to: 'awaiting_logistics', event: 'documents_ready_for_shipment' },
  { from: 'awaiting_logistics', to: 'in_loading', event: 'trip_assigned' },
  { from: 'in_loading', to: 'in_transit', event: 'loaded_and_departed' },
  { from: 'in_transit', to: 'arrived', event: 'arrived_to_destination' },
  { from: 'arrived', to: 'weighing', event: 'start_weighing' },
  { from: 'weighing', to: 'quality_check', event: 'weight_recorded' },
  { from: 'quality_check', to: 'acceptance_pending', event: 'lab_protocol_attached' },
  { from: 'acceptance_pending', to: 'accepted', event: 'acceptance_confirmed' },
  { from: 'accepted', to: 'release_basis_ready', event: 'release_basis_completed' },
  { from: 'release_basis_ready', to: 'release_requested', event: 'release_requested' },
  { from: 'release_requested', to: 'released', event: 'bank_release_confirmed' },
  { from: 'released', to: 'closed', event: 'deal_closed' },
  { from: 'release_basis_ready', to: 'disputed', event: 'dispute_opened' },
  { from: 'disputed', to: 'release_basis_ready', event: 'dispute_resolved' },
];

const tripTransitions: readonly PlatformV7LifecycleTransition<PlatformV7TripStatus>[] = [
  { from: 'created', to: 'carrier_assigned', event: 'carrier_assigned' },
  { from: 'carrier_assigned', to: 'driver_assigned', event: 'driver_assigned' },
  { from: 'driver_assigned', to: 'accepted_by_driver', event: 'driver_accepts' },
  { from: 'accepted_by_driver', to: 'arrived_to_loading', event: 'arrived_to_loading' },
  { from: 'arrived_to_loading', to: 'loading_started', event: 'loading_started' },
  { from: 'loading_started', to: 'loaded', event: 'loaded' },
  { from: 'loaded', to: 'departed', event: 'departed' },
  { from: 'departed', to: 'in_transit', event: 'gps_in_transit' },
  { from: 'in_transit', to: 'arrived_to_destination', event: 'arrived_to_destination' },
  { from: 'arrived_to_destination', to: 'weighing', event: 'weighing_started' },
  { from: 'weighing', to: 'unloaded', event: 'unloaded' },
  { from: 'unloaded', to: 'accepted', event: 'accepted' },
  { from: 'accepted', to: 'completed', event: 'completed' },
];

const disputeTransitions: readonly PlatformV7LifecycleTransition<PlatformV7DisputeStatus>[] = [
  { from: 'none', to: 'claim_created', event: 'claim_created' },
  { from: 'claim_created', to: 'evidence_collection', event: 'evidence_requested' },
  { from: 'evidence_collection', to: 'under_review', event: 'evidence_complete' },
  { from: 'under_review', to: 'decision_pending', event: 'review_complete' },
  { from: 'decision_pending', to: 'decision_issued', event: 'decision_issued' },
  { from: 'decision_issued', to: 'bank_basis_sent', event: 'bank_basis_sent' },
  { from: 'bank_basis_sent', to: 'resolved', event: 'bank_basis_accepted' },
];

export function platformV7CanTransition<TStatus extends string>(transitions: readonly PlatformV7LifecycleTransition<TStatus>[], from: TStatus, to: TStatus): PlatformV7LifecycleDecision<TStatus> {
  const allowed = transitions.some((transition) => transition.from === from && transition.to === to);

  return {
    allowed,
    from,
    to,
    reason: allowed ? 'Transition is allowed by platform-v7 lifecycle rules.' : 'Transition is not allowed by platform-v7 lifecycle rules.',
  };
}

export function platformV7DealTransition(from: PlatformV7DealStatus, to: PlatformV7DealStatus): PlatformV7LifecycleDecision<PlatformV7DealStatus> {
  return platformV7CanTransition(dealTransitions, from, to);
}

export function platformV7TripTransition(from: PlatformV7TripStatus, to: PlatformV7TripStatus): PlatformV7LifecycleDecision<PlatformV7TripStatus> {
  return platformV7CanTransition(tripTransitions, from, to);
}

export function platformV7DisputeTransition(from: PlatformV7DisputeStatus, to: PlatformV7DisputeStatus): PlatformV7LifecycleDecision<PlatformV7DisputeStatus> {
  return platformV7CanTransition(disputeTransitions, from, to);
}

export const PLATFORM_V7_DEAL_TRANSITIONS = dealTransitions;
export const PLATFORM_V7_TRIP_TRANSITIONS = tripTransitions;
export const PLATFORM_V7_DISPUTE_TRANSITIONS = disputeTransitions;
