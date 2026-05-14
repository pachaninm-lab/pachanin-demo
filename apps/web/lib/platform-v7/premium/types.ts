export type DealRole = 'seller' | 'buyer' | 'logistics' | 'driver' | 'elevator' | 'lab' | 'surveyor' | 'bank' | 'arbiter' | 'compliance' | 'operator' | 'executive';
export type DealTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'dispute';
export type DealStepStatus = 'done' | 'active' | 'pending' | 'blocked' | 'review';
export type DealDocumentStatus = 'ready' | 'pending' | 'blocked' | 'review';

export interface MoneyState {
  totalRub: number;
  reservedRub: number;
  readyToReleaseRub: number;
  heldRub: number;
  awaitingDocsRub: number;
  disputedRub: number;
  releasedRub: number;
}

export interface BlockingReasonModel {
  id: string;
  title: string;
  reason: string;
  impact: string;
  responsible: string;
  nextAction: string;
  tone?: DealTone;
}

export interface NextActionModel {
  label: string;
  reason?: string;
  disabledReason?: string;
  responsible?: string;
}

export interface ExecutionStepModel {
  id: string;
  label: string;
  status: DealStepStatus;
  responsible: string;
  blocks?: string;
  moneyImpactRub?: number;
  nextAction?: string;
}

export interface DealDocumentModel {
  id: string;
  title: string;
  status: DealDocumentStatus;
  responsible: string;
  blocks: string;
  source: string;
  actionLabel?: string;
  reason?: string;
}

export interface EvidenceModel {
  id: string;
  title: string;
  type: string;
  source: string;
  time: string;
  role: string;
  relatedTrip?: string;
  relatedDocument?: string;
  moneyImpactRub?: number;
  status: DealStepStatus;
}

export interface TimelineEventModel {
  id: string;
  time: string;
  title: string;
  actor?: string;
  impact?: string;
}

export interface RiskItemModel {
  id: string;
  label: string;
  detail: string;
  tone: DealTone;
}

export interface DriverTaskModel {
  id: string;
  tripId: string;
  routeLabel: string;
  nextAction: string;
  secondaryActions: Array<{ id: string; label: string }>;
  offlineQueueCount: number;
  etaLabel?: string;
}

export interface DealViewModel {
  id: string;
  title: string;
  stageLabel: string;
  currentState: string;
  basisLabel: string;
  money: MoneyState;
  documents: DealDocumentModel[];
  execution: ExecutionStepModel[];
  evidence: EvidenceModel[];
  timeline: TimelineEventModel[];
  risks: RiskItemModel[];
  blockers: BlockingReasonModel[];
  nextAction: NextActionModel;
  driverTask?: DriverTaskModel;
}
