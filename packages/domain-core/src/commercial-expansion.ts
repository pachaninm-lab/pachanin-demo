export type CommercialExpansionStatus = 'exists_partial' | 'foundation_only' | 'missing';

export type InsurancePartnerCapability = {
  id: 'sber_insurance' | 'ingosstrakh' | 'rosgosstrakh';
  name: string;
  cargoInsurance: boolean;
  carrierLiability: boolean;
  apiMode: 'api' | 'manual_or_batch';
  note: string;
};

export type InsuranceWorkflowStage =
  | 'deal_created'
  | 'contracting'
  | 'loading_started'
  | 'gate_in'
  | 'departed'
  | 'arrived_unloading'
  | 'lab_protocol_final'
  | 'ready_to_release'
  | 'released';

export type InsuranceEventRule = {
  stage: InsuranceWorkflowStage;
  offerRequired: boolean;
  canIssuePolicy: boolean;
  blockMoneyReleaseWithoutDecision: boolean;
  evidenceAppend: string[];
  claimTriggers: string[];
};

export const INSURANCE_PARTNERS: InsurancePartnerCapability[] = [
  {
    id: 'sber_insurance',
    name: 'СберСтрахование',
    cargoInsurance: true,
    carrierLiability: true,
    apiMode: 'api',
    note: 'Сильный вариант для потокового страхования груза и увязки со Сбер money rail.'
  },
  {
    id: 'ingosstrakh',
    name: 'Ингосстрах',
    cargoInsurance: true,
    carrierLiability: false,
    apiMode: 'api',
    note: 'Подходит как независимый cargo API контур с хорошей B2B-интеграционной логикой.'
  },
  {
    id: 'rosgosstrakh',
    name: 'Росгосстрах',
    cargoInsurance: true,
    carrierLiability: false,
    apiMode: 'manual_or_batch',
    note: 'Использовать как резервный страховой контур до появления подтверждённого API-потока.'
  }
];

export const INSURANCE_EVENT_RULES: InsuranceEventRule[] = [
  {
    stage: 'deal_created',
    offerRequired: true,
    canIssuePolicy: false,
    blockMoneyReleaseWithoutDecision: false,
    evidenceAppend: ['insurance_offer'],
    claimTriggers: []
  },
  {
    stage: 'contracting',
    offerRequired: true,
    canIssuePolicy: true,
    blockMoneyReleaseWithoutDecision: false,
    evidenceAppend: ['insurance_offer', 'insurance_quote', 'insured_party'],
    claimTriggers: []
  },
  {
    stage: 'loading_started',
    offerRequired: true,
    canIssuePolicy: true,
    blockMoneyReleaseWithoutDecision: false,
    evidenceAppend: ['policy_number', 'cargo_value', 'loading_timestamp'],
    claimTriggers: ['cargo_loss', 'cargo_damage']
  },
  {
    stage: 'gate_in',
    offerRequired: false,
    canIssuePolicy: true,
    blockMoneyReleaseWithoutDecision: false,
    evidenceAppend: ['gate_in_timestamp', 'vehicle_id', 'seal_id'],
    claimTriggers: ['cargo_loss', 'route_incident']
  },
  {
    stage: 'departed',
    offerRequired: false,
    canIssuePolicy: false,
    blockMoneyReleaseWithoutDecision: false,
    evidenceAppend: ['gps_route', 'driver_ack'],
    claimTriggers: ['cargo_loss', 'route_incident', 'delay']
  },
  {
    stage: 'arrived_unloading',
    offerRequired: false,
    canIssuePolicy: false,
    blockMoneyReleaseWithoutDecision: false,
    evidenceAppend: ['gross_weight', 'net_weight', 'arrival_timestamp'],
    claimTriggers: ['weight_shortage', 'cargo_damage', 'quality_degradation']
  },
  {
    stage: 'lab_protocol_final',
    offerRequired: false,
    canIssuePolicy: false,
    blockMoneyReleaseWithoutDecision: true,
    evidenceAppend: ['lab_protocol', 'quality_delta', 'retest_status'],
    claimTriggers: ['quality_degradation']
  },
  {
    stage: 'ready_to_release',
    offerRequired: false,
    canIssuePolicy: false,
    blockMoneyReleaseWithoutDecision: true,
    evidenceAppend: ['insurance_clearance', 'claim_clearance'],
    claimTriggers: []
  },
  {
    stage: 'released',
    offerRequired: false,
    canIssuePolicy: false,
    blockMoneyReleaseWithoutDecision: false,
    evidenceAppend: ['release_reference'],
    claimTriggers: []
  }
];

export type BankRail = {
  id: 'sber' | 'rshb';
  label: string;
  focusSegment: string;
  modes: Array<'reserve' | 'hold' | 'release' | 'credit' | 'nominal_account' | 'statement_callback'>;
  currentState: 'implemented' | 'adapter_needed';
  note: string;
};

export const BANK_RAILS: BankRail[] = [
  {
    id: 'sber',
    label: 'Сбер',
    focusSegment: 'универсальный money rail / safe deal / callback',
    modes: ['reserve', 'hold', 'release', 'credit', 'statement_callback'],
    currentState: 'implemented',
    note: 'Основной текущий банковский контур.'
  },
  {
    id: 'rshb',
    label: 'Россельхозбанк',
    focusSegment: 'КФХ / малые формы / зерновой и сезонный контур',
    modes: ['reserve', 'hold', 'release', 'credit', 'nominal_account', 'statement_callback'],
    currentState: 'adapter_needed',
    note: 'Нужен второй bank adapter с теми же release semantics, что у Сбера.'
  }
];

export type DealEsgInput = {
  distanceKm: number;
  transportType: 'auto' | 'rail';
  tons: number;
  emptyRunFactor?: number;
  routeRiskFactor?: number;
};

const PILOT_EMISSION_FACTORS_KG_CO2E_PER_TKM: Record<'auto' | 'rail', number> = {
  auto: 0.09,
  rail: 0.02
};

export function calculateDealCarbonFootprint(input: DealEsgInput) {
  const distanceKm = Math.max(0, Number(input.distanceKm || 0));
  const tons = Math.max(0, Number(input.tons || 0));
  const emptyRunFactor = input.emptyRunFactor && input.emptyRunFactor > 0 ? input.emptyRunFactor : 1.15;
  const routeRiskFactor = input.routeRiskFactor && input.routeRiskFactor > 0 ? input.routeRiskFactor : 1;
  const factor = PILOT_EMISSION_FACTORS_KG_CO2E_PER_TKM[input.transportType] || PILOT_EMISSION_FACTORS_KG_CO2E_PER_TKM.auto;
  const tonKm = tons * distanceKm;
  const kgCo2e = Number((tonKm * factor * emptyRunFactor * routeRiskFactor).toFixed(2));
  const kgCo2ePerTon = tons > 0 ? Number((kgCo2e / tons).toFixed(2)) : 0;
  return {
    kgCo2e,
    kgCo2ePerTon,
    methodology: 'pilot_default_transport_factor',
    readiness: 'internal_only_until_external_methodology_is_approved'
  };
}

export type QualityDeltaInput = {
  culture: 'wheat' | 'barley' | 'sunflower';
  tons: number;
  expectedMoisture?: number;
  actualMoisture?: number;
  expectedProtein?: number;
  actualProtein?: number;
  expectedOil?: number;
  actualOil?: number;
  expectedForeignMatter?: number;
  actualForeignMatter?: number;
  basePriceRubPerTon: number;
};

export function estimateQualityDeltaRub(input: QualityDeltaInput) {
  const tons = Math.max(0, Number(input.tons || 0));
  const basePrice = Math.max(0, Number(input.basePriceRubPerTon || 0));
  let rubPerTonDelta = 0;

  const moistureDiff = Number(input.actualMoisture || 0) - Number(input.expectedMoisture || 0);
  const foreignMatterDiff = Number(input.actualForeignMatter || 0) - Number(input.expectedForeignMatter || 0);

  if (moistureDiff > 0) rubPerTonDelta -= moistureDiff * 95;
  if (foreignMatterDiff > 0) rubPerTonDelta -= foreignMatterDiff * 130;

  if (input.culture === 'wheat') {
    const proteinDiff = Number(input.actualProtein || 0) - Number(input.expectedProtein || 0);
    if (proteinDiff < 0) rubPerTonDelta += proteinDiff * 140;
    if (proteinDiff > 0) rubPerTonDelta += proteinDiff * 70;
  }

  if (input.culture === 'barley') {
    const proteinDiff = Number(input.actualProtein || 0) - Number(input.expectedProtein || 0);
    if (proteinDiff < 0) rubPerTonDelta += proteinDiff * 80;
  }

  if (input.culture === 'sunflower') {
    const oilDiff = Number(input.actualOil || 0) - Number(input.expectedOil || 0);
    if (oilDiff < 0) rubPerTonDelta += oilDiff * 180;
    if (oilDiff > 0) rubPerTonDelta += oilDiff * 120;
  }

  const totalDeltaRub = Number((rubPerTonDelta * tons).toFixed(2));
  return {
    rubPerTonDelta: Number(rubPerTonDelta.toFixed(2)),
    totalDeltaRub,
    referenceBaseAmountRub: Number((basePrice * tons).toFixed(2))
  };
}

export type PredictiveDisputeInput = {
  hasSignedSpec: boolean;
  hasWitnessSample: boolean;
  hasSecondLab: boolean;
  custodyBreaks: number;
  moistureGap?: number;
  weightShortagePct?: number;
  historicalCounterpartyDisputes?: number;
  historicalLabVariancePct?: number;
};

export function scorePredictiveDispute(input: PredictiveDisputeInput) {
  let sellerSuccess = 50;
  if (input.hasSignedSpec) sellerSuccess += 12;
  if (input.hasWitnessSample) sellerSuccess += 14;
  if (input.hasSecondLab) sellerSuccess += 10;
  sellerSuccess -= Math.max(0, Number(input.custodyBreaks || 0)) * 15;
  sellerSuccess -= Math.max(0, Number(input.historicalCounterpartyDisputes || 0)) * 2;
  sellerSuccess -= Math.max(0, Number(input.historicalLabVariancePct || 0)) * 1.5;
  sellerSuccess -= Math.max(0, Number(input.moistureGap || 0)) * 3;
  sellerSuccess -= Math.max(0, Number(input.weightShortagePct || 0)) * 4;
  sellerSuccess = Math.max(0, Math.min(100, Number(sellerSuccess.toFixed(1))));

  return {
    sellerSuccessProbability: sellerSuccess,
    buyerSuccessProbability: Number((100 - sellerSuccess).toFixed(1)),
    disputeRiskBand: sellerSuccess >= 65 ? 'seller_favored' : sellerSuccess >= 45 ? 'balanced' : 'buyer_favored',
    arbitrationPriority: input.custodyBreaks > 0 || (input.moistureGap || 0) >= 1 ? 'high' : 'normal'
  };
}

export type ExportRouteTemplate = {
  id: string;
  originRegion: string;
  destination: string;
  mode: 'auto_to_port' | 'rail_to_port' | 'mixed';
  cultures: Array<'wheat' | 'barley' | 'sunflower'>;
  requiredDocuments: string[];
  routeMilestones: string[];
  releaseBlockers: string[];
};

export const EXPORT_ROUTE_TEMPLATES: ExportRouteTemplate[] = [
  {
    id: 'tambov-novorossiysk-auto',
    originRegion: 'Тамбовская область',
    destination: 'Новороссийск',
    mode: 'auto_to_port',
    cultures: ['wheat', 'barley', 'sunflower'],
    requiredDocuments: [
      'contract',
      'invoice',
      'sdiz_or_internal_trace',
      'quality_protocol',
      'weighbridge_tickets',
      'carrier_docs',
      'phytosanitary_if_required_by_destination',
      'port_acceptance_slot'
    ],
    routeMilestones: ['farm_gate', 'loading', 'checkpoint', 'port_gate_in', 'port_lab_if_required', 'release'],
    releaseBlockers: ['missing_port_slot', 'missing_quality_protocol', 'open_dispute', 'missing_export_doc']
  },
  {
    id: 'tambov-astrakhan-mixed',
    originRegion: 'Тамбовская область',
    destination: 'Астрахань',
    mode: 'mixed',
    cultures: ['wheat', 'barley'],
    requiredDocuments: [
      'contract',
      'invoice',
      'sdiz_or_internal_trace',
      'quality_protocol',
      'weighbridge_tickets',
      'carrier_docs',
      'phytosanitary_if_required_by_destination',
      'river_or_port_acceptance_slot'
    ],
    routeMilestones: ['farm_gate', 'loading', 'rail_or_auto_leg', 'port_gate_in', 'inspection', 'release'],
    releaseBlockers: ['missing_acceptance_slot', 'inspection_hold', 'open_dispute', 'missing_export_doc']
  }
];

export type CropRolloutInput = {
  closedWheatDeals: number;
  successfulReleases: number;
  openQualityDisputes: number;
  controlledPilotMode: boolean;
};

export function recommendCropExpansion(input: CropRolloutInput) {
  const readyBase = input.closedWheatDeals >= 5 && input.successfulReleases >= 5 && input.openQualityDisputes <= 2 && input.controlledPilotMode;
  return {
    canExpandToBarley: readyBase,
    canExpandToSunflower: readyBase && input.closedWheatDeals >= 10,
    policy: readyBase
      ? 'expand_with_same_execution_rail_but_with_culture_specific_quality_and_settlement_rules'
      : 'stay_on_wheat_until_execution_discipline_is_proven'
  };
}

export type ExpansionAssessment = {
  module: string;
  repoStatus: CommercialExpansionStatus;
  decision: 'bring_to_ideal' | 'implement_from_foundation';
  reason: string;
};

export const EXPANSION_ASSESSMENT: ExpansionAssessment[] = [
  {
    module: 'insurance_workflow',
    repoStatus: 'exists_partial',
    decision: 'bring_to_ideal',
    reason: 'Есть UI и страховой поток, но нужен event-driven release и claim clearance внутри сделки.'
  },
  {
    module: 'rshb_bank_adapter',
    repoStatus: 'foundation_only',
    decision: 'implement_from_foundation',
    reason: 'Есть bank abstractions и банковый контур, но нет второго полноценного адаптера.'
  },
  {
    module: 'esg_deal_tracker',
    repoStatus: 'foundation_only',
    decision: 'implement_from_foundation',
    reason: 'Маршрут, тоннаж и транспорт уже есть; не хватает расчётного и документного слоя.'
  },
  {
    module: 'predictive_quality_arbitration',
    repoStatus: 'foundation_only',
    decision: 'implement_from_foundation',
    reason: 'Есть lab/dispute/settlement data, но нет модели ожидания price delta и вероятности исхода спора.'
  },
  {
    module: 'export_route_templates',
    repoStatus: 'foundation_only',
    decision: 'implement_from_foundation',
    reason: 'Есть route/export surfaces, но нет corridor templates с документными гейтами.'
  },
  {
    module: 'adjacent_crop_rollout',
    repoStatus: 'exists_partial',
    decision: 'bring_to_ideal',
    reason: 'Культуры уже заведены, но rollout должен быть gated по сделкам и quality rules.'
  }
];
