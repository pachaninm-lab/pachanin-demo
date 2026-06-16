export type GateStatus = 'готово' | 'проверить' | 'стоп';

export interface ReadinessGate {
  status: GateStatus;
  blocker: string;
  note: string;
}

export interface ExecutionDeal {
  id: string;
  lotId: string;
  fgisPartyId: string;
  crop: string;
  volumeTons: number;
  priceRubPerTon: number;
  seller: string;
  buyerAlias: string;
  buyerDisclosure: string;
  basis: string;
  status: string;
  maturity: string;
}

export interface ExecutionMoney {
  reservedRub: number;
  holdRub: number;
  releaseCandidateRub: number;
  buyerMoneyStatus: string;
  bankDecision: string;
}

export interface ExecutionLogistics {
  orderId: string;
  tripId: string;
  carrier: string;
  driverAlias: string;
  vehicleMasked: string;
  pickupPoint: string;
  deliveryPoint: string;
  eta: string;
  currentLeg: string;
  incidentStatus: string;
  gateStatus: GateStatus;
}

export interface ExecutionDocuments {
  contractStatus: string;
  sdizStatus: string;
  transportPackStatus: string;
  edoStatus: string;
  kepStatus: string;
  missingDocuments: string[];
}

export interface ExecutionDispute {
  status: GateStatus;
  holdReason: string;
  evidenceCount: number;
  arbitratorNeeded: boolean;
}

export interface AuditEvent {
  time: string;
  actor: string;
  action: string;
  note: string;
  status: string;
}

export interface RoleNotification {
  notificationId: string;
  targetRole: string;
  targetUserId: string;
  linkedDealId: string;
  text: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueAt: string;
  actionLink: string;
  createdByActionId: string;
  readStatus: 'unread' | 'read';
}

export interface SupportTicket {
  ticketId: string;
  linkedDealId: string;
  linkedDocumentId?: string;
  linkedTripId?: string;
  linkedDisputeId?: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  slaDeadline: string;
  moneyAtRisk: number;
  ownerRole: string;
  nextAction: string;
  escalationPath: string[];
  status: 'open' | 'in_progress' | 'escalated' | 'closed';
  auditEvents: AuditEvent[];
}

export interface SupportTicketInput {
  ticketId: string;
  linkedDealId: string;
  linkedDocumentId?: string;
  linkedTripId?: string;
  linkedDisputeId?: string;
  category: string;
  priority: SupportTicket['priority'];
  createdAt: string;
  slaHours: number;
  moneyAtRisk: number;
  ownerRole: string;
  nextAction: string;
  escalationPath: string[];
}

export interface DisputeMoneyImpactInput {
  disputeId: string;
  type: 'weight' | 'quality' | 'documents' | 'logistics' | 'sdiz' | 'epd' | 'payment' | 'mixed';
  claimedAmount: number;
  evidenceIds: readonly string[];
  reviewedEvidenceIds: readonly string[];
  regulationPoint?: string;
  decision?: 'hold' | 'partial_release' | 'release' | 'manual_review';
  decisionHoldAmount?: number;
  decisionReleaseAmount?: number;
}

export interface DisputeMoneyImpactResult {
  disputeId: string;
  type: DisputeMoneyImpactInput['type'];
  evidencePackId: string;
  evidenceComplete: boolean;
  missingEvidenceIds: string[];
  claimedAmount: number;
  heldAmount: number;
  readyToReleaseAmount: number;
  bankBasisStatus: string;
  arbitratorCanDecide: boolean;
  nextRoleTask: string;
  auditEvent: AuditEvent;
}

export interface DealExecutionDocumentRequirement {
  documentId: string;
  title: string;
  status: string;
  source: string;
  responsibleRole: string;
  signerRole: string;
  signatureType: string;
  externalSystem: string;
  blocksStage: string;
  moneyImpact: string;
  nextAction: string;
  auditEvents: AuditEvent[];
}

export interface DealExecutionTrip {
  tripId: string;
  vehicleMasked: string;
  driverAlias: string;
  plannedLoadTons?: number;
  status?: string;
  epdTitleId?: string;
  sealStatus?: string;
  pickupPoint: string;
  deliveryPoint: string;
  eta: string;
  currentLeg: string;
}

export interface DealExecutionTransportDocumentPack {
  epdOperator: string;
  etrnId: string;
  titles: Array<{ titleId: string; role: string; status: string }>;
  shipperSignatureStatus: string;
  carrierSignatureStatus: string;
  driverSignatureStatus: string;
  consigneeSignatureStatus: string;
  gisEpdTransferStatus: string;
  gisEpdError?: string;
  manualCheckStatus: string;
}

export interface MoneyState {
  goodsAmount: number;
  vatAmount: number;
  logisticsAmount?: number;
  platformFee?: number;
  qualityAdjustmentAmount?: number;
  weightAdjustmentAmount?: number;
  reserveAmount: number;
  heldAmount: number;
  manualReviewAmount: number;
  readyToReleaseAmount: number;
  releasedAmount: number;
  refundAmount: number;
  calculationFormula: string;
  bankStatus: string;
  reconciliationStatus: string;
}

export interface ElevatorWeightImpactInput {
  dealId: string;
  declaredTons: number;
  grossTons: number;
  tareTons: number;
  moistureAdjustmentTons: number;
  impurityAdjustmentTons: number;
  pricePerTon: number;
}

export interface ElevatorWeightImpact {
  dealId: string;
  netTons: number;
  acceptedTons: number;
  deltaTons: number;
  weightAdjustmentAmount: number;
  holdAmount: number;
  draftDiscrepancyActRequired: boolean;
  disputeTrigger: boolean;
  moneyImpact: string;
  nextRoleTask: string;
}

export interface DealExecutionLabProtocol {
  crop: string;
  class: string;
  moisture: number;
  nature: number;
  protein: number;
  gluten: number;
  idk: number;
  fallingNumber: number;
  weedImpurity: number;
  grainImpurity: number;
  infestation: string;
  protocolNumber: string;
  method: string;
  laboratory: string;
  signer: string;
  kepStatus: string;
  measuredAt: string;
}

export interface DealExecutionQualityTerms {
  class: string;
  maxMoisture: number;
  minNature: number;
  minProtein: number;
  minGluten: number;
  maxIdk: number;
  minFallingNumber: number;
  maxWeedImpurity: number;
  maxGrainImpurity: number;
}

export interface LabQualityImpact {
  protocol: DealExecutionLabProtocol;
  qualityDelta: string[];
  priceAdjustmentPerTon: number;
  priceAdjustment: number;
  holdAmount: number;
  disputeTrigger: boolean;
  bankStatus: string;
  nextRoleTask: string;
}

export const PLATFORM_V7_WHEAT_4_CLASS_TERMS: DealExecutionQualityTerms = {
  class: '4 класс',
  maxMoisture: 14,
  minNature: 730,
  minProtein: 11.5,
  minGluten: 18,
  maxIdk: 100,
  minFallingNumber: 180,
  maxWeedImpurity: 2,
  maxGrainImpurity: 5,
};

export type SdizLifecycleStepId =
  | 'fgis_party_created'
  | 'sdiz_issued'
  | 'sdiz_signed'
  | 'sdiz_transferred'
  | 'sdiz_redeemed'
  | 'sdiz_refusal_or_manual_check';

export interface SdizLifecycleStep {
  id: SdizLifecycleStepId;
  title: string;
  status: string;
  responsibleRole: string;
  blocksMoneyRelease: boolean;
  nextAction: string;
}

export interface DealExecutionCase {
  dealId: string;
  lotId: string;
  rfqId?: string;
  offerId?: string;
  sellerId: string;
  buyerId: string;
  commodity: {
    crop: string;
    class: string;
    harvestYear: number;
    volumeDeclaredTons: number;
    volumeAcceptedTons?: number;
    volumeNetTons?: number;
    storageLocation: string;
    originRegion: string;
  };
  price: {
    pricePerTon: number;
    vatRate: number;
    grossGoodsAmount: number;
    reserveAmount: number;
    holdAmount: number;
    readyToReleaseAmount: number;
    releasedAmount: number;
    platformFee: number;
    calculationFormula: string;
  };
  money: MoneyState;
  fgis: {
    partyId: string;
    partyStatus: string;
    sdizId: string;
    sdizIssuedStatus: string;
    sdizSignedStatus: string;
    sdizTransferredStatus: string;
    sdizRedeemedStatus: string;
    sdizRefusalStatus: string;
    lastManualCheckAt: string;
  };
  logistics: {
    logisticsOrderId: string;
    trips: DealExecutionTrip[];
    epdPackage: DealExecutionTransportDocumentPack;
  };
  quality: {
    declaredProfile: string;
    labProtocol: string;
    qualityDelta: string;
    priceAdjustment: number;
  };
  documents: DealExecutionDocumentRequirement[];
  dispute: {
    disputeId?: string;
    type?: string;
    status?: string;
    evidencePack?: string;
    decision?: string;
    moneyImpact?: number;
  };
  rolesState: {
    sellerNextAction: string;
    buyerNextAction: string;
    logisticsNextAction: string;
    driverNextAction: string;
    elevatorNextAction: string;
    labNextAction: string;
    bankNextAction: string;
    complianceNextAction: string;
    arbitratorNextAction: string;
    supportNextAction: string;
  };
  auditEvents: AuditEvent[];
}

export const DL_9106_EXECUTION_CASE: DealExecutionCase = {
  dealId: 'DL-9106',
  lotId: 'LOT-2403',
  rfqId: 'RFQ-2403-BUYER-1',
  offerId: 'OFF-2403-BUYER-1',
  sellerId: 'SELLER-SEVERNOE-POLE',
  buyerId: 'BUYER-1',
  commodity: {
    crop: 'Пшеница',
    class: '4 класс',
    harvestYear: 2025,
    volumeDeclaredTons: 600,
    storageLocation: 'Тамбовская область · элеватор',
    originRegion: 'Тамбовская область',
  },
  price: {
    pricePerTon: 16_080,
    vatRate: 0,
    grossGoodsAmount: 9_648_000,
    reserveAmount: 9_648_000,
    holdAmount: 0,
    readyToReleaseAmount: 0,
    releasedAmount: 0,
    platformFee: 0,
    calculationFormula: '16 080 ₽/т × 600 т = 9 648 000 ₽; расчёт 0 ₽ до закрытия банка, СДИЗ, ЭТрН, ГИС ЭПД, приёмки и качества',
  },
  money: {
    goodsAmount: 9_648_000,
    vatAmount: 0,
    logisticsAmount: 0,
    platformFee: 0,
    qualityAdjustmentAmount: 0,
    weightAdjustmentAmount: 0,
    reserveAmount: 9_648_000,
    heldAmount: 0,
    manualReviewAmount: 9_648_000,
    readyToReleaseAmount: 0,
    releasedAmount: 0,
    refundAmount: 0,
    calculationFormula: '16 080 ₽/т × 600 т = 9 648 000 ₽; + НДС 0 ₽ + логистика 0 ₽ + комиссия 0 ₽ - качество 0 ₽ - вес 0 ₽ = резерв 9 648 000 ₽; к выплате 0 ₽; ручная проверка 9 648 000 ₽',
    bankStatus: 'основание не готово · ожидает подтверждения банка',
    reconciliationStatus: 'awaiting_bank_event',
  },
  fgis: {
    partyId: 'ФГИС-68-2403-001',
    partyStatus: 'Партия отправлена на сверку · ручная проверка',
    sdizId: 'SDIZ-DL-9106',
    sdizIssuedStatus: 'не оформлен',
    sdizSignedStatus: 'не подписан',
    sdizTransferredStatus: 'не передан покупателю',
    sdizRedeemedStatus: 'не погашен покупателем',
    sdizRefusalStatus: 'отказ не зафиксирован',
    lastManualCheckAt: '2026-05-21T09:00:00+03:00',
  },
  logistics: {
    logisticsOrderId: 'LOG-REQ-2403',
    trips: [
      {
        tripId: 'TRIP-2403-001',
        vehicleMasked: 'Р***ТУ',
        driverAlias: 'Водитель А',
        plannedLoadTons: 200,
        status: 'назначен · ожидает погрузки',
        epdTitleId: 'ETRN-DL-9106-001-T3',
        sealStatus: 'ожидает фото пломбы',
        pickupPoint: 'Тамбовская область · элеватор',
        deliveryPoint: 'Элеватор ВРЖ-08',
        eta: '7–14 дней с момента допуска',
        currentLeg: 'ожидает погрузки',
      },
      {
        tripId: 'TRIP-2403-002',
        vehicleMasked: 'М***КС',
        driverAlias: 'Водитель Б',
        plannedLoadTons: 200,
        status: 'ожидает назначения окна',
        epdTitleId: 'ETRN-DL-9106-001-T3',
        sealStatus: 'не загружено',
        pickupPoint: 'Тамбовская область · элеватор',
        deliveryPoint: 'Элеватор ВРЖ-08',
        eta: 'после закрытия первого окна',
        currentLeg: 'ожидает окна погрузки',
      },
      {
        tripId: 'TRIP-2403-003',
        vehicleMasked: 'К***ОР',
        driverAlias: 'Водитель В',
        plannedLoadTons: 200,
        status: 'резерв машины',
        epdTitleId: 'ETRN-DL-9106-001-T3',
        sealStatus: 'не загружено',
        pickupPoint: 'Тамбовская область · элеватор',
        deliveryPoint: 'Элеватор ВРЖ-08',
        eta: 'после подтверждения ЭТрН',
        currentLeg: 'резерв',
      },
    ],
    epdPackage: {
      epdOperator: 'оператор ИС ЭПД · требуется договор и доступ',
      etrnId: 'ETRN-DL-9106-001',
      titles: [
        { titleId: 'ETRN-DL-9106-001-T1', role: 'грузоотправитель', status: 'черновик' },
        { titleId: 'ETRN-DL-9106-001-T2', role: 'перевозчик', status: 'ожидает подписи' },
        { titleId: 'ETRN-DL-9106-001-T3', role: 'водитель', status: 'ожидает рейса' },
        { titleId: 'ETRN-DL-9106-001-T4', role: 'грузополучатель', status: 'ожидает приёмки' },
      ],
      shipperSignatureStatus: 'черновик',
      carrierSignatureStatus: 'ожидает подписи',
      driverSignatureStatus: 'ожидает рейса',
      consigneeSignatureStatus: 'ожидает приёмки',
      gisEpdTransferStatus: 'ожидает закрытия ЭТрН',
      manualCheckStatus: 'ручная проверка',
    },
  },
  quality: {
    declaredProfile: 'Пшеница · 4 класс · декларация продавца',
    labProtocol: 'ожидается',
    qualityDelta: 'не рассчитано',
    priceAdjustment: 0,
  },
  documents: [],
  dispute: {
    disputeId: 'DSP-DL-9106-QUALITY',
    type: 'quality',
    status: 'open',
    evidencePack: 'EVP-DL-9106-QUALITY',
    decision: 'manual_review',
    moneyImpact: 0,
  },
  rolesState: {
    sellerNextAction: 'подписать договор и спецификацию',
    buyerNextAction: 'подтвердить банковский контур',
    logisticsNextAction: 'закрыть ЭТрН и статусы ГИС ЭПД',
    driverNextAction: 'зафиксировать рейс и пломбу',
    elevatorNextAction: 'подтвердить приёмку и зачётный вес',
    labNextAction: 'передать протокол качества',
    bankNextAction: 'ожидать основание для ручной проверки',
    complianceNextAction: 'проверить полномочия подписантов',
    arbitratorNextAction: 'ожидать доказательства и пункт регламента',
    supportNextAction: 'следить за SLA документов и денег',
  },
  auditEvents: [],
};

export const DEAL_EXECUTION_CASES: DealExecutionCase[] = [DL_9106_EXECUTION_CASE];

export function selectDealExecutionCase(dealId: string): DealExecutionCase | undefined {
  return DEAL_EXECUTION_CASES.find((item) => item.dealId === dealId);
}

export function selectDealMoneyState(dealId: string): MoneyState | undefined {
  return selectDealExecutionCase(dealId)?.money;
}

function statusConfirms(status: string, marker: string): boolean {
  const normalized = status.toLowerCase();
  return normalized.includes(marker) && !normalized.startsWith('не ') && !normalized.includes('ожидает');
}

export function selectDealSdizLifecycle(dealId: string): SdizLifecycleStep[] {
  const executionCase = selectDealExecutionCase(dealId);
  if (!executionCase) return [];
  const { fgis } = executionCase;

  return [
    {
      id: 'fgis_party_created',
      title: 'Партия во ФГИС создана',
      status: fgis.partyStatus,
      responsibleRole: 'seller',
      blocksMoneyRelease: fgis.partyStatus.includes('ручная проверка'),
      nextAction: 'зафиксировать источник проверки партии',
    },
    {
      id: 'sdiz_issued',
      title: 'СДИЗ оформлен',
      status: fgis.sdizIssuedStatus,
      responsibleRole: 'seller',
      blocksMoneyRelease: !statusConfirms(fgis.sdizIssuedStatus, 'оформлен'),
      nextAction: 'оформить СДИЗ вручную или загрузить внешнее подтверждение',
    },
    {
      id: 'sdiz_signed',
      title: 'СДИЗ подписан',
      status: fgis.sdizSignedStatus,
      responsibleRole: 'seller',
      blocksMoneyRelease: !statusConfirms(fgis.sdizSignedStatus, 'подписан'),
      nextAction: 'подписать СДИЗ КЭП',
    },
    {
      id: 'sdiz_transferred',
      title: 'СДИЗ передан покупателю',
      status: fgis.sdizTransferredStatus,
      responsibleRole: 'seller',
      blocksMoneyRelease: !statusConfirms(fgis.sdizTransferredStatus, 'передан'),
      nextAction: 'передать СДИЗ покупателю',
    },
    {
      id: 'sdiz_redeemed',
      title: 'СДИЗ погашен покупателем',
      status: fgis.sdizRedeemedStatus,
      responsibleRole: 'buyer',
      blocksMoneyRelease: !statusConfirms(fgis.sdizRedeemedStatus, 'погашен'),
      nextAction: 'погасить СДИЗ после приёмки',
    },
    {
      id: 'sdiz_refusal_or_manual_check',
      title: 'Отказ / частичное погашение / ручная проверка',
      status: `${fgis.sdizRefusalStatus} · ручная проверка ${fgis.lastManualCheckAt}`,
      responsibleRole: 'buyer',
      blocksMoneyRelease: !fgis.sdizRefusalStatus.includes('обработан'),
      nextAction: 'зафиксировать отказ, частичное погашение или результат ручной проверки',
    },
  ];
}

export function isSdizLifecycleBlockingMoneyRelease(dealId: string): boolean {
  return selectDealSdizLifecycle(dealId).some((step) => step.blocksMoneyRelease);
}

export function selectDealTransportDocumentPack(dealId: string): DealExecutionTransportDocumentPack | undefined {
  return selectDealExecutionCase(dealId)?.logistics.epdPackage;
}

export function selectDealLogisticsTripPlan(dealId: string) {
  const executionCase = selectDealExecutionCase(dealId);
  const trips = executionCase?.logistics.trips ?? [];
  const plannedTons = trips.reduce((sum, trip) => sum + (trip.plannedLoadTons ?? 0), 0);

  return {
    dealId,
    logisticsOrderId: executionCase?.logistics.logisticsOrderId ?? '',
    vehicleCount: trips.length,
    tripIds: trips.map((trip) => trip.tripId),
    plannedTons,
    declaredTons: executionCase?.commodity.volumeDeclaredTons ?? 0,
    trips,
    isCompletePlan: trips.length > 0 && plannedTons === (executionCase?.commodity.volumeDeclaredTons ?? 0),
    epdPackage: executionCase?.logistics.epdPackage,
  };
}

export function selectDealDocumentMatrix(dealId: string): DealExecutionDocumentRequirement[] {
  return selectDealExecutionCase(dealId)?.documents ?? [];
}

export function selectBlockingDealDocuments(dealId: string): DealExecutionDocumentRequirement[] {
  return selectDealDocumentMatrix(dealId).filter((document) => {
    const normalized = `${document.blocksStage} ${document.moneyImpact}`.toLowerCase();
    return normalized.includes('money') || normalized.includes('расчёт') || normalized.includes('банк');
  });
}

export function isTransportPackBlockingBankBasis(pack: DealExecutionTransportDocumentPack | undefined): boolean {
  if (!pack) return true;

  const signatureStatuses = [
    pack.shipperSignatureStatus,
    pack.carrierSignatureStatus,
    pack.driverSignatureStatus,
    pack.consigneeSignatureStatus,
  ];

  return (
    signatureStatuses.some((status) => !statusConfirms(status, 'подпис')) ||
    !statusConfirms(pack.gisEpdTransferStatus, 'передан') ||
    pack.manualCheckStatus.includes('ручная проверка')
  );
}

export function calculateDealMoneyFormulaAmount(money: MoneyState): number {
  return (
    money.goodsAmount +
    money.vatAmount +
    (money.logisticsAmount ?? 0) +
    (money.platformFee ?? 0) -
    (money.qualityAdjustmentAmount ?? 0) -
    (money.weightAdjustmentAmount ?? 0)
  );
}

export function calculateDealMoneyAllocationAmount(money: MoneyState): number {
  return money.heldAmount + money.manualReviewAmount + money.readyToReleaseAmount + money.releasedAmount + money.refundAmount;
}

export function isDealMoneyStateBalanced(money: MoneyState): boolean {
  return calculateDealMoneyFormulaAmount(money) === money.reserveAmount && calculateDealMoneyAllocationAmount(money) === money.reserveAmount;
}

export function calculateElevatorWeightImpact(input: ElevatorWeightImpactInput): ElevatorWeightImpact {
  const netTons = roundTons(input.grossTons - input.tareTons);
  const acceptedTons = roundTons(Math.max(0, netTons - input.moistureAdjustmentTons - input.impurityAdjustmentTons));
  const deltaTons = roundTons(Math.max(0, input.declaredTons - acceptedTons));
  const weightAdjustmentAmount = Math.round(deltaTons * input.pricePerTon);
  const hasDelta = deltaTons > 0;

  return {
    dealId: input.dealId,
    netTons,
    acceptedTons,
    deltaTons,
    weightAdjustmentAmount,
    holdAmount: weightAdjustmentAmount,
    draftDiscrepancyActRequired: hasDelta,
    disputeTrigger: hasDelta,
    moneyImpact: hasDelta
      ? `Отклонение веса ${deltaTons} т создаёт удержание ${formatRub(weightAdjustmentAmount)} до акта и решения сторон.`
      : 'Отклонения веса нет, удержание по весу не создаётся.',
    nextRoleTask: hasDelta
      ? 'Элеватор создаёт draft акта расхождения; продавец и покупатель получают задачу подписать или открыть спор.'
      : 'Элеватор закрывает акт зачётного веса и передаёт основание банку.',
  };
}

export function calculateLabQualityImpact(
  executionCase: DealExecutionCase,
  protocol: DealExecutionLabProtocol,
  terms: DealExecutionQualityTerms = PLATFORM_V7_WHEAT_4_CLASS_TERMS,
): LabQualityImpact {
  const qualityDelta: string[] = [];
  let priceAdjustmentPerTon = 0;

  if (protocol.class !== terms.class) {
    qualityDelta.push(`класс ${protocol.class} ниже условий ${terms.class}`);
    priceAdjustmentPerTon += 300;
  }
  if (protocol.moisture > terms.maxMoisture) {
    const delta = protocol.moisture - terms.maxMoisture;
    qualityDelta.push(`влажность выше на ${roundMetric(delta)} п.п.`);
    priceAdjustmentPerTon += Math.ceil(delta * 90);
  }
  if (protocol.nature < terms.minNature) {
    const delta = terms.minNature - protocol.nature;
    qualityDelta.push(`натура ниже на ${roundMetric(delta)} г/л`);
    priceAdjustmentPerTon += Math.ceil(delta * 2);
  }
  if (protocol.protein < terms.minProtein) {
    const delta = terms.minProtein - protocol.protein;
    qualityDelta.push(`белок ниже на ${roundMetric(delta)} п.п.`);
    priceAdjustmentPerTon += Math.ceil(delta * 120);
  }
  if (protocol.gluten < terms.minGluten) {
    const delta = terms.minGluten - protocol.gluten;
    qualityDelta.push(`клейковина ниже на ${roundMetric(delta)} п.п.`);
    priceAdjustmentPerTon += Math.ceil(delta * 80);
  }
  if (protocol.idk > terms.maxIdk) {
    const delta = protocol.idk - terms.maxIdk;
    qualityDelta.push(`ИДК выше на ${roundMetric(delta)}`);
    priceAdjustmentPerTon += Math.ceil(delta * 4);
  }
  if (protocol.fallingNumber < terms.minFallingNumber) {
    const delta = terms.minFallingNumber - protocol.fallingNumber;
    qualityDelta.push(`число падения ниже на ${roundMetric(delta)} сек.`);
    priceAdjustmentPerTon += Math.ceil(delta * 3);
  }
  if (protocol.weedImpurity > terms.maxWeedImpurity) {
    const delta = protocol.weedImpurity - terms.maxWeedImpurity;
    qualityDelta.push(`сорная примесь выше на ${roundMetric(delta)} п.п.`);
    priceAdjustmentPerTon += Math.ceil(delta * 70);
  }
  if (protocol.grainImpurity > terms.maxGrainImpurity) {
    const delta = protocol.grainImpurity - terms.maxGrainImpurity;
    qualityDelta.push(`зерновая примесь выше на ${roundMetric(delta)} п.п.`);
    priceAdjustmentPerTon += Math.ceil(delta * 45);
  }
  if (protocol.infestation !== 'не обнаружена') {
    qualityDelta.push(`заражённость: ${protocol.infestation}`);
    priceAdjustmentPerTon += 500;
  }

  const priceAdjustment = Math.round(priceAdjustmentPerTon * executionCase.commodity.volumeDeclaredTons);
  const hasDelta = qualityDelta.length > 0;

  return {
    protocol,
    qualityDelta,
    priceAdjustmentPerTon,
    priceAdjustment,
    holdAmount: priceAdjustment,
    disputeTrigger: hasDelta,
    bankStatus: hasDelta ? 'качество не закрыто / есть корректировка' : 'качество закрыто без корректировки',
    nextRoleTask: hasDelta
      ? 'Покупатель и продавец получают уведомление; спор получает potential trigger; банк видит удержание по качеству.'
      : 'Лаборатория передаёт протокол в документную матрицу и банк получает закрытый показатель качества.',
  };
}

export function calculateDisputeMoneyImpact(
  executionCase: DealExecutionCase,
  input: DisputeMoneyImpactInput,
): DisputeMoneyImpactResult {
  const missingEvidenceIds = input.evidenceIds.filter((id) => !input.reviewedEvidenceIds.includes(id));
  const evidenceComplete = input.evidenceIds.length > 0 && missingEvidenceIds.length === 0;
  const hasDecisionBasis = Boolean(input.decision && input.regulationPoint && evidenceComplete);
  const claimedAmount = Math.min(input.claimedAmount, executionCase.money.reserveAmount);
  const heldAmount = hasDecisionBasis && input.decision === 'release'
    ? 0
    : Math.min(input.decisionHoldAmount ?? claimedAmount, executionCase.money.reserveAmount);
  const readyToReleaseAmount = hasDecisionBasis && (input.decision === 'partial_release' || input.decision === 'release')
    ? Math.min(input.decisionReleaseAmount ?? (executionCase.money.reserveAmount - heldAmount), executionCase.money.reserveAmount)
    : 0;

  return {
    disputeId: input.disputeId,
    type: input.type,
    evidencePackId: `EVP-${input.disputeId}`,
    evidenceComplete,
    missingEvidenceIds,
    claimedAmount,
    heldAmount,
    readyToReleaseAmount,
    bankBasisStatus: hasDecisionBasis
      ? 'решение арбитра готово как основание для ручной проверки банка'
      : 'банк ждёт решение арбитра, доказательства и пункт регламента',
    arbitratorCanDecide: hasDecisionBasis,
    nextRoleTask: hasDecisionBasis
      ? 'Банк получает основание; поддержка следит за ручным подтверждением и SLA.'
      : 'Арбитр должен просмотреть доказательства, указать пункт регламента и сумму удержания/расчёта.',
    auditEvent: {
      time: 'manual',
      actor: 'arbitrator',
      action: hasDecisionBasis ? 'dispute_decision_basis_ready' : 'dispute_decision_blocked',
      note: `${input.type}: evidence ${input.reviewedEvidenceIds.length}/${input.evidenceIds.length}; held ${formatRub(heldAmount)}; release ${formatRub(readyToReleaseAmount)}`,
      status: hasDecisionBasis ? 'зафиксировано' : 'проверить',
    },
  };
}

export function createSupportTicket(input: SupportTicketInput): SupportTicket {
  const slaDeadline = new Date(new Date(input.createdAt).getTime() + input.slaHours * 60 * 60 * 1000).toISOString();

  return {
    ticketId: input.ticketId,
    linkedDealId: input.linkedDealId,
    linkedDocumentId: input.linkedDocumentId,
    linkedTripId: input.linkedTripId,
    linkedDisputeId: input.linkedDisputeId,
    category: input.category,
    priority: input.priority,
    slaDeadline,
    moneyAtRisk: input.moneyAtRisk,
    ownerRole: input.ownerRole,
    nextAction: input.nextAction,
    escalationPath: input.escalationPath,
    status: 'open',
    auditEvents: [
      {
        time: input.createdAt,
        actor: 'support',
        action: 'support_ticket_created',
        note: `${input.linkedDealId}: ${input.category}; owner ${input.ownerRole}; money at risk ${formatRub(input.moneyAtRisk)}`,
        status: 'зафиксировано',
      },
    ],
  };
}

export function createRoleNotification(input: RoleNotification): RoleNotification {
  return { ...input };
}

function roundTons(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatRub(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value) + ' ₽';
}

export function formatTons(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(value) + ' т';
}

export function executionReadinessScore(): number {
  const deal = DL_9106_EXECUTION_CASE;
  const gates = [
    !isSdizLifecycleBlockingMoneyRelease(deal.dealId),
    !isTransportPackBlockingBankBasis(deal.logistics.epdPackage),
    deal.money.reconciliationStatus === 'ready',
    deal.quality.labProtocol !== 'ожидается',
    (deal.documents ?? []).every((doc) => !doc.moneyImpact.includes('останавливает')),
  ];
  return Math.round((gates.filter(Boolean).length / gates.length) * 100);
}

export function executionBlockers(): string[] {
  const deal = DL_9106_EXECUTION_CASE;
  const blockers: string[] = [];
  if (isSdizLifecycleBlockingMoneyRelease(deal.dealId)) blockers.push('СДИЗ не закрыт');
  if (isTransportPackBlockingBankBasis(deal.logistics.epdPackage)) blockers.push('ЭТрН/ГИС ЭПД не закрыты');
  if (deal.money.reconciliationStatus !== 'ready') blockers.push('банк ждёт подтверждение');
  if (deal.quality.labProtocol === 'ожидается') blockers.push('нет протокола качества');
  if (deal.dispute.status === 'open') blockers.push('есть открытый спор');
  return blockers;
}

export function canRequestMoneyRelease(): boolean {
  return executionBlockers().length === 0 && isDealMoneyStateBalanced(DL_9106_EXECUTION_CASE.money);
}

export function expectedDealAmountRub(): number {
  return DL_9106_EXECUTION_CASE.commodity.volumeDeclaredTons * DL_9106_EXECUTION_CASE.price.pricePerTon;
}

export function executionSummary() {
  return {
    dealId: DL_9106_EXECUTION_CASE.dealId,
    readinessScore: executionReadinessScore(),
    blockers: executionBlockers(),
    canRelease: canRequestMoneyRelease(),
  };
}
