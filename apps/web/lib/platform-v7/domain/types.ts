import type { CanonicalDealStatus, MaturityStatus, PlatformLayer } from './canonical';

export type EntityId = string;
export type IsoDateTime = string;
export type MoneyAmount = number;
export type Percent = number;

export type OrganizationType = 'legal_entity' | 'individual_entrepreneur' | 'farm' | 'self_employed' | 'individual';

export type ParticipantRole =
  | 'seller'
  | 'buyer'
  | 'operator'
  | 'driver'
  | 'carrier'
  | 'logistics'
  | 'elevator'
  | 'lab'
  | 'surveyor'
  | 'bank'
  | 'compliance'
  | 'arbitrator'
  | 'admin'
  | 'investor_readonly'
  | 'region_readonly'
  | 'external_auditor_readonly';

export interface CounterpartyRef {
  readonly id: EntityId;
  readonly name: string;
  readonly role: ParticipantRole;
  readonly inn?: string;
  readonly ogrn?: string;
  readonly kpp?: string;
  readonly organizationType?: OrganizationType;
  readonly riskScore?: number;
}

export interface VehicleRef {
  readonly id?: EntityId;
  readonly plate: string;
  readonly trailerPlate?: string;
}

export interface DriverRef {
  readonly id: EntityId;
  readonly name: string;
  readonly vehicle?: string | VehicleRef;
}

export interface ElevatorRef {
  readonly id: EntityId;
  readonly name: string;
  readonly region: string;
}

export type GrainUnit = 'т' | 'кг';

export interface MoneyState {
  readonly totalAmount: MoneyAmount;
  readonly reservedAmount: MoneyAmount;
  readonly holdAmount: MoneyAmount;
  readonly releaseAmount: MoneyAmount;
  readonly refundAmount?: MoneyAmount;
  readonly commissionAmount?: MoneyAmount;
}

export interface DisputeRef {
  readonly id: EntityId;
  readonly title: string;
  readonly amountAtRisk?: MoneyAmount;
}

export type DocumentStatus =
  | 'draft'
  | 'uploaded'
  | 'verified'
  | 'missing'
  | 'pending_signature'
  | 'signed'
  | 'rejected'
  | 'replaced'
  | 'archived';

export interface DocumentRef {
  readonly id: EntityId;
  readonly name: string;
  readonly status: DocumentStatus;
  readonly uploadedAt: IsoDateTime | null;
  readonly size: string | null;
  readonly owner: string;
  readonly hash?: string;
  readonly required?: boolean;
  readonly blocksMoneyRelease?: boolean;
}

export interface DealTimelineEvent {
  readonly status: string;
  readonly at: IsoDateTime;
  readonly actor: string;
  readonly canonicalStatus?: CanonicalDealStatus;
}

export interface CanonicalDeal {
  readonly id: EntityId;
  readonly status: CanonicalDealStatus;
  readonly legacyStatus?: string;
  readonly phase?: string;
  readonly grain: string;
  readonly quantity: number;
  readonly unit: GrainUnit;
  readonly pricePerUnit: MoneyAmount;
  readonly money: MoneyState;
  readonly seller: CounterpartyRef;
  readonly buyer: CounterpartyRef;
  readonly driver?: DriverRef | null;
  readonly elevator?: ElevatorRef | null;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly slaDeadline?: IsoDateTime | null;
  readonly dispute?: DisputeRef | null;
  readonly riskScore: number;
  readonly blockers: readonly string[];
  readonly timeline: readonly DealTimelineEvent[];
  readonly documents: readonly DocumentRef[];
  readonly maturity?: MaturityStatus;
}

export interface CanonicalLot {
  readonly id: EntityId;
  readonly seller: CounterpartyRef;
  readonly grain: string;
  readonly quantity: number;
  readonly unit: GrainUnit;
  readonly region: string;
  readonly basis?: string;
  readonly pricePerUnit?: MoneyAmount;
  readonly minPricePerUnit?: MoneyAmount;
  readonly qualityClass?: string;
  readonly fgisReady?: boolean;
  readonly sdizReady?: boolean;
  readonly documentsReady?: boolean;
  readonly riskScore?: number;
  readonly status: 'draft' | 'published' | 'auction' | 'offer_review' | 'reserved' | 'sold' | 'canceled';
}

export interface CanonicalRfq {
  readonly id: EntityId;
  readonly buyer: CounterpartyRef;
  readonly grain: string;
  readonly quantity: number;
  readonly unit: GrainUnit;
  readonly region?: string;
  readonly targetPricePerUnit?: MoneyAmount;
  readonly deadlineAt: IsoDateTime;
  readonly status: 'draft' | 'published' | 'offer_review' | 'winner_selected' | 'converted_to_deal' | 'canceled';
}

export interface CanonicalOffer {
  readonly id: EntityId;
  readonly rfqId?: EntityId;
  readonly lotId?: EntityId;
  readonly seller: CounterpartyRef;
  readonly buyer: CounterpartyRef;
  readonly pricePerUnit: MoneyAmount;
  readonly quantity: number;
  readonly unit: GrainUnit;
  readonly status: 'draft' | 'submitted' | 'accepted' | 'rejected' | 'expired' | 'converted_to_deal';
}

export interface PlatformModuleDefinition {
  readonly id: string;
  readonly title: string;
  readonly layer: PlatformLayer;
  readonly maturity: MaturityStatus;
  readonly blocksMoneyRelease: boolean;
  readonly ownerRole: ParticipantRole;
  readonly riskIfBroken: string;
}
