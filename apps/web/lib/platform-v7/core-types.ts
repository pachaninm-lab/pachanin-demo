export type EntityId = string;
export type IsoDateTime = string;
export type MoneyAmount = number;

export type PlatformRole =
  | 'seller'
  | 'buyer'
  | 'operator'
  | 'bank'
  | 'logistics'
  | 'carrier'
  | 'driver'
  | 'elevator'
  | 'lab'
  | 'investor';

export type MaturityStatus = 'simulation' | 'manual' | 'controlled-pilot' | 'live';
export type PriceBasis = 'EXW' | 'FCA' | 'CPT' | 'DAP' | 'other';
export type RiskLevel = 'low' | 'medium' | 'high' | 'blocked';

export interface AuditEvent {
  id: EntityId;
  entityType: string;
  entityId: EntityId;
  dealId?: EntityId;
  actorRole: PlatformRole;
  actorId: EntityId;
  action: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  createdAt: IsoDateTime;
}

export interface NextAction {
  id: EntityId;
  title: string;
  role: PlatformRole;
  targetRoute: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  disabled?: boolean;
  disabledReason?: string;
  createsAuditEvent: boolean;
  requiresReason: boolean;
}

export interface GrainBatch {
  id: EntityId;
  sellerId: EntityId;
  crop: string;
  cropClass?: string;
  volumeTons: number;
  availableVolumeTons: number;
  region: string;
  qualityReady: boolean;
  documentsReady: boolean;
  sdizReady: boolean;
  status: 'draft' | 'quality_pending' | 'documents_pending' | 'ready_for_lot' | 'published' | 'offered_to_buyer' | 'in_negotiation' | 'deal_created' | 'archived';
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface MarketLot {
  id: EntityId;
  batchId: EntityId;
  sellerId: EntityId;
  crop: string;
  cropClass?: string;
  volumeTons: number;
  region: string;
  basis: PriceBasis;
  pricePerTon: MoneyAmount;
  minPricePerTon?: MoneyAmount;
  visibility: 'verified_buyers' | 'region' | 'crop_class' | 'matching_rfq' | 'selected_buyers' | 'sealed' | 'operator';
  status: 'draft' | 'ready_to_publish' | 'in_market' | 'restricted_visibility' | 'offers_received' | 'in_negotiation' | 'offer_accepted' | 'deal_created' | 'expired' | 'withdrawn';
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface RFQ {
  id: EntityId;
  buyerId: EntityId;
  crop: string;
  cropClass?: string;
  volumeTons: number;
  region: string;
  basis: PriceBasis;
  maxPricePerTon?: MoneyAmount;
  requiresDocuments: boolean;
  requiresLogistics: boolean;
  status: 'draft' | 'published' | 'matching' | 'responses_received' | 'in_negotiation' | 'offer_accepted' | 'deal_created' | 'expired' | 'cancelled';
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type OfferStatus = 'sent' | 'viewed' | 'clarification_requested' | 'countered' | 'accepted' | 'rejected' | 'expired' | 'withdrawn';

export interface Offer {
  id: EntityId;
  lotId?: EntityId;
  rfqId?: EntityId;
  batchId?: EntityId;
  sellerId: EntityId;
  buyerId: EntityId;
  pricePerTon: MoneyAmount;
  volumeTons: number;
  basis: PriceBasis;
  logisticsOption: 'buyer_pickup' | 'seller_delivery' | 'platform_logistics' | 'external_carrier';
  paymentTerms: 'prepay' | 'after_loading' | 'after_acceptance' | 'after_documents' | 'deferred';
  documentRequirements: string[];
  qualityRequirements: string[];
  status: OfferStatus;
  version: number;
  expiresAt?: IsoDateTime;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface DealDraft {
  id: EntityId;
  acceptedOfferId: EntityId;
  sellerId: EntityId;
  buyerId: EntityId;
  batchId?: EntityId;
  lotId?: EntityId;
  rfqId?: EntityId;
  pricePerTon: MoneyAmount;
  volumeTons: number;
  moneyPlanReady: boolean;
  documentPlanReady: boolean;
  logisticsPlanReady: boolean;
  sdizStatus: 'not_required' | 'manual' | 'simulation' | 'ready' | 'blocked';
  complianceStop: boolean;
  bypassStop: boolean;
  status: 'created' | 'commercial_terms_confirmed' | 'money_plan_pending' | 'documents_plan_pending' | 'logistics_plan_pending' | 'ready_for_execution' | 'blocked' | 'converted_to_deal' | 'cancelled';
  blockers: string[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export function nowIso(): IsoDateTime {
  return new Date().toISOString();
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function riskLevelFromScore(score: number): RiskLevel {
  if (score < 40) return 'blocked';
  if (score < 60) return 'high';
  if (score < 75) return 'medium';
  return 'low';
}
