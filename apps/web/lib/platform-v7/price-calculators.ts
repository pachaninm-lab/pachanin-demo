import { MoneyAmount } from './core-types';

export interface SellerNetbackInput {
  buyerPricePerTon: MoneyAmount;
  volumeTons: number;
  logisticsCostPerTon?: MoneyAmount;
  dryingCostPerTon?: MoneyAmount;
  cleaningCostPerTon?: MoneyAmount;
  qualityDiscountPerTon?: MoneyAmount;
  delayCostPerTon?: MoneyAmount;
  platformFeePerTon?: MoneyAmount;
  paymentDeferralCostPerTon?: MoneyAmount;
}

export interface BuyerLandedPriceInput {
  sellerPricePerTon: MoneyAmount;
  volumeTons: number;
  logisticsCostPerTon?: MoneyAmount;
  acceptanceCostPerTon?: MoneyAmount;
  documentCostPerTon?: MoneyAmount;
  qualityRiskPerTon?: MoneyAmount;
  timingRiskPerTon?: MoneyAmount;
}

export interface PriceBreakdown {
  pricePerTon: MoneyAmount;
  totalAmount: MoneyAmount;
  deductionsOrAdditions: { label: string; amountPerTon: MoneyAmount; total: MoneyAmount }[];
  explanation: string[];
}

function item(label: string, amountPerTon: MoneyAmount, volumeTons: number) {
  return { label, amountPerTon, total: amountPerTon * volumeTons };
}

export function calculateSellerNetback(input: SellerNetbackInput): PriceBreakdown {
  const deductions = [
    item('Логистика', input.logisticsCostPerTon ?? 0, input.volumeTons),
    item('Сушка', input.dryingCostPerTon ?? 0, input.volumeTons),
    item('Подработка', input.cleaningCostPerTon ?? 0, input.volumeTons),
    item('Качество', input.qualityDiscountPerTon ?? 0, input.volumeTons),
    item('Простой', input.delayCostPerTon ?? 0, input.volumeTons),
    item('Комиссия', input.platformFeePerTon ?? 0, input.volumeTons),
    item('Отсрочка оплаты', input.paymentDeferralCostPerTon ?? 0, input.volumeTons),
  ];
  const totalDeductionPerTon = deductions.reduce((sum, current) => sum + current.amountPerTon, 0);
  const pricePerTon = input.buyerPricePerTon - totalDeductionPerTon;
  return {
    pricePerTon,
    totalAmount: pricePerTon * input.volumeTons,
    deductionsOrAdditions: deductions,
    explanation: [
      `Цена покупателя: ${input.buyerPricePerTon} ₽/т`,
      `Удержания и расходы: ${totalDeductionPerTon} ₽/т`,
      `Чистая цена продавца: ${pricePerTon} ₽/т`,
    ],
  };
}

export function calculateBuyerLandedPrice(input: BuyerLandedPriceInput): PriceBreakdown {
  const additions = [
    item('Логистика', input.logisticsCostPerTon ?? 0, input.volumeTons),
    item('Приёмка', input.acceptanceCostPerTon ?? 0, input.volumeTons),
    item('Документы', input.documentCostPerTon ?? 0, input.volumeTons),
    item('Риск качества', input.qualityRiskPerTon ?? 0, input.volumeTons),
    item('Риск срока', input.timingRiskPerTon ?? 0, input.volumeTons),
  ];
  const totalAdditionPerTon = additions.reduce((sum, current) => sum + current.amountPerTon, 0);
  const pricePerTon = input.sellerPricePerTon + totalAdditionPerTon;
  return {
    pricePerTon,
    totalAmount: pricePerTon * input.volumeTons,
    deductionsOrAdditions: additions,
    explanation: [
      `Цена продавца: ${input.sellerPricePerTon} ₽/т`,
      `Расходы и риски до точки: ${totalAdditionPerTon} ₽/т`,
      `Цена до точки покупателя: ${pricePerTon} ₽/т`,
    ],
  };
}
