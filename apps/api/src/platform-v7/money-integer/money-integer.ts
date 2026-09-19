export type PlatformV7Currency = 'RUB';

export type PlatformV7MoneyInteger = Readonly<{
  currency: PlatformV7Currency;
  minorUnits: number;
}>;

export type PlatformV7MoneyComparison = -1 | 0 | 1;

function assertSafeMinorUnits(minorUnits: number): void {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new Error('platform-v7 money integer rejected: unsafe-minor-units');
  }

  if (minorUnits < 0) {
    throw new Error('platform-v7 money integer rejected: negative-minor-units');
  }
}

export function platformV7MoneyInteger(minorUnits: number, currency: PlatformV7Currency = 'RUB'): PlatformV7MoneyInteger {
  assertSafeMinorUnits(minorUnits);
  return Object.freeze({ currency, minorUnits });
}

export function platformV7AssertSameCurrency(left: PlatformV7MoneyInteger, right: PlatformV7MoneyInteger): void {
  if (left.currency !== right.currency) {
    throw new Error('platform-v7 money integer rejected: currency-mismatch');
  }
}

export function platformV7MoneyAdd(left: PlatformV7MoneyInteger, right: PlatformV7MoneyInteger): PlatformV7MoneyInteger {
  platformV7AssertSameCurrency(left, right);
  return platformV7MoneyInteger(left.minorUnits + right.minorUnits, left.currency);
}

export function platformV7MoneySubtract(left: PlatformV7MoneyInteger, right: PlatformV7MoneyInteger): PlatformV7MoneyInteger {
  platformV7AssertSameCurrency(left, right);
  return platformV7MoneyInteger(left.minorUnits - right.minorUnits, left.currency);
}

export function platformV7MoneyCompare(left: PlatformV7MoneyInteger, right: PlatformV7MoneyInteger): PlatformV7MoneyComparison {
  platformV7AssertSameCurrency(left, right);

  if (left.minorUnits === right.minorUnits) {
    return 0;
  }

  return left.minorUnits > right.minorUnits ? 1 : -1;
}

export function platformV7MoneyFormatMinorUnits(money: PlatformV7MoneyInteger): string {
  const whole = Math.trunc(money.minorUnits / 100);
  const fraction = String(money.minorUnits % 100).padStart(2, '0');

  return `${whole}.${fraction} ${money.currency}`;
}
