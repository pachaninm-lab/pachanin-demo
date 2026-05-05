import type { ExecutionBlocker, NextAction, RoleExecutionSummary, UserRole } from './types';
import {
  disputes,
  documents,
  elevatorOperations,
  evidencePacks,
  grainBatches,
  logisticsIncidents,
  logisticsOrders,
  marketLots,
  offers,
  qualityDeltas,
  rfqs,
  sampleChains,
  sdizGates,
  weightBalances,
} from './mock-data';
import { calculateBatchReadiness } from './automation/readiness-engine';
import { calculateMoneyProjection } from './automation/money-release-engine';
import { calculateNetback, rankOffersByNetback } from './automation/netback-engine';
import { matchBatchesToRfq } from './automation/matching-engine';
import { summarizeDocuments } from './automation/document-requirement-engine';
import { getSdizGateBlockers } from './automation/sdiz-gate-engine';
import { createSupportCases, summarizeSupport } from './automation/support-case-engine';
import { createRequiredAuditEvents } from './automation/audit-event-engine';
import { projectSummaryForRole } from './automation/role-visibility-engine';

const createdAt = '2026-05-05T09:00:00.000Z';

function isNextAction(action: NextAction | undefined): action is NextAction {
  return Boolean(action);
}

export function getGrainExecutionContext() {
  const primaryBatch = grainBatches[0];
  const primaryLot = marketLots[0];
  const primaryRfq = rfqs[0];
  const primaryLogisticsOrder = logisticsOrders[0];
  const primaryElevatorOperation = elevatorOperations[0];
  const primaryWeightBalance = weightBalances[0];
  const primaryQualityDelta = qualityDeltas[0];
  const primarySdizGates = sdizGates.filter((gate) => gate.dealId === 'DL-GRAIN-450' || gate.batchId === primaryBatch.id);
  const primaryDocuments = documents.filter((document) => document.dealId === 'DL-GRAIN-450');
  const netbacks = rankOffersByNetback(
    offers.map((offer) =>
      calculateNetback({
        id: `NB-${offer.id}`,
        batchId: offer.batchId ?? primaryBatch.id,
        offer,
        logisticsCostPerTon: offer.basis === 'CPT' ? 820 : 0,
        paymentDelayDays: offer.paymentTerms === 'after_documents' ? 7 : offer.paymentTerms === 'after_acceptance' ? 2 : 0,
        createdAt,
      }),
    ),
  );
  const rfqMatches = matchBatchesToRfq(primaryRfq, grainBatches);
  const readiness = calculateBatchReadiness(primaryBatch, primaryDocuments, primarySdizGates);
  const moneyProjection = calculateMoneyProjection({
    dealId: 'DL-GRAIN-450',
    grossDealAmount: 3564000,
    reservedAmount: 3564000,
    documents: primaryDocuments,
    sdizGates: primarySdizGates,
    qualityDelta: primaryQualityDelta,
    weightBalance: primaryWeightBalance,
  });
  const sdizBlockers = getSdizGateBlockers(primarySdizGates);
  const blockers: ExecutionBlocker[] = [...moneyProjection.releaseBlockedReasons, ...sdizBlockers];
  const supportCases = createSupportCases({
    blockers,
    incidents: logisticsIncidents,
    qualityDelta: primaryQualityDelta,
    weightBalance: primaryWeightBalance,
    dealId: 'DL-GRAIN-450',
    batchId: primaryBatch.id,
    logisticsOrderId: primaryLogisticsOrder.id,
    createdAt,
  });
  const auditEvents = createRequiredAuditEvents(createdAt);
  const nextActions = [moneyProjection.nextAction, ...readiness.nextActions].filter(isNextAction);

  const baseSummary: RoleExecutionSummary = {
    role: 'operator',
    entityType: 'deal',
    entityId: 'DL-GRAIN-450',
    currentState: 'Приёмка завершена, качество и вес создали удержания, СДИЗ перевозки требует ручной проверки.',
    blockers,
    nextActions,
    moneySummary: moneyProjection,
    documentSummary: summarizeDocuments(primaryDocuments),
    logisticsSummary: {
      status: primaryLogisticsOrder.status,
      currentStep: 'Машина на приёмке, вес и проба зафиксированы.',
      incidentCount: logisticsIncidents.length,
    },
    qualitySummary: {
      status: primaryQualityDelta.status,
      totalDiscount: primaryQualityDelta.totalDiscount,
      repeatAnalysisAvailable: sampleChains[0]?.repeatAllowed ?? false,
    },
    sdizSummary: {
      total: primarySdizGates.length,
      ready: primarySdizGates.filter((gate) => ['signed', 'sent', 'redeemed', 'partially_redeemed'].includes(gate.status)).length,
      blockingShipment: primarySdizGates.filter((gate) => gate.blockingShipment && !['signed', 'sent', 'redeemed', 'partially_redeemed'].includes(gate.status)).length,
      blockingMoneyRelease: primarySdizGates.filter((gate) => gate.blockingMoneyRelease && !['signed', 'sent', 'redeemed', 'partially_redeemed'].includes(gate.status)).length,
    },
    supportSummary: summarizeSupport(supportCases),
    maturity: 'sandbox',
  };

  return {
    batches: grainBatches,
    primaryBatch,
    readiness,
    lots: marketLots,
    primaryLot,
    rfqs,
    primaryRfq,
    rfqMatches,
    offers,
    netbacks,
    sdizGates: primarySdizGates,
    documents: primaryDocuments,
    logisticsOrders,
    logisticsIncidents,
    primaryLogisticsOrder,
    elevatorOperations,
    primaryElevatorOperation,
    weightBalances,
    primaryWeightBalance,
    qualityDeltas,
    primaryQualityDelta,
    sampleChains,
    disputes,
    evidencePacks,
    supportCases,
    auditEvents,
    moneyProjection,
    summary: baseSummary,
    summaryForRole: (role: UserRole) => projectSummaryForRole(baseSummary, role),
  };
}

export type GrainExecutionContext = ReturnType<typeof getGrainExecutionContext>;
