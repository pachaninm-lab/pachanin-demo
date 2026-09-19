import { describe, expect, it } from 'vitest';
import type { CommodityUnitRule } from './commodity-profile';
import { inventoryAvailableAtoms, inventoryQuantityAtoms } from './inventory';

const units: CommodityUnitRule[] = [
  { code: 'KG', dimension: 'MASS', symbol: 'kg', isBase: true, precision: 3, numeratorToBase: '1', denominatorToBase: '1', sourceRef: 'test:si' },
  { code: 'TON', dimension: 'MASS', symbol: 't', isBase: false, precision: 6, numeratorToBase: '1000', denominatorToBase: '1', sourceRef: 'test:si' },
  { code: 'PACK', dimension: 'COUNT', symbol: 'pack', isBase: true, precision: 0, numeratorToBase: '1', denominatorToBase: '1', sourceRef: 'test:pack' },
];
describe('Pinned inventory quantities', () => {
  it('converts a millionth of a ton to one gram without rounding', () => {
    expect(inventoryQuantityAtoms(units, 'TON', '0.000001')).toEqual({ atoms: '1', baseUnitCode: 'KG', precision: 3, dimension: 'MASS' });
    expect(inventoryQuantityAtoms(units, 'TON', '12.345678').atoms).toBe('12345678');
  });
  it('keeps integers beyond the JavaScript safe-integer limit exact', () => {
    expect(inventoryQuantityAtoms(units, 'KG', '9007199254740.993').atoms).toBe('9007199254740993');
  });
  it('supports count and version-specific precision', () => {
    expect(inventoryQuantityAtoms(units, 'PACK', '17').atoms).toBe('17');
    expect(inventoryQuantityAtoms(units.map((u) => u.code === 'KG' ? { ...u, precision: 6 } : u), 'TON', '1').atoms).toBe('1000000000');
  });
  it.each(['0', '-1', '1e3', '01', 'NaN', 'Infinity', '1.0000001', ' 1', '1 '])('rejects invalid quantity %s', (quantity) => {
    expect(() => inventoryQuantityAtoms(units, 'TON', quantity)).toThrow();
  });
  it('rejects excess precision and nonrepresentable exact ratios', () => {
    expect(() => inventoryQuantityAtoms(units, 'PACK', '1.5')).toThrow();
    expect(() => inventoryQuantityAtoms([...units, { ...units[1]!, code: 'THIRD', numeratorToBase: '1', denominatorToBase: '3' }], 'THIRD', '1')).toThrow();
  });
  it('rejects bigint overflow, duplicate units, missing bases and non-stock dimensions', () => {
    expect(() => inventoryQuantityAtoms(units, 'TON', '9223372036855')).toThrow();
    expect(() => inventoryQuantityAtoms([...units, units[0]!], 'KG', '1')).toThrow();
    expect(() => inventoryQuantityAtoms([units[1]!], 'TON', '1')).toThrow();
    expect(() => inventoryQuantityAtoms([{ ...units[0]!, dimension: 'TEMPERATURE' }], 'KG', '1')).toThrow();
    expect(() => inventoryQuantityAtoms([{ ...units[0]!, numeratorToBase: '2' }], 'KG', '1')).toThrow();
  });
});
describe('Versioned inventory availability', () => {
  const buckets = { declaredQuantity: '1000', reservedQuantity: '200', committedQuantity: '300', blockedQuantity: '100', disputedQuantity: '50', depletedQuantity: '100' };
  it('subtracts each exclusive bucket exactly once', () => expect(inventoryAvailableAtoms(buckets)).toBe('250'));
  it('rejects oversold and negative states', () => {
    expect(() => inventoryAvailableAtoms({ ...buckets, reservedQuantity: '451' })).toThrow();
    expect(() => inventoryAvailableAtoms({ ...buckets, blockedQuantity: '-1' })).toThrow();
  });
  it('does not overflow when summing individually valid bigint quantities', () => {
    expect(() => inventoryAvailableAtoms({ ...buckets, declaredQuantity: '9223372036854775807', reservedQuantity: '9223372036854775807', committedQuantity: '1' })).toThrow();
  });
});
