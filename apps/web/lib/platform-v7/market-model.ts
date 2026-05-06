import type { PlatformV7Basis, PlatformV7EntityId, PlatformV7IsoDateTime, PlatformV7RubAmount, PlatformV7Tons } from './execution-model';

export interface PlatformV7ReliabilityRating {
  partyId: PlatformV7EntityId;
  score: number;
  level: 'high' | 'medium' | 'low' | 'manual_review';
  completedDeals: number;
  disputesCount: number;
  documentIssuesCount: number;
  cancellationRate: number;
  reviewScore: number;
  explanation: string[];
  lastUpdatedAt: PlatformV7IsoDateTime;
}

export interface PlatformV7MarketLot {
  id: PlatformV7EntityId;
  batchId: PlatformV7EntityId;
  sellerId: PlatformV7EntityId;
  crop: string;
  class: string;
  tons: PlatformV7Tons;
  priceRubPerTon: PlatformV7RubAmount;
  netbackRubPerTon: PlatformV7RubAmount;
  basis: PlatformV7Basis;
  region: string;
  status: 'draft' | 'needs_readiness' | 'under_moderation' | 'published' | 'offer_received' | 'reserved' | 'deal_created' | 'closed';
  readinessScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  sellerRating: PlatformV7ReliabilityRating;
}

export interface PlatformV7BuyerRequest {
  id: PlatformV7EntityId;
  buyerId: PlatformV7EntityId;
  crop: string;
  class: string;
  requiredTons: PlatformV7Tons;
  region: string;
  deliveryBasis: PlatformV7Basis;
  maxPriceRubPerTon?: PlatformV7RubAmount;
  fgisRequired: boolean;
  sdizRequired: boolean;
  logisticsRequired: boolean;
  status: 'draft' | 'published' | 'matching' | 'proposal_sent' | 'deal_created' | 'closed';
  matchedLots: PlatformV7EntityId[];
  buyerRating: PlatformV7ReliabilityRating;
}

export function isPlatformV7LotVisibleForRequest(lot: PlatformV7MarketLot, request: PlatformV7BuyerRequest): boolean {
  if (!['published', 'offer_received'].includes(lot.status)) return false;
  if (lot.crop !== request.crop) return false;
  if (lot.class !== request.class) return false;
  if (lot.region !== request.region) return false;
  if (lot.tons < request.requiredTons) return false;
  if (lot.riskLevel === 'high') return false;
  if (lot.readinessScore < 70) return false;
  return true;
}

export function isPlatformV7LotPriceAllowed(lot: PlatformV7MarketLot, request: PlatformV7BuyerRequest): boolean {
  if (typeof request.maxPriceRubPerTon !== 'number') return true;
  return lot.priceRubPerTon <= request.maxPriceRubPerTon;
}

export function canPlatformV7CreateProposal(request: PlatformV7BuyerRequest, lot: PlatformV7MarketLot): boolean {
  return request.status === 'published' && isPlatformV7LotVisibleForRequest(lot, request) && isPlatformV7LotPriceAllowed(lot, request);
}

export function canPlatformV7LotCreateDeal(lot: PlatformV7MarketLot): boolean {
  return lot.status === 'reserved' && lot.readinessScore >= 80 && lot.riskLevel !== 'high';
}
