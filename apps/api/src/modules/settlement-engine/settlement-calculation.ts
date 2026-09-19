import { toKopecks, fromKopecks } from '../../common/money/money';

/**
 * Settlement math (PR-B of MONEY_MINOR_UNITS_AUDIT.md): internal arithmetic in
 * integer kopecks via the shared money helper, returning rouble-denominated
 * fields so the external snapshot shape/units are unchanged.
 *
 * Behavior-preserving: `round2(x)` was `Math.round(x*100)/100`, which equals
 * `fromKopecks(toKopecks(x))` — so every previously-produced value is
 * reproduced, while intermediate accumulation is now exact integer kopecks
 * (no float drift). This function is standalone (not yet wired into the live
 * money path); the change is float-safety groundwork, covered by
 * settlement-calculation.characterization.spec.ts.
 */

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function negative(value: number) {
  return value > 0 ? -value : value;
}

function envNumber(name: string, fallback = 0) {
  return asNumber(process.env[name], fallback);
}

function pickFirstNumber(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/** Logistics cost in integer kopecks. */
function logisticsKopecksFromDeal(deal: any, paymentTerms: Record<string, any>) {
  const shipmentCosts = (deal?.shipments || []).map((shipment: any) => {
    const route = (shipment?.routeJson || {}) as Record<string, any>;
    return pickFirstNumber(route.actualCostRub, route.totalCostRub, route.costRub, route.quotedCostRub, route.priceRub) || 0;
  }).filter((value: number) => value > 0);

  if (shipmentCosts.length > 0) {
    return shipmentCosts.reduce((sum: number, value: number) => sum + toKopecks(value), 0);
  }

  const shipmentsCount = Math.max(1, deal?.shipments?.length || asNumber(paymentTerms.expectedShipments, 1));
  const logisticsRatePerShipment = pickFirstNumber(
    paymentTerms.logisticsRatePerShipment,
    paymentTerms.logisticsPerTruck,
    deal?.logisticsJson?.ratePerShipmentRub,
    deal?.logisticsJson?.plannedCostRub,
    envNumber('LOGISTICS_RATE_PER_SHIPMENT', 92000)
  ) || 92000;
  return Math.round(shipmentsCount * toKopecks(logisticsRatePerShipment));
}

/** Demurrage / idle cost in integer kopecks. */
function idleKopecksFromDeal(deal: any, paymentTerms: Record<string, any>) {
  const explicitIdle = (deal?.shipments || []).map((shipment: any) => {
    const route = (shipment?.routeJson || {}) as Record<string, any>;
    return pickFirstNumber(route.demurrageCostRub, route.idleCostRub, route.queuePenaltyRub) || 0;
  }).filter((value: number) => value > 0);
  if (explicitIdle.length > 0) {
    return explicitIdle.reduce((sum: number, value: number) => sum + toKopecks(value), 0);
  }

  const deviationCount = (deal?.shipments || []).filter((item: any) => item?.status === 'ROUTE_DEVIATION_ALERT').length;
  const idlePenaltyPerDeviation = pickFirstNumber(paymentTerms.idlePenaltyPerDeviation, envNumber('IDLE_PENALTY_PER_DEVIATION', 5400)) || 5400;
  return Math.round(deviationCount * toKopecks(idlePenaltyPerDeviation));
}

/** Quality delta in integer kopecks (negative = discount). */
function qualityDeltaKopecksFromDeal(deal: any, paymentTerms: Record<string, any>) {
  const completedTests = (deal?.labSamples || []).flatMap((sample: any) => (sample?.tests || []).filter((test: any) => test?.status === 'COMPLETED'));
  const explicitDeltas = completedTests
    .map((test: any) => asNumber(test?.priceDelta, Number.NaN))
    .filter((value: number) => Number.isFinite(value) && value !== 0);
  if (explicitDeltas.length > 0) {
    return explicitDeltas.reduce((sum: number, value: number) => sum + toKopecks(value), 0);
  }

  if (completedTests.length === 0) return 0;
  const discountPerTon = pickFirstNumber(paymentTerms.qualityDiscountPerTon, envNumber('QUALITY_DELTA_PER_TON_DEFAULT', 120)) || 120;
  return negative(Math.round(asNumber(deal?.volumeTons) * toKopecks(discountPerTon)));
}

/** Platform fee in integer kopecks (negative). */
function platformFeeKopecksFromDeal(baseKopecks: number, deal: any, paymentTerms: Record<string, any>) {
  const percent = pickFirstNumber(
    paymentTerms.platformFeePercent,
    paymentTerms.platformFeeRate,
    paymentTerms.platformFeeBps ? asNumber(paymentTerms.platformFeeBps) / 100 : undefined,
    envNumber('PLATFORM_FEE_PERCENT', 0.6)
  ) || 0.6;
  const perTon = pickFirstNumber(paymentTerms.platformFeePerTon, envNumber('PLATFORM_FEE_PER_TON_RUB', 0)) || 0;
  const fixedRub = pickFirstNumber(paymentTerms.platformFeeFixedRub, envNumber('PLATFORM_FEE_FIXED_RUB', 0)) || 0;
  const minRub = pickFirstNumber(paymentTerms.platformFeeMinRub, envNumber('PLATFORM_FEE_MIN_RUB', 0)) || 0;
  const maxRub = pickFirstNumber(paymentTerms.platformFeeMaxRub, envNumber('PLATFORM_FEE_MAX_RUB', 0)) || 0;

  let feeKopecks = Math.round((baseKopecks * percent) / 100 + asNumber(deal?.volumeTons) * toKopecks(perTon) + toKopecks(fixedRub));
  if (minRub > 0) feeKopecks = Math.max(feeKopecks, toKopecks(minRub));
  if (maxRub > 0) feeKopecks = Math.min(feeKopecks, toKopecks(maxRub));
  return negative(feeKopecks);
}

export function buildSettlementSnapshot(deal: any, paymentTermsInput?: Record<string, any>) {
  const paymentTerms = (paymentTermsInput || deal?.paymentTerms || {}) as Record<string, any>;
  const baseKopecks = Math.round(toKopecks(asNumber(deal?.price)) * asNumber(deal?.volumeTons));
  const logisticsKopecks = logisticsKopecksFromDeal(deal, paymentTerms);
  const idleKopecks = idleKopecksFromDeal(deal, paymentTerms);
  const qualityKopecks = qualityDeltaKopecksFromDeal(deal, paymentTerms);
  const platformFeeKopecks = platformFeeKopecksFromDeal(baseKopecks, deal, paymentTerms);
  const hasOpenDispute = (deal?.disputes || []).some((item: any) => !['EXECUTED', 'CLOSED', 'DECISION'].includes(String(item?.status || '').toUpperCase()));
  const disputeHoldPercent = pickFirstNumber(
    paymentTerms?.sberIntegration?.releasePolicy?.disputeHoldPercent,
    paymentTerms.disputeHoldPercent,
    envNumber('DISPUTE_HOLD_PERCENT', 18)
  ) || 18;
  const disputeHoldKopecks = hasOpenDispute ? Math.round(baseKopecks * (disputeHoldPercent / 100)) : 0;
  const reservePercent = pickFirstNumber(paymentTerms.prepaymentPercent, envNumber('PREPAYMENT_PERCENT_DEFAULT', 5)) || 5;
  const reservePlannedKopecks = Math.round(baseKopecks * (reservePercent / 100));
  const netFundingKopecks = baseKopecks + qualityKopecks - logisticsKopecks - idleKopecks + platformFeeKopecks;
  const fundingKopecks = Math.max(0, netFundingKopecks);
  const releaseCandidateKopecks = fundingKopecks - disputeHoldKopecks;

  return {
    baseAmount: fromKopecks(baseKopecks),
    logisticsAmount: fromKopecks(logisticsKopecks),
    idleAmount: fromKopecks(idleKopecks),
    qualityDelta: fromKopecks(qualityKopecks),
    platformFee: fromKopecks(platformFeeKopecks),
    hasOpenDispute,
    disputeHoldPercent,
    disputeHold: fromKopecks(disputeHoldKopecks),
    reservePercent,
    reservePlanned: fromKopecks(reservePlannedKopecks),
    fundingTarget: fromKopecks(fundingKopecks),
    netFundingTarget: fromKopecks(netFundingKopecks),
    releaseCandidate: fromKopecks(releaseCandidateKopecks),
  };
}
