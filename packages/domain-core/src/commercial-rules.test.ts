import {
  COMMERCIAL_PAYER_MODES,
  COMMERCIAL_PRICING_MODELS,
  CommercialRuleError,
  evaluateCommercialRule,
} from './commercial-rules';
import { describe, expect, test } from 'vitest';

describe('commercial rules', () => {
  test('publishes the exact closed vocabularies', () => {
    expect(COMMERCIAL_PRICING_MODELS).toHaveLength(13);
    expect(COMMERCIAL_PAYER_MODES).toEqual([
      'SELLER', 'BUYER', 'INITIATOR', 'DELIVERY_RESPONSIBLE', 'SPLIT', 'CONTRACT_RULE', 'REQUIRES_CONFIRMATION',
    ]);
  });

  test.each([
    ['FREE', {}, {}, '0'],
    ['SUBSCRIPTION', { amountKopecks: '12500' }, { subscriptionPeriods: '3' }, '37500'],
    ['ACCESS_FEE', { amountKopecks: '900' }, { accessUnits: '2' }, '1800'],
    ['FIXED', { amountKopecks: '4200' }, {}, '4200'],
    ['PER_TON', { rateKopecks: '1250' }, { quantityMilliTons: '2500' }, '3125'],
    ['PER_KM', { rateKopecks: '200' }, { distanceMeters: '1250' }, '250'],
    ['PER_TRIP', { rateKopecks: '7000' }, { tripCount: '4' }, '28000'],
    ['PER_HOUR', { rateKopecks: '6000' }, { durationMinutes: '90' }, '9000'],
    ['PERCENT', { basisPoints: 125 }, { baseAmountKopecks: '100000' }, '1250'],
    ['SUCCESS_FEE', { amountKopecks: '5000' }, { success: true }, '5000'],
    ['CAPPED_PERCENT', { basisPoints: 1000, capKopecks: '8000' }, { baseAmountKopecks: '100000' }, '8000'],
    ['HYBRID', { fixedKopecks: '1000', basisPoints: 500 }, { baseAmountKopecks: '100000' }, '6000'],
  ] as const)('evaluates %s with integer arithmetic', (pricingModel, pricing, facts, expected) => {
    expect(evaluateCommercialRule({ pricingModel, pricing, payerMode: 'BUYER' }, facts)).toMatchObject({
      status: 'CALCULATED',
      amountKopecks: expected,
      payerAllocations: [{ payer: 'BUYER', amountKopecks: expected }],
    });
  });

  test('returns explicit pending outcomes instead of inventing money', () => {
    expect(evaluateCommercialRule({ pricingModel: 'MANUAL_QUOTE', pricing: {}, payerMode: 'BUYER' }, {})).toEqual({
      status: 'MANUAL_QUOTE_REQUIRED', amountKopecks: null, payerAllocations: [], missingFacts: [],
    });
    expect(evaluateCommercialRule({ pricingModel: 'FIXED', pricing: { amountKopecks: '1' }, payerMode: 'REQUIRES_CONFIRMATION' }, {})).toEqual({
      status: 'PAYER_CONFIRMATION_REQUIRED', amountKopecks: null, payerAllocations: [], missingFacts: [],
    });
  });

  test('applies success, cap and half-up boundaries deterministically', () => {
    expect(evaluateCommercialRule({
      pricingModel: 'SUCCESS_FEE', pricing: { amountKopecks: '5000' }, payerMode: 'BUYER',
    }, { success: false }).amountKopecks).toBe('0');
    expect(evaluateCommercialRule({
      pricingModel: 'PERCENT', pricing: { basisPoints: 1 }, payerMode: 'BUYER',
    }, { baseAmountKopecks: '5000' }).amountKopecks).toBe('1');
    expect(evaluateCommercialRule({
      pricingModel: 'CAPPED_PERCENT', pricing: { basisPoints: 100, capKopecks: '8000' }, payerMode: 'BUYER',
    }, { baseAmountKopecks: '1000' }).amountKopecks).toBe('10');
    expect(evaluateCommercialRule({
      pricingModel: 'HYBRID', pricing: { fixedKopecks: '1000', basisPoints: 1000, capKopecks: '5000' }, payerMode: 'BUYER',
    }, { baseAmountKopecks: '100000' }).amountKopecks).toBe('6000');
  });

  test('allocates split rounding remainder deterministically', () => {
    expect(evaluateCommercialRule({
      pricingModel: 'FIXED',
      pricing: { amountKopecks: '101' },
      payerMode: 'SPLIT',
      payerShares: [{ payer: 'SELLER', basisPoints: 5000 }, { payer: 'BUYER', basisPoints: 5000 }],
    }, {}).payerAllocations).toEqual([
      { payer: 'SELLER', amountKopecks: '50' },
      { payer: 'BUYER', amountKopecks: '51' },
    ]);
  });

  test('fails closed on invalid or duplicate split payers at the domain boundary', () => {
    const base = { pricingModel: 'FIXED', pricing: { amountKopecks: '100' }, payerMode: 'SPLIT' } as const;
    expect(() => evaluateCommercialRule({
      ...base,
      payerShares: [{ payer: 'BANK', basisPoints: 5000 }, { payer: 'BUYER', basisPoints: 5000 }],
    } as never, {})).toThrow('payer is invalid');
    expect(() => evaluateCommercialRule({
      ...base,
      payerShares: [{ payer: 'BUYER', basisPoints: 5000 }, { payer: 'BUYER', basisPoints: 5000 }],
    }, {})).toThrow('payer is duplicated');
  });

  test('fails closed for missing facts and invalid or overflowing money', () => {
    expect(evaluateCommercialRule({ pricingModel: 'PER_TON', pricing: { rateKopecks: '10' }, payerMode: 'BUYER' }, {})).toMatchObject({
      status: 'MISSING_FACTS', missingFacts: ['quantityMilliTons'],
    });
    expect(() => evaluateCommercialRule({ pricingModel: 'FIXED', pricing: { amountKopecks: '-1' }, payerMode: 'BUYER' }, {})).toThrow(CommercialRuleError);
    expect(() => evaluateCommercialRule({ pricingModel: 'FIXED', pricing: { amountKopecks: '01' }, payerMode: 'BUYER' }, {})).toThrow(CommercialRuleError);
    expect(() => evaluateCommercialRule({ pricingModel: 'PER_TRIP', pricing: { rateKopecks: '9223372036854775807' }, payerMode: 'BUYER' }, { tripCount: '2' })).toThrow('BIGINT authority');
  });

  test('resolves contract payer only from an explicit server fact', () => {
    const definition = { pricingModel: 'FIXED', pricing: { amountKopecks: '90' }, payerMode: 'CONTRACT_RULE' } as const;
    expect(evaluateCommercialRule(definition, {})).toMatchObject({ status: 'MISSING_FACTS', missingFacts: ['contractPayer'] });
    expect(evaluateCommercialRule(definition, { contractPayer: 'DELIVERY_RESPONSIBLE' })).toMatchObject({
      status: 'CALCULATED', payerAllocations: [{ payer: 'DELIVERY_RESPONSIBLE', amountKopecks: '90' }],
    });
    expect(() => evaluateCommercialRule(definition, { contractPayer: 'BANK' } as never)).toThrow('contractPayer is invalid');
  });

  test.each(['SELLER', 'BUYER', 'INITIATOR', 'DELIVERY_RESPONSIBLE'] as const)(
    'allocates the full amount to direct payer %s',
    (payerMode) => {
      expect(evaluateCommercialRule({
        pricingModel: 'FIXED', pricing: { amountKopecks: '42' }, payerMode,
      }, {}).payerAllocations).toEqual([{ payer: payerMode, amountKopecks: '42' }]);
    },
  );

  test('rejects malformed pricing and runtime vocabulary values', () => {
    expect(() => evaluateCommercialRule({ pricingModel: 'FIXED', payerMode: 'BUYER' } as never, {}))
      .toThrow('pricing must be an object');
    expect(() => evaluateCommercialRule({ pricingModel: 'UNKNOWN', pricing: {}, payerMode: 'BUYER' } as never, {}))
      .toThrow('pricingModel is invalid');
    expect(() => evaluateCommercialRule({ pricingModel: 'FREE', pricing: {}, payerMode: 'BANK' } as never, {}))
      .toThrow('payerMode is invalid');
  });
});
