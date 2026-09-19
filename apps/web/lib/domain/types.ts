export type SourceOfTruth = 'FGIS' | 'MANUAL' | 'DRAFT';

export type DomainDealStatus =
  | 'draft'
  | 'contract_signed'
  | 'payment_reserved'
  | 'loading_scheduled'
  | 'loading_started'
  | 'loading_done'
  | 'in_transit'
  | 'arrived'
  | 'unloading_started'
  | 'unloading_done'
  | 'quality_check'
  | 'quality_approved'
  | 'quality_disputed'
  | 'docs_complete'
  | 'release_requested'
  | 'release_approved'
  | 'closed';

export interface DomainCounterpartyRef {
  name: string;
  inn?: string;
}

export interface DomainDealEvent {
  ts: string;
  actor: string;
  action: string;
  type: 'success' | 'info' | 'danger' | 'warning';
}

export interface DomainRouteEvent {
  time: string;
  event: string;
  gps?: string;
  driver?: string;
}

export interface DomainDeal {
  id: string;
  version: number;
  sourceOfTruth: SourceOfTruth;
  createdAt: string;
  updatedAt: string;
  grain: string;
  quantity: number;
  unit: string;
  seller: DomainCounterpartyRef;
  buyer: DomainCounterpartyRef;
  status: DomainDealStatus;
  reservedAmount: number;
  holdAmount: number;
  riskScore: number;
  slaDeadline: string | null;
  blockers: string[];
  dispute?: { id: string };
  pricePerTon?: number;
  totalAmount?: number;
  releaseAmount?: number;
  route?: DomainRouteEvent[];
  events?: DomainDealEvent[];
  lotId?: string;
  routeId?: string;
  routeState?: string;
  routeEta?: string;
}

export interface DomainDispute {
  id: string;
  version: number;
  sourceOfTruth: SourceOfTruth;
  createdAt: string;
  updatedAt: string;
  dealId: string;
  type: string;
  title: string;
  reasonCode: string;
  holdAmount: number;
  slaDaysLeft: number;
  ballAt: 'seller' | 'buyer' | 'lab' | 'arbitrator';
  status: 'open' | 'resolved';
  evidence: { total: number; uploaded: number };
  description: string;
}

export interface DomainTotals {
  reserveTotal: number;
  heldTotal: number;
  readyToReleaseTotal: number;
}
