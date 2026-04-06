import { getRuntimeSnapshot } from './runtime-server';
import {
  BANK_RAILS,
  EXPORT_ROUTE_TEMPLATES,
  EXPANSION_ASSESSMENT,
  INSURANCE_EVENT_RULES,
  INSURANCE_PARTNERS,
  calculateDealCarbonFootprint,
  estimateQualityDeltaRub,
  recommendCropExpansion,
  scorePredictiveDispute,
} from '../../../packages/domain-core/src/commercial-expansion';

function normalizeCulture(value?: string | null) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'wheat';
  if (raw.includes('подсол')) return 'sunflower';
  if (raw.includes('ячм')) return 'barley';
  return 'wheat';
}

function mapDealStatusToInsuranceStage(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (normalized.includes('DRAFT') || normalized.includes('CONTRACT')) return 'contracting';
  if (normalized.includes('LOAD')) return 'loading_started';
  if (normalized.includes('TRANSIT') || normalized.includes('DEPART')) return 'departed';
  if (normalized.includes('QUALITY')) return 'lab_protocol_final';
  if (normalized.includes('PAYMENT') || normalized.includes('READY')) return 'ready_to_release';
  return 'deal_created';
}

function defaultDistanceByCulture(culture: 'wheat' | 'barley' | 'sunflower') {
  if (culture === 'sunflower') return 260;
  if (culture === 'barley') return 220;
  return 240;
}

export async function getCommercialExpansionReadModel() {
  const snapshot = await getRuntimeSnapshot();
  const deals = Array.isArray((snapshot as any).deals) ? (snapshot as any).deals : [];
  const disputes = Array.isArray((snapshot as any).disputes) ? (snapshot as any).disputes : [];
  const labSamples = Array.isArray((snapshot as any).labSamples) ? (snapshot as any).labSamples : [];
  const payments = Array.isArray((snapshot as any).payments) ? (snapshot as any).payments : [];

  const primaryDeal = deals[0] || null;
  const primaryCulture = normalizeCulture(primaryDeal?.culture);
  const primaryStage = mapDealStatusToInsuranceStage(primaryDeal?.status);
  const insuranceRule = INSURANCE_EVENT_RULES.find((item) => item.stage === primaryStage) || INSURANCE_EVENT_RULES[0];
  const primaryLab = labSamples.find((item: any) => item.dealId === primaryDeal?.id) || null;
  const primaryDispute = disputes.find((item: any) => item.dealId === primaryDeal?.id) || null;
  const primaryPayment = payments.find((item: any) => item.dealId === primaryDeal?.id) || null;

  const tons = Number(primaryDeal?.volume || primaryDeal?.volumeTons || 0) || 0;
  const distanceKm = defaultDistanceByCulture(primaryCulture as any);
  const esg = calculateDealCarbonFootprint({
    distanceKm,
    tons,
    transportType: 'auto',
  });

  const qualityDelta = estimateQualityDeltaRub({
    culture: primaryCulture as any,
    tons,
    expectedMoisture: 13,
    actualMoisture: primaryLab?.status === 'RETEST' ? 14.8 : 13.6,
    expectedProtein: 12,
    actualProtein: primaryCulture === 'wheat' ? 11.2 : 11,
    expectedOil: primaryCulture === 'sunflower' ? 46 : undefined,
    actualOil: primaryCulture === 'sunflower' ? 44.5 : undefined,
    expectedForeignMatter: 2,
    actualForeignMatter: primaryLab?.status === 'RETEST' ? 3.2 : 2.3,
    basePriceRubPerTon: Math.round((Number(primaryPayment?.amount || 0) || 0) / Math.max(tons, 1)) || 17000,
  });

  const predictiveDispute = scorePredictiveDispute({
    hasSignedSpec: true,
    hasWitnessSample: true,
    hasSecondLab: String(primaryLab?.status || '').toUpperCase() === 'RETEST',
    custodyBreaks: primaryDispute ? 1 : 0,
    moistureGap: Math.max(0, (primaryLab?.status === 'RETEST' ? 1.8 : 0.6)),
    weightShortagePct: primaryDispute ? 0.9 : 0.2,
    historicalCounterpartyDisputes: disputes.length,
    historicalLabVariancePct: primaryLab?.status === 'RETEST' ? 1.2 : 0.4,
  });

  const cropRollout = recommendCropExpansion({
    closedWheatDeals: deals.filter((item: any) => normalizeCulture(item.culture) === 'wheat').length,
    successfulReleases: payments.filter((item: any) => ['COMPLETED', 'PAID', 'RELEASED', 'VERIFIED'].includes(String(item.status || '').toUpperCase())).length,
    openQualityDisputes: disputes.filter((item: any) => String(item.topic || '').toLowerCase().includes('quality') && !['EXECUTED', 'CLOSED', 'DECISION'].includes(String(item.status || '').toUpperCase())).length,
    controlledPilotMode: true,
  });

  return {
    meta: {
      source: 'commercial-expansion.read-model',
      updatedAt: new Date().toISOString(),
      primaryDealId: primaryDeal?.id || null,
    },
    modules: {
      insurance: {
        assessment: EXPANSION_ASSESSMENT.find((item) => item.module === 'insurance_workflow'),
        currentDealId: primaryDeal?.id || null,
        currentStage: primaryStage,
        currentPolicyGate: {
          offerRequired: insuranceRule.offerRequired,
          canIssuePolicy: insuranceRule.canIssuePolicy,
          blockMoneyReleaseWithoutDecision: insuranceRule.blockMoneyReleaseWithoutDecision,
        },
        evidenceAppend: insuranceRule.evidenceAppend,
        claimTriggers: insuranceRule.claimTriggers,
        partners: INSURANCE_PARTNERS,
      },
      banks: {
        assessment: EXPANSION_ASSESSMENT.find((item) => item.module === 'rshb_bank_adapter'),
        rails: BANK_RAILS,
        primaryReleaseState: primaryPayment?.status || null,
        parityGap: 'Нужен adapter parity для reserve / hold / release / statement callback / credit application.',
      },
      esg: {
        assessment: EXPANSION_ASSESSMENT.find((item) => item.module === 'esg_deal_tracker'),
        currentDealId: primaryDeal?.id || null,
        tons,
        distanceKm,
        transportType: 'auto',
        carbon: esg,
      },
      predictive: {
        assessment: EXPANSION_ASSESSMENT.find((item) => item.module === 'predictive_quality_arbitration'),
        currentDealId: primaryDeal?.id || null,
        qualityDelta,
        predictiveDispute,
      },
      exportRoutes: {
        assessment: EXPANSION_ASSESSMENT.find((item) => item.module === 'export_route_templates'),
        templates: EXPORT_ROUTE_TEMPLATES,
      },
      crops: {
        assessment: EXPANSION_ASSESSMENT.find((item) => item.module === 'adjacent_crop_rollout'),
        rollout: cropRollout,
        currentlySupportedInEntry: ['wheat', 'barley', 'sunflower'],
      },
    },
    actions: [
      {
        id: 'insurance-release-gate',
        title: 'Привязать insurance clearance к money release',
        owner: 'finance / operator',
        href: primaryDeal?.id ? `/insurance?dealId=${primaryDeal.id}` : '/insurance',
      },
      {
        id: 'rshb-adapter',
        title: 'Поднять второй bank adapter для РСХБ',
        owner: 'bank integrations',
        href: '/sber',
      },
      {
        id: 'export-corridors',
        title: 'Открыть corridor templates для Тамбова',
        owner: 'logistics / documents',
        href: '/export-packs',
      },
    ],
  };
}
