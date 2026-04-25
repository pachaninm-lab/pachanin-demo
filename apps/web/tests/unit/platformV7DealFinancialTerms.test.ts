import { describe, expect, it } from 'vitest';
import {
  calculatePlatformV7DealFinancialTerms,
  platformV7DealFinancialTermsAreBalanced,
} from '@/lib/platform-v7/deal-financial-terms';

describe('platform-v7 deal financial terms', () => {
  it('calculates gross, VAT, net, hold and release amounts', () => {
    const terms = calculatePlatformV7DealFinancialTerms({
      pricePerTon: 12500,
      volumeTons: 240,
      vatRate: 10,
      basis: 'EXW Тамбовская область',
      penaltyRate: 0.5,
      holdAmount: 360000,
    });

    expect(terms.grossAmount).toBe(3000000);
    expect(terms.vatAmount).toBe(272727);
    expect(terms.netAmount).toBe(2727273);
    expect(terms.releaseAmount).toBe(2640000);
    expect(platformV7DealFinancialTermsAreBalanced(terms)).toBe(true);
  });

  it('caps hold by gross amount and normalizes empty basis', () => {
    const terms = calculatePlatformV7DealFinancialTerms({
      pricePerTon: 1000,
      volumeTons: 10,
      vatRate: 0,
      basis: ' ',
      holdAmount: 15000,
    });

    expect(terms.holdAmount).toBe(10000);
    expect(terms.releaseAmount).toBe(0);
    expect(terms.basis).toBe('—');
    expect(platformV7DealFinancialTermsAreBalanced(terms)).toBe(true);
  });
});
