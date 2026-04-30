export const SIMULATION_RUNTIME_LABELS = ['sandbox', 'demo', 'pilot', 'manual'] as const;
export type SimulationRuntimeLabel = (typeof SIMULATION_RUNTIME_LABELS)[number];

export const DEAL_EXECUTION_STATUSES = [
  'DRAFT',
  'OFFER_ACCEPTED',
  'DEAL_CREATED',
  'CONTRACT_DRAFTED',
  'AWAITING_SIGNATURES',
  'SIGNED',
  'RESERVE_REQUESTED',
  'RESERVE_CONFIRMED',
  'DRIVER_ASSIGNED',
  'LOADING_CONFIRMED',
  'LOADED',
  'IN_TRANSIT',
  'ARRIVED',
  'WEIGHING_CONFIRMED',
  'LAB_SAMPLING',
  'LAB_PROTOCOL_CREATED',
  'ACCEPTED',
  'DOCUMENTS_PENDING',
  'DOCUMENTS_READY',
  'DISPUTE_OPEN',
  'PAYMENT_RELEASE_REQUESTED',
  'FINAL_RELEASED',
  'CLOSED'
] as const;
export type DealExecutionStatus = (typeof DEAL_EXECUTION_STATUSES)[number];

export type PlatformRole =
  | 'seller'
  | 'buyer'
  | 'operator'
  | 'bank'
  | 'logistics'
  | 'driver'
  | 'elevator'
  | 'lab'
  | 'surveyor'
  | 'arbitrator'
  | 'compliance'
  | 'admin';

export type PlatformActionType =
  | 'createLot'
  | 'publishLot'
  | 'acceptOffer'
  | 'createDeal'
  | 'requestReserve'
  | 'confirmReserve'
  | 'assignDriver'
  | 'confirmArrival'
  | 'createLabProtocol'
  | 'openDispute';

export type CurrencyCode = 'RUB';

export interface User {
  id: string;
  name: string;
  role: PlatformRole;
  counterpartyId?: string;
  authorityLevel: 'viewer' | 'operator' | 'signer' | 'bank_controller' | 'admin';
  twoFactorEnabled: boolean;
  runtimeLabel: SimulationRuntimeLabel;
}

export interface Counterparty {
  id: string;
  name: string;
  type: 'seller' | 'buyer' | 'bank' | 'carrier' | 'elevator' | 'lab' | 'surveyor';
  inn: string;
  kpp?: string;
  status: 'draft' | 'kyb_pending' | 'approved' | 'blocked';
  riskScore: number;
  runtimeLabel: SimulationRuntimeLabel;
}

export interface Lot {
  id: string;
  sellerId: string;
  crop: 'wheat' | 'barley' | 'corn' | 'sunflower';
  volumeTonnes: number;
  pricePerTonneRub: number;
  basis: string;
  qualityClass: string;
  status: 'draft' | 'published' | 'offer_accepted' | 'deal_created' | 'cancelled';
  createdAt: string;
  runtimeLabel: SimulationRuntimeLabel;
}

export interface Deal {
  id: string;
  lotId: string;
  sellerId: string;
  buyerId: string;
  status: DealExecutionStatus;
  volumeTonnes: number;
  pricePerTonneRub: number;
  currency: CurrencyCode;
  reserveConfirmed: boolean;
  requiredDocumentsReady: boolean;
  weightConfirmed: boolean;
  labProtocolId?: string;
  openDisputeId?: string;
  driverId?: string;
  routeId?: string;
  isDegraded: boolean;
  ownerRole: PlatformRole;
  blocker?: string;
  slaDueAt?: string;
  runtimeLabel: SimulationRuntimeLabel;
  updatedAt: string;
}

export interface MoneyEvent {
  id: string;
  dealId: string;
  type: 'reserve_requested' | 'reserve_confirmed' | 'hold' | 'release_requested' | 'partial_release' | 'final_release' | 'refund' | 'reconciliation_mismatch';
  amountRub: number;
  status: 'draft' | 'pending' | 'confirmed' | 'failed' | 'blocked';
  idempotencyKey?: string;
  bankEventId?: string;
  createdAt: string;
  runtimeLabel: SimulationRuntimeLabel;
}

export interface TransportPack {
  id: string;
  dealId: string;
  carrierId: string;
  driverId?: string;
  vehicleNumber?: string;
  routeId: string;
  status: 'planned' | 'assigned' | 'loading' | 'in_transit' | 'arrived' | 'closed';
  etaAt?: string;
  runtimeLabel: SimulationRuntimeLabel;
}

export interface Document {
  id: string;
  dealId: string;
  type: 'contract' | 'ttn' | 'transport_waybill' | 'upd' | 'sdiz' | 'lab_protocol' | 'weighing_act' | 'release_instruction';
  status: 'missing' | 'draft' | 'generated' | 'signed' | 'rejected' | 'archived';
  version: number;
  hash?: string;
  signerIds: string[];
  createdAt: string;
  runtimeLabel: SimulationRuntimeLabel;
}

export interface Inspection {
  id: string;
  dealId: string;
  inspectorId: string;
  status: 'planned' | 'completed' | 'rejected';
  findings: string[];
  evidenceIds: string[];
  createdAt: string;
  runtimeLabel: SimulationRuntimeLabel;
}

export interface LabProtocol {
  id: string;
  dealId: string;
  labId: string;
  humidityPct: number;
  glutenPct: number;
  proteinPct: number;
  natureGramPerLiter: number;
  status: 'draft' | 'issued' | 'disputed' | 'void';
  createdAt: string;
  runtimeLabel: SimulationRuntimeLabel;
}

export interface Evidence {
  id: string;
  dealId: string;
  type: 'photo' | 'video' | 'gps' | 'weight' | 'lab' | 'document' | 'comment' | 'bank_event' | 'signature' | 'seal' | 'arrival' | 'inspection' | 'system_log';
  title: string;
  hash: string;
  capturedAt: string;
  actorId: string;
  geo?: { lat: number; lon: number };
  runtimeLabel: SimulationRuntimeLabel;
}

export interface Dispute {
  id: string;
  dealId: string;
  openedBy: string;
  reason: 'quality_delta' | 'weight_delta' | 'late_arrival' | 'missing_document' | 'payment_hold' | 'route_deviation' | 'other';
  amountImpactRub: number;
  status: 'open' | 'under_review' | 'evidence_requested' | 'decision_ready' | 'resolved' | 'closed';
  evidenceIds: string[];
  createdAt: string;
  runtimeLabel: SimulationRuntimeLabel;
}

export interface AuditEvent {
  id: string;
  actionType: PlatformActionType | 'stateTransition' | 'guardBlocked';
  entityType: 'lot' | 'deal' | 'money' | 'transport' | 'document' | 'lab' | 'dispute' | 'evidence';
  entityId: string;
  actorId: string;
  actorRole: PlatformRole;
  before?: string;
  after?: string;
  reason?: string;
  idempotencyKey?: string;
  createdAt: string;
  runtimeLabel: SimulationRuntimeLabel;
}

export interface DealTimelineEvent {
  id: string;
  dealId: string;
  title: string;
  actionType: PlatformActionType | 'stateTransition' | 'guardBlocked';
  actorId: string;
  actorRole: PlatformRole;
  createdAt: string;
  runtimeLabel: SimulationRuntimeLabel;
}

export interface DomainExecutionState {
  lots: Lot[];
  deals: Deal[];
  disputes: Dispute[];
  counterparties: Counterparty[];
  users: User[];
  moneyEvents: MoneyEvent[];
  transportPacks: TransportPack[];
  documents: Document[];
  inspections: Inspection[];
  labProtocols: LabProtocol[];
  evidence: Evidence[];
  auditEvents: AuditEvent[];
  dealTimeline: DealTimelineEvent[];
}

export interface PlatformActionCommand<TPayload = Record<string, unknown>> {
  type: PlatformActionType;
  actor: User;
  payload: TPayload;
  idempotencyKey?: string;
  runtimeLabel?: SimulationRuntimeLabel;
  now?: string;
}

export interface PlatformActionResult {
  ok: boolean;
  state: DomainExecutionState;
  toast: { type: 'loading' | 'success' | 'error' | 'disabled'; message: string };
  auditEvent?: AuditEvent;
  timelineEvent?: DealTimelineEvent;
  disabledReason?: string;
  error?: string;
}
