export type EntityId = string;
export type IsoDateTime = string;

export type MaturityStatus = 'sandbox' | 'manual' | 'controlled-pilot' | 'live';
export type CurrencyCode = 'RUB' | 'USD' | 'EUR';

export interface MoneyAmount {
  readonly value: number;
  readonly currency: CurrencyCode;
}

export type PriceBasis = 'EXW' | 'FCA' | 'CPT' | 'DAP' | 'FOB';

export type UserRole =
  | 'seller'
  | 'buyer'
  | 'logistics'
  | 'driver'
  | 'elevator'
  | 'lab'
  | 'bank'
  | 'operator'
  | 'investor'
  | 'admin';

export type GrainBatchStatus =
  | 'draft'
  | 'needs_fgis'
  | 'fgis_linked'
  | 'quality_needed'
  | 'documents_needed'
  | 'ready_for_sale'
  | 'partially_reserved'
  | 'reserved'
  | 'in_execution'
  | 'sold'
  | 'blocked'
  | 'cancelled';

export interface GrainBatch {
  readonly id: EntityId;
  readonly ownerId: EntityId;
  readonly ownerName: string;
  readonly ownerInn?: string;
  readonly ownerRole: 'seller';
  readonly crop: string;
  readonly gostClass?: string;
  readonly harvestYear: number;
  readonly totalVolumeTons: number;
  readonly availableVolumeTons: number;
  readonly reservedVolumeTons: number;
  readonly soldVolumeTons: number;
  readonly storageType: 'farm_storage' | 'elevator' | 'field' | 'silo_bag' | 'warehouse' | 'other';
  readonly storageLocationName: string;
  readonly region: string;
  readonly address?: string;
  readonly elevatorId?: EntityId;
  readonly fgisPartyId?: EntityId;
  readonly fgisBatchId?: string;
  readonly sdizNumber?: string;
  readonly fgisStatus: 'not_linked' | 'draft' | 'linked' | 'sync_error' | 'manual_mode' | 'blocked';
  readonly qualityProfileId?: EntityId;
  readonly documentReadinessId?: EntityId;
  readonly readinessScore: number;
  readonly blockers: ReadinessBlocker[];
  readonly maturity: MaturityStatus;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface ReadinessBlocker {
  readonly id: EntityId;
  readonly type: 'fgis' | 'sdiz' | 'quality' | 'document' | 'volume' | 'storage' | 'legal' | 'logistics' | 'manual';
  readonly severity: 'info' | 'warning' | 'critical';
  readonly title: string;
  readonly description: string;
  readonly responsibleRole: UserRole;
  readonly moneyImpact?: MoneyAmount;
}

export interface BatchReadiness {
  readonly batchId: EntityId;
  readonly score: number;
  readonly status: 'not_ready' | 'almost_ready' | 'ready_for_sale' | 'blocked';
  readonly blockers: ReadinessBlocker[];
  readonly nextActions: NextAction[];
}

export interface LotPassport {
  readonly id: EntityId;
  readonly batchId: EntityId;
  readonly crop: string;
  readonly gostClass?: string;
  readonly volumeTons: number;
  readonly basis: PriceBasis;
  readonly storageLocationName: string;
  readonly qualityProfileId?: EntityId;
  readonly documentRequirementIds: EntityId[];
  readonly sdizGateIds: EntityId[];
  readonly status: 'draft' | 'needs_readiness' | 'ready_for_market' | 'blocked';
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export type MarketLotStatus =
  | 'draft'
  | 'needs_readiness'
  | 'under_moderation'
  | 'active'
  | 'offer_received'
  | 'reserved'
  | 'deal_created'
  | 'sold'
  | 'expired'
  | 'cancelled'
  | 'blocked';

export interface MarketLot {
  readonly id: EntityId;
  readonly batchId: EntityId;
  readonly passportId: EntityId;
  readonly sellerId: EntityId;
  readonly crop: string;
  readonly gostClass?: string;
  readonly volumeTons: number;
  readonly basis: PriceBasis;
  readonly pricePerTon?: MoneyAmount;
  readonly minimumPricePerTon?: MoneyAmount;
  readonly shipmentWindowFrom?: IsoDateTime;
  readonly shipmentWindowTo?: IsoDateTime;
  readonly status: MarketLotStatus;
  readonly readiness: BatchReadiness;
  readonly netbackCalculationIds: EntityId[];
  readonly maturity: MaturityStatus;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface RFQQualityRequirement {
  readonly minMoisture?: number;
  readonly maxMoisture?: number;
  readonly minProtein?: number;
  readonly minGluten?: number;
  readonly minNatWeight?: number;
  readonly maxWeedImpurity?: number;
  readonly maxGrainImpurity?: number;
  readonly comment?: string;
}

export type PaymentTerms =
  | 'prepay'
  | 'after_loading'
  | 'after_acceptance'
  | 'after_documents'
  | 'deferred'
  | 'custom';

export interface RFQ {
  readonly id: EntityId;
  readonly buyerId: EntityId;
  readonly buyerName: string;
  readonly buyerInn?: string;
  readonly crop: string;
  readonly gostClass?: string;
  readonly volumeTons: number;
  readonly minVolumeTons?: number;
  readonly targetPricePerTon?: MoneyAmount;
  readonly maxPricePerTon?: MoneyAmount;
  readonly basis: PriceBasis;
  readonly deliveryLocationName: string;
  readonly deliveryRegion: string;
  readonly deliveryAddress?: string;
  readonly deliveryDateFrom?: IsoDateTime;
  readonly deliveryDateTo?: IsoDateTime;
  readonly qualityRequirements: RFQQualityRequirement;
  readonly paymentTerms: Exclude<PaymentTerms, 'custom'>;
  readonly paymentDelayDays?: number;
  readonly requiresLogistics: boolean;
  readonly requiresIndependentLab: boolean;
  readonly requiresBankReserve: boolean;
  readonly documentRequirements: string[];
  readonly status:
    | 'draft'
    | 'open'
    | 'matching'
    | 'offers_received'
    | 'offer_accepted'
    | 'deal_created'
    | 'expired'
    | 'cancelled';
  readonly maturity: MaturityStatus;
  readonly createdAt: IsoDateTime;
  readonly expiresAt?: IsoDateTime;
}

export type OfferStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'leading'
  | 'outbid'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'withdrawn'
  | 'deal_created';

export interface Offer {
  readonly id: EntityId;
  readonly type: 'lot_bid' | 'rfq_response' | 'buy_now' | 'counter_offer' | 'auction_bid';
  readonly marketLotId?: EntityId;
  readonly rfqId?: EntityId;
  readonly batchId?: EntityId;
  readonly sellerId: EntityId;
  readonly buyerId?: EntityId;
  readonly crop: string;
  readonly volumeTons: number;
  readonly pricePerTon: MoneyAmount;
  readonly basis: PriceBasis;
  readonly paymentTerms: PaymentTerms;
  readonly logisticsOption: 'buyer_pickup' | 'seller_delivery' | 'platform_logistics' | 'external_carrier';
  readonly qualitySnapshotId?: EntityId;
  readonly netbackCalculationId?: EntityId;
  readonly status: OfferStatus;
  readonly rejectionReason?: string;
  readonly expiresAt?: IsoDateTime;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface NetbackCalculation {
  readonly id: EntityId;
  readonly batchId: EntityId;
  readonly lotId?: EntityId;
  readonly offerId?: EntityId;
  readonly rfqId?: EntityId;
  readonly dealId?: EntityId;
  readonly grossPricePerTon: MoneyAmount;
  readonly volumeTons: number;
  readonly grossAmount: MoneyAmount;
  readonly basis: PriceBasis;
  readonly logisticsCost: MoneyAmount;
  readonly dryingCost: MoneyAmount;
  readonly cleaningCost: MoneyAmount;
  readonly elevatorCost: MoneyAmount;
  readonly platformFee: MoneyAmount;
  readonly financingCost: MoneyAmount;
  readonly expectedQualityDiscount: MoneyAmount;
  readonly expectedDelayCost: MoneyAmount;
  readonly riskReserve: MoneyAmount;
  readonly netAmount: MoneyAmount;
  readonly netPricePerTon: MoneyAmount;
  readonly paymentScenario: Exclude<PaymentTerms, 'custom'>;
  readonly paymentDelayDays: number;
  readonly riskLevel: 'low' | 'medium' | 'high';
  readonly explanation: string[];
  readonly createdAt: IsoDateTime;
}

export type SdizOperationType = 'realization' | 'shipment' | 'transportation' | 'acceptance' | 'return' | 'partial_redemption';
export type SdizGateStatus = 'not_required' | 'required' | 'draft' | 'ready_to_sign' | 'signed' | 'sent' | 'redeemed' | 'partially_redeemed' | 'error' | 'manual_review';

export interface SdizGate {
  readonly id: EntityId;
  readonly dealId?: EntityId;
  readonly batchId: EntityId;
  readonly logisticsOrderId?: EntityId;
  readonly routeLegId?: EntityId;
  readonly basis: PriceBasis;
  readonly operationType: SdizOperationType;
  readonly responsibleRole: UserRole;
  readonly responsiblePartyId: EntityId;
  readonly required: boolean;
  readonly status: SdizGateStatus;
  readonly sdizNumber?: string;
  readonly fgisRecordId?: string;
  readonly expectedVolumeTons?: number;
  readonly actualVolumeTons?: number;
  readonly blockingLotPublication: boolean;
  readonly blockingDealCreation: boolean;
  readonly blockingShipment: boolean;
  readonly blockingAcceptance: boolean;
  readonly blockingMoneyRelease: boolean;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly maturity: MaturityStatus;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface LogisticsIncident {
  readonly id: EntityId;
  readonly dealId: EntityId;
  readonly logisticsOrderId: EntityId;
  readonly type:
    | 'vehicle_late'
    | 'vehicle_replaced'
    | 'driver_unreachable'
    | 'route_deviation'
    | 'gps_lost'
    | 'breakdown'
    | 'weight_deviation'
    | 'missing_document'
    | 'sdiz_not_ready'
    | 'etrn_not_signed';
  readonly severity: 'info' | 'warning' | 'critical';
  readonly title: string;
  readonly moneyImpact?: MoneyAmount;
  readonly status: 'open' | 'in_progress' | 'resolved' | 'closed';
  readonly createdAt: IsoDateTime;
}

export interface LogisticsOrder {
  readonly id: EntityId;
  readonly dealId: EntityId;
  readonly batchId: EntityId;
  readonly cargo: string;
  readonly volumeTons: number;
  readonly originName: string;
  readonly originAddress?: string;
  readonly originRegion: string;
  readonly destinationName: string;
  readonly destinationAddress?: string;
  readonly destinationRegion: string;
  readonly basis: PriceBasis;
  readonly plannedLoadWindowFrom?: IsoDateTime;
  readonly plannedLoadWindowTo?: IsoDateTime;
  readonly plannedDeliveryWindowFrom?: IsoDateTime;
  readonly plannedDeliveryWindowTo?: IsoDateTime;
  readonly carrierId?: EntityId;
  readonly carrierName?: string;
  readonly vehiclePlate?: string;
  readonly trailerPlate?: string;
  readonly driverId?: EntityId;
  readonly driverName?: string;
  readonly status:
    | 'draft'
    | 'carrier_matching'
    | 'carrier_assigned'
    | 'vehicle_assigned'
    | 'driver_assigned'
    | 'loading_scheduled'
    | 'loading_started'
    | 'loading_done'
    | 'in_transit'
    | 'arrived'
    | 'unloading'
    | 'completed'
    | 'incident'
    | 'cancelled';
  readonly transportPackId?: EntityId;
  readonly routeLegIds: EntityId[];
  readonly incidentIds: EntityId[];
  readonly maturity: MaturityStatus;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export type ElevatorOperationStatus =
  | 'scheduled'
  | 'arrived'
  | 'in_queue'
  | 'weighing_in'
  | 'unloading'
  | 'weighing_out'
  | 'sample_taken'
  | 'lab_pending'
  | 'quality_ready'
  | 'accepted'
  | 'accepted_with_deviation'
  | 'rejected'
  | 'closed';

export interface ElevatorOperation {
  readonly id: EntityId;
  readonly dealId: EntityId;
  readonly batchId: EntityId;
  readonly logisticsOrderId: EntityId;
  readonly routeLegId: EntityId;
  readonly elevatorId: EntityId;
  readonly elevatorName: string;
  readonly vehiclePlate: string;
  readonly trailerPlate?: string;
  readonly driverName?: string;
  readonly status: ElevatorOperationStatus;
  readonly queueNumber?: number;
  readonly grossWeightTons?: number;
  readonly tareWeightTons?: number;
  readonly netWeightTons?: number;
  readonly sampleChainId?: EntityId;
  readonly labProtocolId?: EntityId;
  readonly weightBalanceId?: EntityId;
  readonly qualityDeltaId?: EntityId;
  readonly sdizGateIds: EntityId[];
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface WeightBalance {
  readonly id: EntityId;
  readonly dealId: EntityId;
  readonly batchId: EntityId;
  readonly logisticsOrderId?: EntityId;
  readonly routeLegId?: EntityId;
  readonly elevatorOperationId?: EntityId;
  readonly contractedVolumeTons: number;
  readonly loadedGrossTons?: number;
  readonly loadedTareTons?: number;
  readonly loadedNetTons?: number;
  readonly receivedGrossTons?: number;
  readonly receivedTareTons?: number;
  readonly receivedNetTons?: number;
  readonly acceptedNetTons?: number;
  readonly adjustedWeightTons?: number;
  readonly lossTons?: number;
  readonly lossPercent?: number;
  readonly toleranceTons?: number;
  readonly tolerancePercent?: number;
  readonly weightDeviationMoneyImpact: MoneyAmount;
  readonly status: 'not_started' | 'loading_weight_captured' | 'receiving_weight_captured' | 'within_tolerance' | 'deviation' | 'disputed' | 'accepted';
  readonly evidenceIds: EntityId[];
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface GrainQualityProfile {
  readonly id: EntityId;
  readonly source: 'seller_declared' | 'elevator_lab' | 'buyer_lab' | 'independent_lab' | 'manual';
  readonly crop: string;
  readonly gostClass?: string;
  readonly moisture?: number;
  readonly protein?: number;
  readonly gluten?: number;
  readonly idk?: number;
  readonly natWeight?: number;
  readonly fallingNumber?: number;
  readonly weedImpurity?: number;
  readonly grainImpurity?: number;
  readonly bugDamage?: number;
  readonly infection?: string;
  readonly labName?: string;
  readonly labProtocolId?: EntityId;
  readonly sampleChainId?: EntityId;
  readonly measuredAt?: IsoDateTime;
  readonly attachedFileId?: EntityId;
  readonly maturity: MaturityStatus;
}

export interface QualityDeltaItem {
  readonly metric: string;
  readonly agreedValue?: number | string;
  readonly actualValue?: number | string;
  readonly tolerance?: number | string;
  readonly deviationText: string;
  readonly moneyImpact: MoneyAmount;
  readonly requiresDispute: boolean;
}

export interface QualityDelta {
  readonly id: EntityId;
  readonly dealId: EntityId;
  readonly batchId: EntityId;
  readonly agreedQualityProfileId: EntityId;
  readonly acceptedQualityProfileId?: EntityId;
  readonly items: QualityDeltaItem[];
  readonly totalDiscount: MoneyAmount;
  readonly totalHoldAmount: MoneyAmount;
  readonly status: 'not_measured' | 'within_tolerance' | 'discount_required' | 'repeat_analysis_available' | 'dispute_required' | 'accepted';
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export type SampleChainStatus = 'not_started' | 'sample_taken' | 'sealed' | 'sent_to_lab' | 'lab_received' | 'protocol_ready' | 'repeat_requested' | 'arbitration_requested' | 'closed';

export interface SampleChain {
  readonly id: EntityId;
  readonly dealId: EntityId;
  readonly batchId: EntityId;
  readonly logisticsOrderId?: EntityId;
  readonly routeLegId?: EntityId;
  readonly elevatorOperationId?: EntityId;
  readonly status: SampleChainStatus;
  readonly takenAt?: IsoDateTime;
  readonly takenByRole?: UserRole;
  readonly takenByName?: string;
  readonly takenLocation?: string;
  readonly sealNumber?: string;
  readonly photoIds: EntityId[];
  readonly labId?: EntityId;
  readonly labName?: string;
  readonly labReceivedAt?: IsoDateTime;
  readonly labProtocolId?: EntityId;
  readonly repeatAllowed: boolean;
  readonly repeatRequestedAt?: IsoDateTime;
  readonly arbitrationSampleExists: boolean;
  readonly arbitrationStatus?: 'not_requested' | 'requested' | 'in_progress' | 'completed';
  readonly evidencePackId?: EntityId;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export type DocumentRequirementStatus = 'not_required' | 'required' | 'draft' | 'requested' | 'uploaded' | 'signed' | 'rejected' | 'expired' | 'manual_review';

export type DocumentType =
  | 'contract'
  | 'specification'
  | 'invoice'
  | 'upd'
  | 'transport_waybill'
  | 'etrn'
  | 'sdiz_realization'
  | 'sdiz_transportation'
  | 'sdiz_acceptance'
  | 'quality_protocol'
  | 'weight_certificate'
  | 'discrepancy_act'
  | 'edo_signature'
  | 'bank_confirmation';

export interface DocumentRequirement {
  readonly id: EntityId;
  readonly dealId: EntityId;
  readonly relatedEntityType: 'batch' | 'lot' | 'offer' | 'deal' | 'logistics' | 'elevator' | 'lab' | 'money' | 'dispute';
  readonly relatedEntityId: EntityId;
  readonly documentType: DocumentType;
  readonly required: boolean;
  readonly status: DocumentRequirementStatus;
  readonly responsibleRole: UserRole;
  readonly responsiblePartyId?: EntityId;
  readonly blocksLotPublication: boolean;
  readonly blocksShipment: boolean;
  readonly blocksAcceptance: boolean;
  readonly blocksMoneyRelease: boolean;
  readonly fileId?: EntityId;
  readonly externalSystem: 'fgis' | 'edo' | 'gis_epd' | 'bank' | 'manual';
  readonly externalStatus?: string;
  readonly dueAt?: IsoDateTime;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export type MoneyAdjustmentType =
  | 'quality_discount'
  | 'weight_deviation'
  | 'drying'
  | 'cleaning'
  | 'elevator_service'
  | 'logistics_penalty'
  | 'delay_penalty'
  | 'document_hold'
  | 'sdiz_hold'
  | 'dispute_hold'
  | 'manual_hold';

export interface MoneyAdjustment {
  readonly id: EntityId;
  readonly dealId: EntityId;
  readonly type: MoneyAdjustmentType;
  readonly title: string;
  readonly amount: MoneyAmount;
  readonly sourceEntityType: 'quality_delta' | 'weight_balance' | 'logistics_incident' | 'document_requirement' | 'sdiz_gate' | 'support_case' | 'dispute' | 'manual';
  readonly sourceEntityId?: EntityId;
  readonly status: 'draft' | 'applied' | 'disputed' | 'cancelled';
  readonly blocksFullRelease: boolean;
  readonly allowsPartialRelease: boolean;
  readonly createdAt: IsoDateTime;
}

export interface MoneyProjection {
  readonly dealId: EntityId;
  readonly grossDealAmount: MoneyAmount;
  readonly reservedAmount: MoneyAmount;
  readonly readyToReleaseAmount: MoneyAmount;
  readonly heldAmount: MoneyAmount;
  readonly disputedAmount: MoneyAmount;
  readonly manualReviewAmount: MoneyAmount;
  readonly releasedAmount: MoneyAmount;
  readonly adjustments: MoneyAdjustment[];
  readonly releaseAllowed: boolean;
  readonly releaseBlockedReasons: ExecutionBlocker[];
  readonly nextAction?: NextAction;
}

export interface EvidencePack {
  readonly id: EntityId;
  readonly dealId: EntityId;
  readonly batchId?: EntityId;
  readonly documentIds: EntityId[];
  readonly weightEvidenceIds: EntityId[];
  readonly photoIds: EntityId[];
  readonly routeEventIds: EntityId[];
  readonly labProtocolIds: EntityId[];
  readonly sampleChainIds: EntityId[];
  readonly supportMessageIds: EntityId[];
  readonly decisionIds: EntityId[];
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface Dispute {
  readonly id: EntityId;
  readonly dealId: EntityId;
  readonly batchId?: EntityId;
  readonly logisticsOrderId?: EntityId;
  readonly reason: 'quality' | 'weight' | 'documents' | 'sdiz' | 'logistics' | 'delay' | 'payment' | 'acceptance' | 'other';
  readonly status: 'draft' | 'open' | 'evidence_requested' | 'under_review' | 'decision_ready' | 'resolved' | 'closed';
  readonly disputedAmount: MoneyAmount;
  readonly undisputedAmount: MoneyAmount;
  readonly openedByRole: UserRole;
  readonly openedByPartyId: EntityId;
  readonly evidencePackId: EntityId;
  readonly decisionId?: EntityId;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface DisputeDecision {
  readonly id: EntityId;
  readonly disputeId: EntityId;
  readonly dealId: EntityId;
  readonly decision: 'seller_fully_right' | 'buyer_fully_right' | 'partial_hold' | 'repeat_analysis' | 'manual_settlement' | 'cancel_deal';
  readonly reason: string;
  readonly releaseAmount: MoneyAmount;
  readonly holdAmount: MoneyAmount;
  readonly penaltyAmount?: MoneyAmount;
  readonly decidedByRole: UserRole;
  readonly decidedByName?: string;
  readonly createdAt: IsoDateTime;
}

export interface SupportCase {
  readonly id: EntityId;
  readonly title: string;
  readonly description: string;
  readonly status: 'open' | 'in_progress' | 'waiting_user' | 'waiting_external' | 'resolved' | 'closed';
  readonly priority: 'low' | 'medium' | 'high' | 'critical';
  readonly category: 'sdiz' | 'fgis' | 'documents' | 'money' | 'quality' | 'weight' | 'logistics' | 'elevator' | 'lab' | 'dispute' | 'access' | 'other';
  readonly requesterRole: UserRole;
  readonly relatedEntityType: 'batch' | 'lot' | 'offer' | 'deal' | 'logistics_order' | 'route_leg' | 'document' | 'money' | 'dispute';
  readonly relatedEntityId: EntityId;
  readonly dealId?: EntityId;
  readonly batchId?: EntityId;
  readonly lotId?: EntityId;
  readonly logisticsOrderId?: EntityId;
  readonly automationSource: 'system_gate' | 'user_created' | 'operator_created';
  readonly suggestedResolution?: string;
  readonly nextActionRole?: UserRole;
  readonly nextActionTitle?: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface ExecutionBlocker {
  readonly id: EntityId;
  readonly type: 'fgis' | 'sdiz' | 'document' | 'money' | 'quality' | 'weight' | 'logistics' | 'elevator' | 'lab' | 'support' | 'dispute' | 'manual';
  readonly severity: 'info' | 'warning' | 'critical';
  readonly title: string;
  readonly description: string;
  readonly blocks: 'lot_publication' | 'deal_creation' | 'shipment' | 'acceptance' | 'money_release' | 'deal_closing';
  readonly responsibleRole: UserRole;
  readonly relatedEntityType: string;
  readonly relatedEntityId: EntityId;
  readonly moneyImpact?: MoneyAmount;
  readonly nextAction?: NextAction;
}

export interface NextAction {
  readonly id: EntityId;
  readonly title: string;
  readonly description?: string;
  readonly role: UserRole;
  readonly priority: 'low' | 'medium' | 'high' | 'critical';
  readonly actionType:
    | 'create_batch'
    | 'link_fgis'
    | 'attach_quality'
    | 'publish_lot'
    | 'create_rfq'
    | 'accept_offer'
    | 'create_deal'
    | 'reserve_money'
    | 'prepare_sdiz'
    | 'assign_logistics'
    | 'capture_weight'
    | 'take_sample'
    | 'upload_document'
    | 'resolve_blocker'
    | 'request_support'
    | 'open_dispute'
    | 'approve_release';
  readonly targetRoute: string;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  readonly createsAuditEvent: boolean;
  readonly requiresReason: boolean;
}

export interface DocumentSummary {
  readonly total: number;
  readonly ready: number;
  readonly missing: number;
  readonly blockingMoneyRelease: number;
}

export interface LogisticsSummary {
  readonly status: LogisticsOrder['status'];
  readonly currentStep: string;
  readonly incidentCount: number;
}

export interface QualitySummary {
  readonly status: QualityDelta['status'];
  readonly totalDiscount: MoneyAmount;
  readonly repeatAnalysisAvailable: boolean;
}

export interface SdizSummary {
  readonly total: number;
  readonly ready: number;
  readonly blockingShipment: number;
  readonly blockingMoneyRelease: number;
}

export interface SupportSummary {
  readonly openCases: number;
  readonly criticalCases: number;
  readonly nextActionTitle?: string;
}

export interface RoleExecutionSummary {
  readonly role: UserRole;
  readonly entityType: 'batch' | 'lot' | 'rfq' | 'offer' | 'deal' | 'logistics_order' | 'elevator_operation' | 'dispute' | 'support_case';
  readonly entityId: EntityId;
  readonly currentState: string;
  readonly blockers: ExecutionBlocker[];
  readonly nextActions: NextAction[];
  readonly moneySummary?: MoneyProjection;
  readonly documentSummary?: DocumentSummary;
  readonly logisticsSummary?: LogisticsSummary;
  readonly qualitySummary?: QualitySummary;
  readonly sdizSummary?: SdizSummary;
  readonly supportSummary?: SupportSummary;
  readonly maturity: MaturityStatus;
}

export interface AuditEvent {
  readonly id: EntityId;
  readonly entityType: string;
  readonly entityId: EntityId;
  readonly dealId?: EntityId;
  readonly batchId?: EntityId;
  readonly actorRole: UserRole;
  readonly actorId?: EntityId;
  readonly actorName?: string;
  readonly action: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly reason?: string;
  readonly createdAt: IsoDateTime;
}

export interface RfqMatchResult {
  readonly batch: GrainBatch;
  readonly score: number;
  readonly riskLevel: 'low' | 'medium' | 'high';
  readonly deliveredPricePerTon: MoneyAmount;
  readonly reasons: string[];
  readonly nextAction: NextAction;
}
