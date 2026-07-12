import { describe, expect, it } from 'vitest';
import { Money, MoneyError } from './money';
import { PricePerTon, QualityAdjustment, Weight } from './measures';

describe('Weight', () => {
  it('parses decimal(20,6) tons exactly and rejects floats/negatives', () => {
    expect(Weight.fromTonsString('150').microTons).toBe(150_000_000n);
    expect(Weight.fromTonsString('149.634500').toTonsString()).toBe('149.634500');
    expect(() => Weight.fromTonsString('1.1234567')).toThrow(MoneyError);
    expect(() => Weight.fromTonsString('-5')).toThrow(MoneyError);
  });

  it('adds and subtracts without drift', () => {
    const a = Weight.fromTonsString('0.1');
    const b = Weight.fromTonsString('0.2');
    expect(a.add(b).toTonsString()).toBe('0.300000'); // no 0.30000000000000004
    expect(() => a.subtract(b)).toThrow(MoneyError); // negative weight forbidden
  });
});

describe('PricePerTon', () => {
  it('computes deal totals in integer space with deterministic rounding', () => {
    const price = PricePerTon.fromRubleString('16000.00');
    const weight = Weight.fromTonsString('150');
    expect(price.total(weight).toDecimalString()).toBe('2400000.00');

    // fractional tons: 12750 ₽/т × 149.6345 т = 1 907 839.875 ₽ → 1 907 839.88 ₽
    const fractional = PricePerTon.fromRubleString('12750.00').total(Weight.fromTonsString('149.6345'));
    expect(fractional.toDecimalString()).toBe('1907839.88');
  });

  it('survives amounts above the 32-bit kopeck ceiling', () => {
    const price = PricePerTon.fromRubleString('25000.00');
    const weight = Weight.fromTonsString('4000000'); // 4 млн тонн
    expect(price.total(weight).toDecimalString()).toBe('100000000000.00'); // 100 млрд ₽
  });
});

describe('QualityAdjustment', () => {
  it('produces signed ledger-ready money deltas', () => {
    const amount = Money.fromDecimalString('2400000.00');
    const discount = QualityAdjustment.discount(150, 'moisture'); // -1.5%
    expect(discount.applyTo(amount).toDecimalString()).toBe('-36000.00');

    const premium = QualityAdjustment.premium(50, 'protein'); // +0.5%
    expect(premium.applyTo(amount).toDecimalString()).toBe('12000.00');
  });

  it('caps adjustments at 100% and forbids negatives', () => {
    expect(() => QualityAdjustment.discount(10_001, 'x')).toThrow(MoneyError);
    expect(() => QualityAdjustment.discount(-1, 'x')).toThrow(MoneyError);
  });
});
