/**
 * Money — value object for monetary amounts.
 *
 * Amounts are held as bigint kopecks (minor units). JavaScript `number`
 * arithmetic on money is forbidden: every operation goes through this class,
 * every persistence boundary uses BIGINT columns, and conversion from/to
 * display strings is explicit and lossless.
 */

export type CurrencyCode = 'RUB' | 'USD' | 'EUR' | 'CNY';

const SUPPORTED_CURRENCIES: ReadonlySet<string> = new Set(['RUB', 'USD', 'EUR', 'CNY']);
const DECIMAL_STRING = /^-?\d+(\.\d{1,2})?$/;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

export class Money {
  private constructor(
    public readonly kopecks: bigint,
    public readonly currency: CurrencyCode,
  ) {
    Object.freeze(this);
  }

  static fromKopecks(kopecks: bigint | number | string, currency: CurrencyCode = 'RUB'): Money {
    if (!SUPPORTED_CURRENCIES.has(currency)) {
      throw new MoneyError(`Unsupported currency: ${currency}`);
    }
    let value: bigint;
    if (typeof kopecks === 'bigint') {
      value = kopecks;
    } else if (typeof kopecks === 'number') {
      if (!Number.isSafeInteger(kopecks)) {
        throw new MoneyError(`Kopecks must be a safe integer, got: ${kopecks}`);
      }
      value = BigInt(kopecks);
    } else if (typeof kopecks === 'string' && /^-?\d+$/.test(kopecks.trim())) {
      value = BigInt(kopecks.trim());
    } else {
      throw new MoneyError(`Kopecks must be an integer, got: ${String(kopecks)}`);
    }
    return new Money(value, currency);
  }

  /** Parse a decimal ruble string like "6375000.00". Floats are rejected. */
  static fromDecimalString(value: string, currency: CurrencyCode = 'RUB'): Money {
    const trimmed = value.trim();
    if (!DECIMAL_STRING.test(trimmed)) {
      throw new MoneyError(`Not a valid decimal money string: ${value}`);
    }
    const negative = trimmed.startsWith('-');
    const [whole, fraction = ''] = (negative ? trimmed.slice(1) : trimmed).split('.');
    const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    return Money.fromKopecks(negative ? -minor : minor, currency);
  }

  static zero(currency: CurrencyCode = 'RUB'): Money {
    return new Money(0n, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.kopecks + other.kopecks, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.kopecks - other.kopecks, this.currency);
  }

  /** Multiply by an integer factor (e.g. quantity). Fractional factors are rejected. */
  multiply(factor: bigint | number): Money {
    if (typeof factor === 'number' && !Number.isSafeInteger(factor)) {
      throw new MoneyError(`Multiplication factor must be an integer, got: ${factor}`);
    }
    return new Money(this.kopecks * BigInt(factor), this.currency);
  }

  /**
   * Percentage with banker's-free deterministic rounding (half away from zero).
   * basisPoints: 1% = 100 bp, so commission of 1.5% = percentBasisPoints(150).
   */
  percentBasisPoints(basisPoints: bigint | number): Money {
    if (typeof basisPoints === 'number' && !Number.isSafeInteger(basisPoints)) {
      throw new MoneyError(`Basis points must be an integer, got: ${basisPoints}`);
    }
    const bp = BigInt(basisPoints);
    const numerator = this.kopecks * bp;
    const denominator = 10000n;
    const quotient = numerator / denominator;
    const remainder = numerator % denominator;
    const absRemainder = remainder < 0n ? -remainder : remainder;
    if (absRemainder * 2n >= denominator) {
      return new Money(quotient + (numerator < 0n ? -1n : 1n), this.currency);
    }
    return new Money(quotient, this.currency);
  }

  negate(): Money {
    return new Money(-this.kopecks, this.currency);
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    if (this.kopecks < other.kopecks) return -1;
    if (this.kopecks > other.kopecks) return 1;
    return 0;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.kopecks === other.kopecks;
  }

  isNegative(): boolean {
    return this.kopecks < 0n;
  }

  isZero(): boolean {
    return this.kopecks === 0n;
  }

  isPositive(): boolean {
    return this.kopecks > 0n;
  }

  /** Lossless decimal string, e.g. "63750000.00". Safe for DECIMAL columns and display. */
  toDecimalString(): string {
    const negative = this.kopecks < 0n;
    const abs = negative ? -this.kopecks : this.kopecks;
    const whole = abs / 100n;
    const fraction = (abs % 100n).toString().padStart(2, '0');
    return `${negative ? '-' : ''}${whole}.${fraction}`;
  }

  /** For Prisma BigInt columns. */
  toBigInt(): bigint {
    return this.kopecks;
  }

  /** JSON-safe representation: string kopecks + currency. Never a float. */
  toJSON(): { kopecks: string; currency: CurrencyCode } {
    return { kopecks: this.kopecks.toString(), currency: this.currency };
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new MoneyError(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}
