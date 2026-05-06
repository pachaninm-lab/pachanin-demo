import type { PlatformV7EntityId, PlatformV7IsoDateTime, PlatformV7RubAmount, PlatformV7Tons } from './execution-model';

export type PlatformV7ProposalType = 'lot_bid' | 'request_response' | 'buy_now' | 'counter_proposal' | 'auction_bid';

export type PlatformV7ProposalStatus =
  | 'submitted'
  | 'under_review'
  | 'leading'
  | 'outbid'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'withdrawn'
  | 'deal_created';

export interface PlatformV7Proposal {
  id: PlatformV7EntityId;
  type: PlatformV7ProposalType;
  lotId?: PlatformV7EntityId;
  requestId?: PlatformV7EntityId;
  sellerId: PlatformV7EntityId;
  buyerId: PlatformV7EntityId;
  priceRubPerTon: PlatformV7RubAmount;
  totalAmountRub: PlatformV7RubAmount;
  status: PlatformV7ProposalStatus;
  expiresAt?: PlatformV7IsoDateTime;
  auditEventIds: PlatformV7EntityId[];
}

const DEAL_CREATING_STATUSES: readonly PlatformV7ProposalStatus[] = ['accepted'];
const CLOSED_STATUSES: readonly PlatformV7ProposalStatus[] = ['rejected', 'expired', 'withdrawn', 'deal_created'];

export function isPlatformV7ProposalAmountConsistent(proposal: PlatformV7Proposal, tons: PlatformV7Tons): boolean {
  return proposal.totalAmountRub === proposal.priceRubPerTon * tons;
}

export function isPlatformV7ProposalExpired(proposal: PlatformV7Proposal, nowIso: PlatformV7IsoDateTime): boolean {
  if (!proposal.expiresAt) return false;
  return new Date(proposal.expiresAt).getTime() <= new Date(nowIso).getTime();
}

export function canPlatformV7ProposalBeReviewed(proposal: PlatformV7Proposal, nowIso: PlatformV7IsoDateTime): boolean {
  return !CLOSED_STATUSES.includes(proposal.status) && !isPlatformV7ProposalExpired(proposal, nowIso);
}

export function canPlatformV7CreateDealFromProposal(proposal: PlatformV7Proposal, nowIso: PlatformV7IsoDateTime): boolean {
  return DEAL_CREATING_STATUSES.includes(proposal.status) && !isPlatformV7ProposalExpired(proposal, nowIso) && proposal.auditEventIds.length > 0;
}
