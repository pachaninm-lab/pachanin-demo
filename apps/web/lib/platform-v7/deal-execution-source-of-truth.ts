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
    calculationFormula: '16 080 ₽/т × 600 т = 9 648 000 ₽; выпуск 0 ₽ до закрытия банка, СДИЗ, ЭТрН, ГИС ЭПД, приёмки и качества',
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
    partyStatus: 'партия создана · ручная проверка',
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
        tripId: 'TRIP-SIM-001',
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
        tripId: 'TRIP-SIM-002',
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
        tripId: 'TRIP-SIM-003',
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
  documents: [
    {
      documentId: 'DOC-DL-9106-CONTRACT',
      title: 'Договор',
      status: 'черновик',
      source: 'ЭДО · тестовый контур',
      responsibleRole: 'seller',
      signerRole: 'seller + buyer',
      signatureType: 'КЭП / МЧД',
      externalSystem: 'EDO',
      blocksStage: 'documents',
      moneyImpact: 'не выпускает деньги без подписания',
      nextAction: 'подписать договор',
      auditEvents: [],
    },
    {
      documentId: 'DOC-DL-9106-SDIZ-ISSUED',
      title: 'СДИЗ оформлен',
      status: 'не оформлен',
      source: 'ФГИС Зерно · ручная проверка',
      responsibleRole: 'seller',
      signerRole: 'seller',
      signatureType: 'КЭП',
      externalSystem: 'FGIS_GRAIN',
      blocksStage: 'money_release',
      moneyImpact: 'останавливает выпуск',
      nextAction: 'оформить СДИЗ вручную и отметить проверку',
      auditEvents: [],
    },
    {
      documentId: 'DOC-DL-9106-UPD',
      title: 'УПД',
      status: 'ожидает подписи',
      source: 'ЭДО · тестовый контур',
      responsibleRole: 'buyer',
      signerRole: 'seller + buyer',
      signatureType: 'КЭП / МЧД',
      externalSystem: 'EDO',
      blocksStage: 'money_release',
      moneyImpact: 'останавливает выпуск до подписания',
      nextAction: 'подписать УПД после приёмки',
      auditEvents: [],
    },
    {
      documentId: 'DOC-DL-9106-SDIZ-REDEEMED',
      title: 'СДИЗ погашен покупателем',
      status: 'не погашен',
      source: 'ФГИС Зерно · ручная проверка',
      responsibleRole: 'buyer',
      signerRole: 'buyer',
      signatureType: 'КЭП',
      externalSystem: 'FGIS_GRAIN',
      blocksStage: 'money_release',
      moneyImpact: 'останавливает выпуск',
      nextAction: 'погасить СДИЗ после приёмки или зафиксировать отказ',
      auditEvents: [],
    },
    {
      documentId: 'DOC-DL-9106-ETRN',
      title: 'ЭТрН',
      status: 'не закрыта всеми сторонами',
      source: 'ИС ЭПД · требуется оператор',
      responsibleRole: 'logistics',
      signerRole: 'shipper + carrier + driver + consignee',
      signatureType: 'КЭП / простая подпись водителя по регламенту пилота',
      externalSystem: 'EPD_OPERATOR',
      blocksStage: 'money_release',
      moneyImpact: 'останавливает транспортное основание',
      nextAction: 'создать транспортный пакет и собрать подписи',
      auditEvents: [],
    },
    {
      documentId: 'DOC-DL-9106-GIS-EPD',
      title: 'ГИС ЭПД статус',
      status: 'ожидает закрытия ЭТрН',
      source: 'ГИС ЭПД · ожидает внешнее подтверждение',
      responsibleRole: 'logistics',
      signerRole: 'operator',
      signatureType: 'системная передача',
      externalSystem: 'GIS_EPD',
      blocksStage: 'bank_basis',
      moneyImpact: 'банк не видит полное транспортное основание',
      nextAction: 'передать пакет после закрытия титулов',
      auditEvents: [],
    },
    {
      documentId: 'DOC-DL-9106-KEP-MCHD',
      title: 'КЭП/МЧД',
      status: 'не подписан',
      source: 'КриптоПро DSS · ручная проверка полномочий',
      responsibleRole: 'compliance',
      signerRole: 'authorized_representative',
      signatureType: 'КЭП / МЧД',
      externalSystem: 'SIGNATURE_AUTHORITY',
      blocksStage: 'documents',
      moneyImpact: 'ошибка полномочий останавливает ЭДО и банковое основание',
      nextAction: 'проверить сертификат и полномочия подписанта',
      auditEvents: [],
    },
    {
      documentId: 'DOC-DL-9106-ACCEPTANCE-ACT',
      title: 'Акт приёмки',
      status: 'ожидает приёмки',
      source: 'Элеватор + ЭДО · ручная проверка',
      responsibleRole: 'elevator',
      signerRole: 'elevator + buyer',
      signatureType: 'КЭП / ручная отметка пилота',
      externalSystem: 'ELEVATOR_EDO',
      blocksStage: 'money_release',
      moneyImpact: 'без приёмки банк не получает основание',
      nextAction: 'зафиксировать приёмку после прибытия рейса',
      auditEvents: [],
    },
    {
      documentId: 'DOC-DL-9106-DISCREPANCY-ACT',
      title: 'Акт расхождения',
      status: 'требуется при отклонении',
      source: 'Элеватор + стороны сделки',
      responsibleRole: 'elevator',
      signerRole: 'seller + buyer + elevator',
      signatureType: 'КЭП / ручная отметка пилота',
      externalSystem: 'ELEVATOR_EDO',
      blocksStage: 'conditional_money_hold',
      moneyImpact: 'создаёт удержание при отклонении веса или качества',
      nextAction: 'создать draft акта при отклонении',
      auditEvents: [],
    },
    {
      documentId: 'DOC-DL-9106-QUALITY-PROTOCOL',
      title: 'Протокол качества',
      status: 'ожидается',
      source: 'Лабораторный контур · ручной протокол',
      responsibleRole: 'lab',
      signerRole: 'lab',
      signatureType: 'КЭП лаборатории',
      externalSystem: 'LAB_MANUAL',
      blocksStage: 'money_release',
      moneyImpact: 'качество может создать корректировку и удержание',
      nextAction: 'внести структурированный протокол',
      auditEvents: [],
    },
    {
      documentId: 'DOC-DL-9106-TR-TS-015',
      title: 'ТР ТС 015/2011 / документ соответствия',
      status: 'ожидает подтверждения применимости',
      source: 'Документ безопасности зерна · ручная проверка',
      responsibleRole: 'compliance',
      signerRole: 'seller',
      signatureType: 'КЭП / документ поставщика',
      externalSystem: 'MANUAL_COMPLIANCE',
      blocksStage: 'documents',
      moneyImpact: 'может остановить выпуск при обязательности документа',
      nextAction: 'подтвердить применимость и приложить документ',
      auditEvents: [],
    },
    {
      documentId: 'DOC-DL-9106-SURVEYOR-REPORT',
      title: 'Отчёт сюрвейера',
      status: 'не назначен',
      source: 'Сюрвейер · evidence pack',
      responsibleRole: 'surveyor',
      signerRole: 'surveyor',
      signatureType: 'КЭП / ручная отметка пилота',
      externalSystem: 'SURVEYOR_MANUAL',
      blocksStage: 'conditional_dispute_evidence',
      moneyImpact: 'усиливает доказательства при споре',
      nextAction: 'назначить проверку при инциденте',
      auditEvents: [],
    },
    {
      documentId: 'DOC-DL-9106-BANK-BASIS',
      title: 'Банковое основание',
      status: 'не сформировано',
      source: 'Банк · ожидает внешний callback или ручное подтверждение',
      responsibleRole: 'bank',
      signerRole: 'bank',
      signatureType: 'bank_callback_or_manual_mark',
      externalSystem: 'BANK',
      blocksStage: 'money_release',
      moneyImpact: 'без основания деньги не готовы к подтверждению банка',
      nextAction: 'сформировать основание после документов, СДИЗ, ЭПД, качества и приёмки',
      auditEvents: [],
    },
    {
      documentId: 'DOC-DL-9106-DISPUTE-DECISION',
      title: 'Решение по спору',
      status: 'не требуется',
      source: 'Арбитраж · evidence pack',
      responsibleRole: 'arbitrator',
      signerRole: 'arbitrator',
      signatureType: 'КЭП / ручная отметка пилота',
      externalSystem: 'ARBITRATION_MANUAL',
      blocksStage: 'conditional_money_hold',
      moneyImpact: 'меняет выпуск или удержание при споре',
      nextAction: 'создать решение при открытом споре',
      auditEvents: [],
    },
    {
      documentId: 'DOC-DL-9106-ACCEPTED-WEIGHT',
      title: 'Акт зачётного веса',
      status: 'ожидает веса',
      source: 'Элеватор · весовая',
      responsibleRole: 'elevator',
      signerRole: 'elevator',
      signatureType: 'КЭП / ручная отметка пилота',
      externalSystem: 'ELEVATOR_MANUAL',
      blocksStage: 'money_release',
      moneyImpact: 'зачётный вес влияет на сумму к выплате или удержанию',
      nextAction: 'зафиксировать брутто, тару, нетто и зачётный вес',
      auditEvents: [],
    },
    {
      documentId: 'DOC-DL-9106-PD-BASIS',
      title: 'Согласие/основание ПДн',
      status: 'ручная проверка основания',
      source: '152-ФЗ · комплаенс',
      responsibleRole: 'compliance',
      signerRole: 'counterparty_representative',
      signatureType: 'согласие / договорное основание',
      externalSystem: 'PERSONAL_DATA_MANUAL',
      blocksStage: 'compliance_gate',
      moneyImpact: 'комплаенс-стоп не даёт перейти к резерву или выплате',
      nextAction: 'проверить основание обработки ПДн',
      auditEvents: [],
    },
    {
      documentId: 'DOC-DL-9106-PLATFORM-RULES',
      title: 'Договор присоединения / правила платформы',
      status: 'приняты в тестовом контуре',
      source: 'Правила платформы · controlled pilot',
      responsibleRole: 'compliance',
      signerRole: 'seller + buyer',
      signatureType: 'акцепт правил',
      externalSystem: 'PLATFORM_RULES',
      blocksStage: 'onboarding',
      moneyImpact: 'без правил участник не допускается к пилоту',
      nextAction: 'подтвердить акцепт правил пилота',
      auditEvents: [],
    },
  ],
  dispute: {
    status: 'нет активного спора',
    evidencePack: 'создаётся при отклонении веса, качества, СДИЗ или ЭПД',
    moneyImpact: 0,
  },
  rolesState: {
    sellerNextAction: 'оформить СДИЗ и подписать договор',
    buyerNextAction: 'ждать приёмки, затем погасить СДИЗ',
    logisticsNextAction: 'закрыть транспортный пакет по 3 рейсам и подготовить передачу в ГИС ЭПД',
    driverNextAction: 'принять рейс после назначения',
    elevatorNextAction: 'зафиксировать прибытие и вес',
    labNextAction: 'ждать пробу',
    bankNextAction: 'ждать полный пакет оснований',
    complianceNextAction: 'проверить полномочия и ПДн основания',
    arbitratorNextAction: 'нет спора',
    supportNextAction: 'следить за SLA документных блокеров',
  },
  auditEvents: [
    { time: '09:50', actor: 'Оператор', action: 'Создан черновик сделки', note: 'Условия из принятой ставки Покупателя 1 по LOT-2403', status: 'зафиксировано' },
    { time: '09:52', actor: 'Оператор', action: 'Запущена проверка готовности', note: 'ФГИС, документы, логистика, банк, спор', status: 'зафиксировано' },
    { time: '10:05', actor: 'ФГИС', action: 'Партия поставлена на ручную проверку', note: 'ФГИС-68-2403-001 — внешний контур не подтверждён автоматически', status: 'проверить' },
    { time: '10:12', actor: 'Банк', action: 'Запрос резерва денег', note: 'Покупатель 1 готов к резерву, решение банка ожидается', status: 'проверить' },
    { time: '10:15', actor: 'Логистика', action: 'Перевозчик назначен', note: 'Создана заявка LOG-REQ-2403 и 3 рейса: TRIP-SIM-001, TRIP-SIM-002, TRIP-SIM-003', status: 'проверить' },
  ],
};

export const DEAL_EXECUTION_CASES: readonly DealExecutionCase[] = [DL_9106_EXECUTION_CASE];

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
    return normalized.includes('money') || normalized.includes('выпуск') || normalized.includes('банк');
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
      : 'Арбитр должен просмотреть доказательства, указать пункт регламента и сумму удержания/выпуска.',
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
  return Math.round(value * 10) / 10;
}

const PRIMARY_EXECUTION_CASE = DL_9106_EXECUTION_CASE;

export const PLATFORM_V7_EXECUTION_SOURCE: {
  deal: ExecutionDeal;
  readiness: {
    fgis: ReadinessGate;
    quality: ReadinessGate;
    logistics: ReadinessGate;
    documents: ReadinessGate;
    bank: ReadinessGate;
    dispute: ReadinessGate;
    antiBypass: ReadinessGate;
  };
  money: ExecutionMoney;
  logistics: ExecutionLogistics;
  documents: ExecutionDocuments;
  dispute: ExecutionDispute;
  audit: AuditEvent[];
} = {
  deal: {
    id: PRIMARY_EXECUTION_CASE.dealId,
    lotId: PRIMARY_EXECUTION_CASE.lotId,
    fgisPartyId: PRIMARY_EXECUTION_CASE.fgis.partyId,
    crop: `${PRIMARY_EXECUTION_CASE.commodity.crop} ${PRIMARY_EXECUTION_CASE.commodity.class}`,
    volumeTons: PRIMARY_EXECUTION_CASE.commodity.volumeDeclaredTons,
    priceRubPerTon: PRIMARY_EXECUTION_CASE.price.pricePerTon,
    seller: 'КФХ «Северное поле»',
    buyerAlias: 'Покупатель 1',
    buyerDisclosure: 'раскрыт только внутри черновика сделки',
    basis: 'самовывоз с элеватора',
    status: 'черновик сделки',
    maturity: 'тестовый режим',
  },
  readiness: {
    fgis: { status: 'проверить', blocker: 'статус ФГИС на ручной проверке', note: 'Партия ФГИС-68-2403-001 создана, автоматическое подтверждение внешнего контура не подключено' },
    quality: { status: 'проверить', blocker: 'лаборатория нужна на приёмке', note: 'Показатели заполнены, лабораторная приёмка ещё не пройдена' },
    logistics: { status: 'проверить', blocker: 'слот вывоза не подтверждён', note: 'Перевозчик назначен, слот погрузки требует подтверждения' },
    documents: { status: 'проверить', blocker: 'СДИЗ не оформлен', note: 'Договор черновик, СДИЗ и транспортный пакет ещё не готовы' },
    bank: { status: 'проверить', blocker: 'резерв денег не подтверждён', note: 'Покупатель готов к резерву, банк ещё не принял решение' },
    dispute: { status: 'готово', blocker: '', note: 'Нет активных удержаний и споров' },
    antiBypass: { status: 'готово', blocker: '', note: 'Контакты сторон не раскрыты вне черновика сделки' },
  },
  money: {
    reservedRub: PRIMARY_EXECUTION_CASE.money.reserveAmount,
    holdRub: PRIMARY_EXECUTION_CASE.money.heldAmount,
    releaseCandidateRub: PRIMARY_EXECUTION_CASE.money.readyToReleaseAmount,
    buyerMoneyStatus: 'готов к резерву',
    bankDecision: 'проверить',
  },
  logistics: {
    orderId: PRIMARY_EXECUTION_CASE.logistics.logisticsOrderId,
    tripId: PRIMARY_EXECUTION_CASE.logistics.trips[0]?.tripId ?? '',
    carrier: 'ТК «Южные маршруты»',
    driverAlias: PRIMARY_EXECUTION_CASE.logistics.trips[0]?.driverAlias ?? '',
    vehicleMasked: PRIMARY_EXECUTION_CASE.logistics.trips[0]?.vehicleMasked ?? '',
    pickupPoint: PRIMARY_EXECUTION_CASE.logistics.trips[0]?.pickupPoint ?? '',
    deliveryPoint: PRIMARY_EXECUTION_CASE.logistics.trips[0]?.deliveryPoint ?? '',
    eta: PRIMARY_EXECUTION_CASE.logistics.trips[0]?.eta ?? '',
    currentLeg: PRIMARY_EXECUTION_CASE.logistics.trips[0]?.currentLeg ?? '',
    incidentStatus: 'нет инцидентов',
    gateStatus: 'проверить',
  },
  documents: {
    contractStatus: 'черновик',
    sdizStatus: 'не оформлен',
    transportPackStatus: 'не готов',
    edoStatus: 'не запущен',
    kepStatus: 'не подписан',
    missingDocuments: ['СДИЗ', 'транспортный пакет', 'КЭП продавца'],
  },
  dispute: {
    status: 'готово',
    holdReason: '',
    evidenceCount: 0,
    arbitratorNeeded: false,
  },
  audit: [
    ...PRIMARY_EXECUTION_CASE.auditEvents,
  ],
};

const READINESS_GATE_KEYS = ['fgis', 'quality', 'logistics', 'documents', 'bank', 'dispute', 'antiBypass'] as const;
type ReadinessKey = typeof READINESS_GATE_KEYS[number];

export function formatRub(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
}

export function formatTons(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(value)} т`;
}

export function executionReadinessScore(): number {
  const gates = READINESS_GATE_KEYS.map((key: ReadinessKey) => PLATFORM_V7_EXECUTION_SOURCE.readiness[key]);
  const ready = gates.filter((g) => g.status === 'готово').length;
  return Math.round((ready / gates.length) * 100);
}

export function executionBlockers(): string[] {
  const gates = READINESS_GATE_KEYS.map((key: ReadinessKey) => PLATFORM_V7_EXECUTION_SOURCE.readiness[key]);
  return gates.filter((g) => g.status !== 'готово' && g.blocker !== '').map((g) => g.blocker);
}

export function canRequestMoneyRelease(): boolean {
  const { readiness, money } = PLATFORM_V7_EXECUTION_SOURCE;
  return (
    readiness.bank.status === 'готово' &&
    readiness.documents.status === 'готово' &&
    readiness.logistics.status === 'готово' &&
    readiness.dispute.status === 'готово' &&
    money.holdRub === 0
  );
}

export function expectedDealAmountRub(): number {
  const { deal } = PLATFORM_V7_EXECUTION_SOURCE;
  return deal.volumeTons * deal.priceRubPerTon;
}

export function executionSummary() {
  const { deal, money, logistics } = PLATFORM_V7_EXECUTION_SOURCE;
  return {
    dealId: deal.id,
    lotId: deal.lotId,
    fgisPartyId: deal.fgisPartyId,
    logisticsOrderId: logistics.orderId,
    tripId: logistics.tripId,
    readinessScore: executionReadinessScore(),
    blockers: executionBlockers(),
    blockersCount: executionBlockers().length,
    canRelease: canRequestMoneyRelease(),
    reservedRub: money.reservedRub,
    holdRub: money.holdRub,
    releaseCandidateRub: money.releaseCandidateRub,
    calculationFormula: PRIMARY_EXECUTION_CASE.money.calculationFormula,
    bankStatus: PRIMARY_EXECUTION_CASE.money.bankStatus,
    reconciliationStatus: PRIMARY_EXECUTION_CASE.money.reconciliationStatus,
    maturity: deal.maturity,
  };
}
