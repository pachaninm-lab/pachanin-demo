import { describe, expect, it } from 'vitest';
import { Money, MoneyError } from './money';

describe('Money', () => {
  it('holds amounts above the 32-bit kopeck limit without overflow', () => {
    // 21 474 836,47 ₽ is the Int32 ceiling; a large grain deal exceeds it.
    const large = Money.fromDecimalString('98765432109.87');
    expect(large.kopecks).toBe(9876543210987n);
    expect(large.toDecimalString()).toBe('98765432109.87');
  });

  it('parses decimal strings exactly and rejects floats', () => {
    expect(Money.fromDecimalString('6375000.00').kopecks).toBe(637500000n);
    expect(Money.fromDecimalString('0.1').kopecks).toBe(10n);
    expect(Money.fromDecimalString('-250000.05').kopecks).toBe(-25000005n);
    expect(() => Money.fromDecimalString('12.345')).toThrow(MoneyError);
    expect(() => Money.fromDecimalString('1e6')).toThrow(MoneyError);
    expect(() => Money.fromDecimalString('NaN')).toThrow(MoneyError);
  });

  it('rejects unsafe and fractional numeric kopecks', () => {
    expect(() => Money.fromKopecks(0.5)).toThrow(MoneyError);
    expect(() => Money.fromKopecks(Number.MAX_SAFE_INTEGER + 1)).toThrow(MoneyError);
    expect(Money.fromKopecks('9007199254740993').kopecks).toBe(9007199254740993n);
  });

  it('adds and subtracts with currency safety', () => {
    const a = Money.fromKopecks(1000n);
    const b = Money.fromKopecks(250n);
    expect(a.add(b).kopecks).toBe(1250n);
    expect(a.subtract(b).kopecks).toBe(750n);
    expect(() => a.add(Money.fromKopecks(1n, 'USD'))).toThrow(MoneyError);
  });

  it('computes basis-point percentages with deterministic rounding', () => {
    const amount = Money.fromDecimalString('1000.00'); // 100000 kopecks
    expect(amount.percentBasisPoints(150).toDecimalString()).toBe('15.00'); // 1.5%
    // 0.01% of 1000.00 ₽ = 0.10 ₽
    expect(amount.percentBasisPoints(1).kopecks).toBe(10n);
    // half rounds away from zero: 0.005% of 1000.00 ₽ → numerator 100000*0.5 = 50000/10000 = 5 exactly
    const odd = Money.fromKopecks(333n);
    expect(odd.percentBasisPoints(100).kopecks).toBe(3n); // 3.33 → 3
    expect(odd.percentBasisPoints(150).kopecks).toBe(5n); // 4.995 → 5
    expect(odd.negate().percentBasisPoints(150).kopecks).toBe(-5n);
  });

  it('compares, negates, and serialises without floats', () => {
    const a = Money.fromKopecks(500n);
    const b = Money.fromKopecks(700n);
    expect(a.compare(b)).toBe(-1);
    expect(b.compare(a)).toBe(1);
    expect(a.compare(Money.fromKopecks(500n))).toBe(0);
    expect(a.negate().isNegative()).toBe(true);
    expect(Money.zero().isZero()).toBe(true);
    expect(a.toJSON()).toEqual({ kopecks: '500', currency: 'RUB' });
  });

  it('is immutable', () => {
    const a = Money.fromKopecks(1n);
    expect(() => {
      (a as unknown as { kopecks: bigint }).kopecks = 2n;
    }).toThrow();
  });
});
