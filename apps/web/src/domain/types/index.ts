export type EntityId = string;
export type ISODateTime = string;
export type MoneyCents = number;
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type PlatformMode = 'sandbox' | 'demo' | 'pilot' | 'manual' | 'live';

export type DealStatus =
  | 'draft'
  | 'lot_published'
  | 'offer_received'
  | 'offer_accepted'
  | 'contract_pending'
  | 'contract_signed'
  | 'reserve_requested'
  | 'reserve_confirmed'
  | 'driver_assigned'
  | 'loading_scheduled'
  | 'loading_confirmed'
  | 'in_transit'
  | 'arrived'
  | 'weighing_completed'
  | 'lab_sampled'
  | 'lab_protocol_created'
  | 'documents_pending'
  | 'documents_complete'
  | 'dispute_open'
  | 'dispute_resolved'
  | 'partial_release'
  | 'final_released'
  | 'closed';

export interface Counterparty {
  id: EntityId;
  name: string;
  inn: string;
  role: 'seller' | 'buyer' | 'carrier' | 'elevator' | 'lab' | 'bank' | 'surveyor';
  riskLevel: RiskLevel;
  verifiedAt?: ISODateTime;
}

export interface User {
  id: EntityId;
  name: string;
  role:
    | 'operator'
    | 'buyer'
    | 'seller'
    | 'logistics'
    | 'driver'
    | 'surveyor'
    | 'elevator'
    | 'lab'
    | 'bank'
    | 'arbitrator'
    | 'compliance'
    | 'executive';
  counterpartyId?: EntityId;
  authorityLevel: 'read' | 'act' | 'critical';
}

export interface Lot {
  id: EntityId;
  crop: string;
  className: string;
  volumeTons: number;
  pricePerTon: number;
  sellerId: EntityId;
  basis: string;
  status: 'draft' | 'published' | 'matched' | 'withdrawn';
  linkedDealId?: EntityId;
}

export interface Deal {
  id: EntityId;
  lotId?: EntityId;
  sellerId: EntityId;
  buyerId: EntityId;
  status: DealStatus;
  volumeTons: number;
  pricePerTon: number;
  totalAmountCents: MoneyCents;
  reserveConfirmed: boolean;
  documentsComplete: boolean;
  weightConfirmed: boolean;
  labProtocolId?: EntityId;
  openDisputeId?: EntityId;
  degradationMode?: boolean;
  updatedAt: ISODateTime;
}

export interface MoneyEvent {
  id: EntityId;
  dealId: EntityId;
  type: 'reserve_requested' | 'reserve_confirmed' | 'hold' | 'partial_release' | 'final_release' | 'refund' | 'reconciliation_gap';
  amountCents: MoneyCents;
  idempotencyKey: string;
  bankReference?: string;
  createdAt: ISODateTime;
}

export interface TransportPack {
  id: EntityId;
  dealId: EntityId;
  routeId: EntityId;
  driverUserId?: EntityId;
  vehicleNumber?: string;
  status: 'planned' | 'assigned' | 'loading' | 'in_transit' | 'arrived' | 'closed';
  eta?: ISODateTime;
}

export interface Document {
  id: EntityId;
  dealId: EntityId;
  type: 'contract' | 'upd' | 'ttn' | 'sdiz' | 'lab_protocol' | 'acceptance_act' | 'survey_act' | 'bank_statement';
  status: 'draft' | 'uploaded' | 'signed' | 'rejected' | 'external_required';
  version: number;
  hash?: string;
  signedAt?: ISODateTime;
}

export interface Inspection {
  id: EntityId;
  dealId: EntityId;
  inspectorUserId: EntityId;
  type: 'loading' | 'receiving' | 'surveyor';
  checklistCompleted: boolean;
  geoPoint?: string;
  createdAt: ISODateTime;
}

export interface LabProtocol {
  id: EntityId;
  dealId: EntityId;
  labId: EntityId;
  moisturePct: number;
  glutenPct?: number;
  proteinPct?: number;
  status: 'draft' | 'issued' | 'disputed' | 'replaced';
  issuedAt?: ISODateTime;
}

export interface Evidence {
  id: EntityId;
  dealId: EntityId;
  disputeId?: EntityId;
  type: 'photo' | 'video' | 'document' | 'geo' | 'weight' | 'lab' | 'bank' | 'audit' | 'message' | 'signature' | 'gps' | 'survey' | 'system';
  hash: string;
  source: string;
  capturedAt: ISODateTime;
}

export interface Dispute {
  id: EntityId;
  dealId: EntityId;
  reasonCode: 'quality_delta' | 'weight_delta' | 'late_delivery' | 'missing_document' | 'payment_hold' | 'route_deviation';
  status: 'open' | 'collecting_evidence' | 'decision_pending' | 'resolved' | 'rejected';
  amountImpactCents: MoneyCents;
  ballAt: 'seller' | 'buyer' | 'lab' | 'surveyor' | 'bank' | 'arbitrator' | 'operator';
  evidenceTotal: number;
  evidenceUploaded: number;
}

export interface AuditEvent {
  id: EntityId;
  actorUserId: EntityId;
  action: string;
  objectType: 'deal' | 'lot' | 'dispute' | 'money' | 'document' | 'transport' | 'evidence' | 'user';
  objectId: EntityId;
  before?: unknown;
  after?: unknown;
  idempotencyKey?: string;
  createdAt: ISODateTime;
}
