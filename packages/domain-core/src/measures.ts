import { Money, MoneyError, type CurrencyCode } from './money';

/**
 * Physical and pricing value objects for the grain trade.
 *
 * Both Weight and PricePerTon are held as bigint micro-units (6 decimal
 * places) — the exact resolution of the DECIMAL(20,6) columns they persist
 * into. All arithmetic is integer arithmetic; JS floats never touch these
 * values.
 */

const MICRO = 1_000_000n;
const DECIMAL_6 = /^-?\d+(\.\d{1,6})?$/;

function parseMicro(value: string, label: string): bigint {
  const trimmed = value.trim();
  if (!DECIMAL_6.test(trimmed)) {
    throw new MoneyError(`${label}: not a valid decimal(20,6) string: ${value}`);
  }
  const negative = trimmed.startsWith('-');
  const [whole, fraction = ''] = (negative ? trimmed.slice(1) : trimmed).split('.');
  const micro = BigInt(whole) * MICRO + BigInt(fraction.padEnd(6, '0'));
  return negative ? -micro : micro;
}

function microToString(micro: bigint): string {
  const negative = micro < 0n;
  const abs = negative ? -micro : micro;
  const whole = abs / MICRO;
  const fraction = (abs % MICRO).toString().padStart(6, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/** Round half away from zero when dividing integer `numerator / denominator`. */
function divideRounded(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const absRemainder = remainder < 0n ? -remainder : remainder;
  if (absRemainder * 2n >= denominator) {
    return quotient + (numerator < 0n ? -1n : 1n);
  }
  return quotient;
}

/** Weight in tons, 6-decimal precision, non-negative. */
export class Weight {
  private constructor(public readonly microTons: bigint) {
    if (microTons < 0n) throw new MoneyError('Weight cannot be negative');
    Object.freeze(this);
  }

  static fromTonsString(value: string): Weight {
    return new Weight(parseMicro(value, 'Weight'));
  }

  static fromMicroTons(microTons: bigint): Weight {
    return new Weight(microTons);
  }

  add(other: Weight): Weight {
    return new Weight(this.microTons + other.microTons);
  }

  subtract(other: Weight): Weight {
    return new Weight(this.microTons - other.microTons);
  }

  compare(other: Weight): -1 | 0 | 1 {
    if (this.microTons < other.microTons) return -1;
    if (this.microTons > other.microTons) return 1;
    return 0;
  }

  /** Lossless decimal string for DECIMAL(20,6) columns and display. */
  toTonsString(): string {
    return microToString(this.microTons);
  }

  toJSON(): { tons: string } {
    return { tons: this.toTonsString() };
  }
}

/** Price per ton in currency kopecks, 6-decimal ton resolution aware. */
export class PricePerTon {
  private constructor(
    /** kopecks per one ton, integer */
    public readonly kopecksPerTon: bigint,
    public readonly currency: CurrencyCode,
  ) {
    if (kopecksPerTon < 0n) throw new MoneyError('PricePerTon cannot be negative');
    Object.freeze(this);
  }

  /** Parse a ruble price string like "16000.00". */
  static fromRubleString(value: string, currency: CurrencyCode = 'RUB'): PricePerTon {
    const money = Money.fromDecimalString(value, currency);
    if (money.isNegative()) throw new MoneyError('PricePerTon cannot be negative');
    return new PricePerTon(money.kopecks, currency);
  }

  static fromKopecks(kopecksPerTon: bigint, currency: CurrencyCode = 'RUB'): PricePerTon {
    return new PricePerTon(kopecksPerTon, currency);
  }

  /**
   * Total deal amount = price × weight, computed entirely in integer space:
   * kopecks/ton × microTons / 1e6, rounded half away from zero to a kopeck.
   */
  total(weight: Weight): Money {
    const kopecks = divideRounded(this.kopecksPerTon * weight.microTons, MICRO);
    return Money.fromKopecks(kopecks, this.currency);
  }

  toRubleString(): string {
    return Money.fromKopecks(this.kopecksPerTon, this.currency).toDecimalString();
  }

  toJSON(): { kopecksPerTon: string; currency: CurrencyCode } {
    return { kopecksPerTon: this.kopecksPerTon.toString(), currency: this.currency };
  }
}

export type QualityAdjustmentDirection = 'DISCOUNT' | 'PREMIUM';

/**
 * Quality-based price adjustment expressed in basis points of the deal
 * amount (1% = 100 bp). The signed Money delta it produces feeds the ledger
 * as an explicit QUALITY_ADJUSTMENT posting — never a mutation of history.
 */
export class QualityAdjustment {
  private constructor(
    public readonly basisPoints: bigint,
    public readonly direction: QualityAdjustmentDirection,
    public readonly parameter: string,
  ) {
    if (basisPoints < 0n) throw new MoneyError('QualityAdjustment basis points cannot be negative');
    if (basisPoints > 10_000n) throw new MoneyError('QualityAdjustment cannot exceed 100% of the deal amount');
    Object.freeze(this);
  }

  static discount(basisPoints: bigint | number, parameter: string): QualityAdjustment {
    return new QualityAdjustment(BigInt(basisPoints), 'DISCOUNT', parameter);
  }

  static premium(basisPoints: bigint | number, parameter: string): QualityAdjustment {
    return new QualityAdjustment(BigInt(basisPoints), 'PREMIUM', parameter);
  }

  /** Signed money delta against the deal amount: negative for a discount. */
  applyTo(dealAmount: Money): Money {
    const magnitude = dealAmount.percentBasisPoints(this.basisPoints);
    return this.direction === 'DISCOUNT' ? magnitude.negate() : magnitude;
  }

  toJSON(): { basisPoints: string; direction: QualityAdjustmentDirection; parameter: string } {
    return {
      basisPoints: this.basisPoints.toString(),
      direction: this.direction,
      parameter: this.parameter,
    };
  }
}
