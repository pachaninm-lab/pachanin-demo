import type { MoneyAmount, NetbackCalculation, Offer } from '../types';
import { money } from '../format';

function rub(value: number): MoneyAmount {
  return money(value, 'RUB');
}

function paymentDelayCost(grossAmount: number, delayDays: number): number {
  if (delayDays <= 0) return 0;
  const annualCost = 0.18;
  return Math.round((grossAmount * annualCost * delayDays) / 365);
}

function riskReserveFor(offer: Offer): number {
  if (offer.paymentTerms === 'prepay') return 0;
  if (offer.paymentTerms === 'after_loading') return Math.round(offer.pricePerTon.value * offer.volumeTons * 0.004);
  if (offer.paymentTerms === 'after_acceptance') return Math.round(offer.pricePerTon.value * offer.volumeTons * 0.007);
  return Math.round(offer.pricePerTon.value * offer.volumeTons * 0.012);
}

export function calculateNetback(params: {
  readonly id: string;
  readonly batchId: string;
  readonly offer: Offer;
  readonly logisticsCostPerTon?: number;
  readonly dryingCostPerTon?: number;
  readonly cleaningCostPerTon?: number;
  readonly elevatorCostPerTon?: number;
  readonly platformFeePercent?: number;
  readonly expectedQualityDiscountPerTon?: number;
  readonly paymentDelayDays?: number;
  readonly createdAt: string;
}): NetbackCalculation {
  const grossAmountValue = params.offer.pricePerTon.value * params.offer.volumeTons;
  const logisticsCostValue = (params.logisticsCostPerTon ?? (params.offer.basis === 'CPT' ? 820 : 0)) * params.offer.volumeTons;
  const dryingCostValue = (params.dryingCostPerTon ?? 120) * params.offer.volumeTons;
  const cleaningCostValue = (params.cleaningCostPerTon ?? 65) * params.offer.volumeTons;
  const elevatorCostValue = (params.elevatorCostPerTon ?? 90) * params.offer.volumeTons;
  const platformFeeValue = Math.round(grossAmountValue * (params.platformFeePercent ?? 0.0025));
  const expectedQualityDiscountValue = (params.expectedQualityDiscountPerTon ?? 80) * params.offer.volumeTons;
  const delayDays = params.paymentDelayDays ?? (params.offer.paymentTerms === 'after_documents' ? 7 : params.offer.paymentTerms === 'after_acceptance' ? 2 : 0);
  const expectedDelayCostValue = paymentDelayCost(grossAmountValue, delayDays);
  const riskReserveValue = riskReserveFor(params.offer);
  const totalDeductions = logisticsCostValue + dryingCostValue + cleaningCostValue + elevatorCostValue + platformFeeValue + expectedQualityDiscountValue + expectedDelayCostValue + riskReserveValue;
  const netAmountValue = Math.max(0, grossAmountValue - totalDeductions);
  const riskLevel: NetbackCalculation['riskLevel'] = riskReserveValue > grossAmountValue * 0.01 ? 'high' : riskReserveValue > 0 ? 'medium' : 'low';

  return {
    id: params.id,
    batchId: params.batchId,
    lotId: params.offer.marketLotId,
    offerId: params.offer.id,
    rfqId: params.offer.rfqId,
    grossPricePerTon: params.offer.pricePerTon,
    volumeTons: params.offer.volumeTons,
    grossAmount: rub(grossAmountValue),
    basis: params.offer.basis,
    logisticsCost: rub(logisticsCostValue),
    dryingCost: rub(dryingCostValue),
    cleaningCost: rub(cleaningCostValue),
    elevatorCost: rub(elevatorCostValue),
    platformFee: rub(platformFeeValue),
    financingCost: rub(0),
    expectedQualityDiscount: rub(expectedQualityDiscountValue),
    expectedDelayCost: rub(expectedDelayCostValue),
    riskReserve: rub(riskReserveValue),
    netAmount: rub(netAmountValue),
    netPricePerTon: rub(Math.round(netAmountValue / params.offer.volumeTons)),
    paymentScenario: params.offer.paymentTerms === 'custom' ? 'after_documents' : params.offer.paymentTerms,
    paymentDelayDays: delayDays,
    riskLevel,
    explanation: [
      params.offer.basis === 'CPT' ? 'Логистика учтена в расчёте до точки покупателя.' : 'Логистика не ложится на продавца по базису оффера.',
      delayDays > 0 ? `Срок оплаты учитывает стоимость ожидания ${delayDays} дн.` : 'Оплата без существенного ожидания.',
      riskLevel === 'high' ? 'Риск покупателя повышает резерв и снижает чистую цену.' : 'Риск оффера не критичен для расчёта.',
    ],
    createdAt: params.createdAt,
  };
}

export function rankOffersByNetback(calculations: readonly NetbackCalculation[]): NetbackCalculation[] {
  return [...calculations].sort((a, b) => b.netPricePerTon.value - a.netPricePerTon.value);
}
