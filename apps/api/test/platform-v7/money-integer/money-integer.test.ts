import { describe, expect, it } from 'vitest';

import {
  platformV7AssertSameCurrency,
  platformV7MoneyAdd,
  platformV7MoneyCompare,
  platformV7MoneyFormatMinorUnits,
  platformV7MoneyInteger,
  platformV7MoneySubtract,
} from '../../../src/platform-v7/money-integer';

describe('platform-v7 money integer boundary', () => {
  it('creates frozen minor-unit money values', () => {
    const money = platformV7MoneyInteger(296400000);

    expect(money).toEqual({ currency: 'RUB', minorUnits: 296400000 });
    expect(Object.isFrozen(money)).toBe(true);
  });

  it('rejects floats and unsafe numbers', () => {
    expect(() => platformV7MoneyInteger(10.5)).toThrow('unsafe-minor-units');
    expect(() => platformV7MoneyInteger(Number.MAX_SAFE_INTEGER + 1)).toThrow('unsafe-minor-units');
  });

  it('rejects negative values and underflow subtraction', () => {
    expect(() => platformV7MoneyInteger(-1)).toThrow('negative-minor-units');
    expect(() => platformV7MoneySubtract(platformV7MoneyInteger(100), platformV7MoneyInteger(101))).toThrow(
      'negative-minor-units',
    );
  });

  it('adds and subtracts deterministically in minor units', () => {
    const total = platformV7MoneyAdd(platformV7MoneyInteger(296400000), platformV7MoneyInteger(624000000));

    expect(total).toEqual({ currency: 'RUB', minorUnits: 920400000 });
    expect(platformV7MoneySubtract(total, platformV7MoneyInteger(624000000))).toEqual({
      currency: 'RUB',
      minorUnits: 296400000,
    });
  });

  it('compares same-currency values', () => {
    expect(platformV7MoneyCompare(platformV7MoneyInteger(100), platformV7MoneyInteger(100))).toBe(0);
    expect(platformV7MoneyCompare(platformV7MoneyInteger(101), platformV7MoneyInteger(100))).toBe(1);
    expect(platformV7MoneyCompare(platformV7MoneyInteger(99), platformV7MoneyInteger(100))).toBe(-1);
  });

  it('guards cross-currency arithmetic defensively', () => {
    const rub = platformV7MoneyInteger(100, 'RUB');
    const foreignCurrency = { currency: 'USD', minorUnits: 100 } as never;

    expect(() => platformV7AssertSameCurrency(rub, foreignCurrency)).toThrow('currency-mismatch');
    expect(() => platformV7MoneyAdd(rub, foreignCurrency)).toThrow('currency-mismatch');
  });

  it('formats minor units without changing the stored integer value', () => {
    expect(platformV7MoneyFormatMinorUnits(platformV7MoneyInteger(296400000))).toBe('2964000.00 RUB');
    expect(platformV7MoneyFormatMinorUnits(platformV7MoneyInteger(101))).toBe('1.01 RUB');
  });
});
