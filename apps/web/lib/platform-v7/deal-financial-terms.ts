export interface PlatformV7DealFinancialTermsInput {
  pricePerTon: number;
  volumeTons: number;
  vatRate: number;
  basis: string;
  penaltyRate?: number;
  holdAmount?: number;
}

export interface PlatformV7DealFinancialTerms {
  pricePerTon: number;
  volumeTons: number;
  grossAmount: number;
  vatRate: number;
  vatAmount: number;
  netAmount: number;
  basis: string;
  penaltyRate: number;
  holdAmount: number;
  releaseAmount: number;
}

export function calculatePlatformV7DealFinancialTerms(
  input: PlatformV7DealFinancialTermsInput,
): PlatformV7DealFinancialTerms {
  const pricePerTon = Math.max(0, input.pricePerTon);
  const volumeTons = Math.max(0, input.volumeTons);
  const vatRate = Math.max(0, input.vatRate);
  const grossAmount = Math.round(pricePerTon * volumeTons);
  const vatAmount = Math.round((grossAmount * vatRate) / (100 + vatRate));
  const netAmount = grossAmount - vatAmount;
  const holdAmount = Math.min(Math.max(0, input.holdAmount ?? 0), grossAmount);

  return {
    pricePerTon,
    volumeTons,
    grossAmount,
    vatRate,
    vatAmount,
    netAmount,
    basis: input.basis.trim() || '—',
    penaltyRate: Math.max(0, input.penaltyRate ?? 0),
    holdAmount,
    releaseAmount: grossAmount - holdAmount,
  };
}

export function platformV7DealFinancialTermsAreBalanced(terms: PlatformV7DealFinancialTerms): boolean {
  return terms.grossAmount === terms.netAmount + terms.vatAmount && terms.releaseAmount + terms.holdAmount === terms.grossAmount;
}
