import type {
  AuditEvent,
  Dispute,
  DocumentRequirement,
  EvidencePack,
  GrainBatch,
  LogisticsIncident,
  LogisticsOrder,
  MarketLot,
  MoneyProjection,
  Offer,
  RFQ,
  RoleExecutionSummary,
  SupportCase,
} from './grain-execution/types';

export type PlatformV7ServiceMode = 'test' | 'controlled_pilot' | 'real_requires_connection';

export type PlatformV7WriteResult<T> = {
  readonly ok: boolean;
  readonly mode: PlatformV7ServiceMode;
  readonly data?: T;
  readonly auditEventId?: string;
  readonly idempotencyKey?: string;
  readonly reason?: string;
};

export function hasPlatformV7WriteAuditTrace(result: PlatformV7WriteResult<unknown>): boolean {
  return Boolean(result.auditEventId?.trim());
}

export function hasPlatformV7WriteIdempotencyTrace(result: PlatformV7WriteResult<unknown>): boolean {
  return Boolean(result.idempotencyKey?.trim());
}

export function isPlatformV7WriteResultTraceable(result: PlatformV7WriteResult<unknown>): boolean {
  return result.ok && result.mode !== 'test' && hasPlatformV7WriteAuditTrace(result) && hasPlatformV7WriteIdempotencyTrace(result);
}

export interface PlatformV7BatchService {
  listSellerBatches(sellerId: string): Promise<readonly GrainBatch[]>;
  createBatch(input: Partial<GrainBatch>): Promise<PlatformV7WriteResult<GrainBatch>>;
  getBatchReadiness(batchId: string): Promise<RoleExecutionSummary>;
}

export interface PlatformV7LotService {
  listLots(): Promise<readonly MarketLot[]>;
  publishLot(batchId: string): Promise<PlatformV7WriteResult<MarketLot>>;
  blockLot(lotId: string, reason: string): Promise<PlatformV7WriteResult<MarketLot>>;
}

export interface PlatformV7RfqService {
  listBuyerRequests(buyerId: string): Promise<readonly RFQ[]>;
  createRequest(input: Partial<RFQ>): Promise<PlatformV7WriteResult<RFQ>>;
  matchLots(rfqId: string): Promise<readonly MarketLot[]>;
}

export interface PlatformV7ProposalService {
  listForLot(lotId: string): Promise<readonly Offer[]>;
  submitOffer(input: Partial<Offer>): Promise<PlatformV7WriteResult<Offer>>;
  acceptOffer(offerId: string): Promise<PlatformV7WriteResult<Offer>>;
}

export interface PlatformV7DealService {
  getDealSummary(dealId: string): Promise<RoleExecutionSummary>;
  getEvidencePack(dealId: string): Promise<EvidencePack>;
  appendDealAudit(dealId: string, event: Partial<AuditEvent>): Promise<PlatformV7WriteResult<AuditEvent>>;
}

export interface PlatformV7MoneyService {
  getProjection(dealId: string): Promise<MoneyProjection>;
  requestReserve(dealId: string, amountRub: number): Promise<PlatformV7WriteResult<MoneyProjection>>;
  requestBankCheck(dealId: string, reason: string): Promise<PlatformV7WriteResult<MoneyProjection>>;
}

export interface PlatformV7DocumentService {
  listRequirements(dealId: string): Promise<readonly DocumentRequirement[]>;
  attachDocument(requirementId: string, fileId: string): Promise<PlatformV7WriteResult<DocumentRequirement>>;
  markExternalStatus(requirementId: string, status: string): Promise<PlatformV7WriteResult<DocumentRequirement>>;
}

export interface PlatformV7LogisticsService {
  listOrders(): Promise<readonly LogisticsOrder[]>;
  assignDriver(orderId: string, driverId: string): Promise<PlatformV7WriteResult<LogisticsOrder>>;
  reportIncident(orderId: string, incident: Partial<LogisticsIncident>): Promise<PlatformV7WriteResult<LogisticsIncident>>;
}

export interface PlatformV7DisputeService {
  listDisputes(): Promise<readonly Dispute[]>;
  openDispute(dealId: string, reason: Dispute['reason']): Promise<PlatformV7WriteResult<Dispute>>;
  requestEvidence(disputeId: string, reason: string): Promise<PlatformV7WriteResult<Dispute>>;
}

export interface PlatformV7SupportService {
  listCases(entityId: string): Promise<readonly SupportCase[]>;
  createCase(input: Partial<SupportCase>): Promise<PlatformV7WriteResult<SupportCase>>;
  escalateCase(caseId: string, reason: string): Promise<PlatformV7WriteResult<SupportCase>>;
}

export interface PlatformV7RatingService {
  getPartyRisk(partyId: string): Promise<{ readonly score: number; readonly reasons: readonly string[] }>;
  recordPostDealSignal(dealId: string, partyId: string, signal: string): Promise<PlatformV7WriteResult<{ readonly partyId: string }>>;
}

export interface PlatformV7AuditService {
  listEntityEvents(entityType: string, entityId: string): Promise<readonly AuditEvent[]>;
  appendEvent(event: Partial<AuditEvent>): Promise<PlatformV7WriteResult<AuditEvent>>;
}

export interface PlatformV7NotificationService {
  notifyRole(role: string, message: string, entityId: string): Promise<PlatformV7WriteResult<{ readonly queued: boolean }>>;
}

export interface PlatformV7IntegrationGateway {
  getConnectorStatus(connector: string): Promise<{ readonly mode: PlatformV7ServiceMode; readonly status: string; readonly lastExternalId?: string }>;
  sendExternalRequest(connector: string, payload: unknown): Promise<PlatformV7WriteResult<{ readonly externalReference?: string }>>;
  receiveExternalEvent(connector: string, payload: unknown): Promise<PlatformV7WriteResult<AuditEvent>>;
}

export interface PlatformV7ServiceRegistry {
  readonly batch: PlatformV7BatchService;
  readonly lot: PlatformV7LotService;
  readonly rfq: PlatformV7RfqService;
  readonly proposal: PlatformV7ProposalService;
  readonly deal: PlatformV7DealService;
  readonly money: PlatformV7MoneyService;
  readonly document: PlatformV7DocumentService;
  readonly logistics: PlatformV7LogisticsService;
  readonly dispute: PlatformV7DisputeService;
  readonly support: PlatformV7SupportService;
  readonly rating: PlatformV7RatingService;
  readonly audit: PlatformV7AuditService;
  readonly notification: PlatformV7NotificationService;
  readonly integrations: PlatformV7IntegrationGateway;
}

export const PLATFORM_V7_REQUIRED_SERVICE_NAMES = [
  'batch',
  'lot',
  'rfq',
  'proposal',
  'deal',
  'money',
  'document',
  'logistics',
  'dispute',
  'support',
  'rating',
  'audit',
  'notification',
  'integrations',
] as const;
