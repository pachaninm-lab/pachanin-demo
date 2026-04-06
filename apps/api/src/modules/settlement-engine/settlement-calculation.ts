function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
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

function logisticsAmountFromDeal(deal: any, paymentTerms: Record<string, any>) {
  const shipmentCosts = (deal?.shipments || []).map((shipment: any) => {
    const route = (shipment?.routeJson || {}) as Record<string, any>;
    return pickFirstNumber(route.actualCostRub, route.totalCostRub, route.costRub, route.quotedCostRub, route.priceRub) || 0;
  }).filter((value: number) => value > 0);

  if (shipmentCosts.length > 0) return round2(shipmentCosts.reduce((sum, value) => sum + value, 0));

  const shipmentsCount = Math.max(1, deal?.shipments?.length || asNumber(paymentTerms.expectedShipments, 1));
  const logisticsRatePerShipment = pickFirstNumber(
    paymentTerms.logisticsRatePerShipment,
    paymentTerms.logisticsPerTruck,
    deal?.logisticsJson?.ratePerShipmentRub,
    deal?.logisticsJson?.plannedCostRub,
    envNumber('LOGISTICS_RATE_PER_SHIPMENT', 92000)
  ) || 92000;
  return round2(shipmentsCount * logisticsRatePerShipment);
}

function idleAmountFromDeal(deal: any, paymentTerms: Record<string, any>) {
  const explicitIdle = (deal?.shipments || []).map((shipment: any) => {
    const route = (shipment?.routeJson || {}) as Record<string, any>;
    return pickFirstNumber(route.demurrageCostRub, route.idleCostRub, route.queuePenaltyRub) || 0;
  }).filter((value: number) => value > 0);
  if (explicitIdle.length > 0) return round2(explicitIdle.reduce((sum, value) => sum + value, 0));

  const deviationCount = (deal?.shipments || []).filter((item: any) => item?.status === 'ROUTE_DEVIATION_ALERT').length;
  const idlePenaltyPerDeviation = pickFirstNumber(paymentTerms.idlePenaltyPerDeviation, envNumber('IDLE_PENALTY_PER_DEVIATION', 5400)) || 5400;
  return round2(deviationCount * idlePenaltyPerDeviation);
}

function qualityDeltaFromDeal(deal: any, paymentTerms: Record<string, any>) {
  const completedTests = (deal?.labSamples || []).flatMap((sample: any) => (sample?.tests || []).filter((test: any) => test?.status === 'COMPLETED'));
  const explicitDeltas = completedTests
    .map((test: any) => asNumber(test?.priceDelta, Number.NaN))
    .filter((value: number) => Number.isFinite(value) && value !== 0);
  if (explicitDeltas.length > 0) return round2(explicitDeltas.reduce((sum: number, value: number) => sum + value, 0));

  if (completedTests.length === 0) return 0;
  const discountPerTon = pickFirstNumber(paymentTerms.qualityDiscountPerTon, envNumber('QUALITY_DELTA_PER_TON_DEFAULT', 120)) || 120;
  return negative(round2(asNumber(deal?.volumeTons) * discountPerTon));
}

function platformFeeFromDeal(baseAmount: number, deal: any, paymentTerms: Record<string, any>) {
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

  let feeRub = round2((baseAmount * percent) / 100 + asNumber(deal?.volumeTons) * perTon + fixedRub);
  if (minRub > 0) feeRub = Math.max(feeRub, minRub);
  if (maxRub > 0) feeRub = Math.min(feeRub, maxRub);
  return negative(feeRub);
}

export function buildSettlementSnapshot(deal: any, paymentTermsInput?: Record<string, any>) {
  const paymentTerms = (paymentTermsInput || deal?.paymentTerms || {}) as Record<string, any>;
  const baseAmount = round2(asNumber(deal?.price) * asNumber(deal?.volumeTons));
  const logisticsAmount = logisticsAmountFromDeal(deal, paymentTerms);
  const idleAmount = idleAmountFromDeal(deal, paymentTerms);
  const qualityDelta = qualityDeltaFromDeal(deal, paymentTerms);
  const platformFee = platformFeeFromDeal(baseAmount, deal, paymentTerms);
  const hasOpenDispute = (deal?.disputes || []).some((item: any) => !['EXECUTED', 'CLOSED', 'DECISION'].includes(String(item?.status || '').toUpperCase()));
  const disputeHoldPercent = pickFirstNumber(
    paymentTerms?.sberIntegration?.releasePolicy?.disputeHoldPercent,
    paymentTerms.disputeHoldPercent,
    envNumber('DISPUTE_HOLD_PERCENT', 18)
  ) || 18;
  const disputeHold = hasOpenDispute ? round2(baseAmount * (disputeHoldPercent / 100)) : 0;
  const reservePercent = pickFirstNumber(paymentTerms.prepaymentPercent, envNumber('PREPAYMENT_PERCENT_DEFAULT', 5)) || 5;
  const reservePlanned = round2(baseAmount * (reservePercent / 100));
  const netFundingTarget = round2(baseAmount + qualityDelta - logisticsAmount - idleAmount + platformFee);
  const fundingTarget = Math.max(0, round2(netFundingTarget));
  const releaseCandidate = round2(fundingTarget - disputeHold);

  return {
    baseAmount,
    logisticsAmount,
    idleAmount,
    qualityDelta,
    platformFee,
    hasOpenDispute,
    disputeHoldPercent,
    disputeHold,
    reservePercent,
    reservePlanned,
    fundingTarget,
    netFundingTarget,
    releaseCandidate,
  };
}
