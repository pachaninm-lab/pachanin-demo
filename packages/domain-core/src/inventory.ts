import type { CommodityUnitRule } from './commodity-profile';

export const INVENTORY_SOURCES = ['MANUAL', 'FGIS', '1C', 'ELEVATOR', 'WAREHOUSE', 'PARTNER', 'DOCUMENT_ASSISTED'] as const;
export type InventorySource = (typeof INVENTORY_SOURCES)[number];
export const INVENTORY_AVAILABILITY_POLICY = 'DECLARED_CAPACITY_V1' as const;
export const INVENTORY_MAX_ATOMS = 9_223_372_036_854_775_807n;

export class InventoryError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'InventoryError'; }
}

function decimal(value: unknown): { numerator: bigint; denominator: bigint; precision: number } {
  if (typeof value !== 'string' || value.length > 32 || !/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/u.test(value)) {
    throw new InventoryError('INVENTORY_EXACT_QUANTITY_REQUIRED');
  }
  const [whole, fraction = ''] = value.split('.');
  return { numerator: BigInt(`${whole}${fraction}`), denominator: 10n ** BigInt(fraction.length), precision: fraction.length };
}

/** Quantities are integer atoms of the pinned profile's base unit. No rounding. */
export function inventoryQuantityAtoms(units: readonly CommodityUnitRule[], code: string, quantity: string) {
  const selected = units.filter((unit) => unit.code === code);
  if (selected.length !== 1) throw new InventoryError('INVENTORY_UNIT_UNKNOWN');
  const unit = selected[0]!;
  if (!['MASS', 'VOLUME', 'COUNT'].includes(unit.dimension)) throw new InventoryError('INVENTORY_UNIT_DIMENSION_INVALID');
  const bases = units.filter((entry) => entry.dimension === unit.dimension && entry.isBase);
  if (bases.length !== 1) throw new InventoryError('INVENTORY_BASE_UNIT_INVALID');
  const base = bases[0]!;
  for (const entry of [base, unit]) {
    if (!Number.isInteger(entry.precision) || entry.precision < 0 || entry.precision > 6) {
      throw new InventoryError('INVENTORY_UNIT_PRECISION_INVALID');
    }
  }
  const amount = decimal(quantity);
  const numerator = decimal(unit.numeratorToBase);
  const denominator = decimal(unit.denominatorToBase);
  const baseNumerator = decimal(base.numeratorToBase);
  const baseDenominator = decimal(base.denominatorToBase);
  if (numerator.numerator === 0n || denominator.numerator === 0n
    || baseNumerator.numerator === 0n || baseDenominator.numerator === 0n
    || baseNumerator.numerator * baseDenominator.denominator !== baseDenominator.numerator * baseNumerator.denominator) {
    throw new InventoryError('INVENTORY_UNIT_RATIO_INVALID');
  }
  if (amount.numerator === 0n || amount.precision > unit.precision) throw new InventoryError('INVENTORY_QUANTITY_PRECISION_INVALID');
  const top = amount.numerator * numerator.numerator * denominator.denominator * (10n ** BigInt(base.precision));
  const bottom = amount.denominator * numerator.denominator * denominator.numerator;
  if (top % bottom !== 0n) throw new InventoryError('INVENTORY_QUANTITY_NOT_REPRESENTABLE');
  const atoms = top / bottom;
  if (atoms <= 0n || atoms > INVENTORY_MAX_ATOMS) throw new InventoryError('INVENTORY_QUANTITY_OVERFLOW');
  return { atoms: atoms.toString(), baseUnitCode: base.code, precision: base.precision, dimension: unit.dimension };
}

export type InventoryAvailabilityInput = Readonly<{
  declaredQuantity: string;
  reservedQuantity: string;
  committedQuantity: string;
  blockedQuantity: string;
  disputedQuantity: string;
  depletedQuantity: string;
}>;

/** Exclusive buckets only. Confirmed quantity and lifecycle counters do not subtract stock again. */
export function inventoryAvailableAtoms(input: InventoryAvailabilityInput): string {
  const quantities = Object.values(input).map((value) => {
    if (!/^(0|[1-9][0-9]{0,18})$/u.test(value)) throw new InventoryError('INVENTORY_ATOMS_INVALID');
    const amount = BigInt(value);
    if (amount > INVENTORY_MAX_ATOMS) throw new InventoryError('INVENTORY_QUANTITY_OVERFLOW');
    return amount;
  });
  if (quantities.length !== 6) throw new InventoryError('INVENTORY_BUCKETS_INVALID');
  const available = BigInt(input.declaredQuantity) - BigInt(input.reservedQuantity) - BigInt(input.committedQuantity)
    - BigInt(input.blockedQuantity) - BigInt(input.disputedQuantity) - BigInt(input.depletedQuantity);
  if (available < 0n) throw new InventoryError('INVENTORY_CAPACITY_EXCEEDED');
  return available.toString();
}
