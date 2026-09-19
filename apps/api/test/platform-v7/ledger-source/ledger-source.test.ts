import { describe, expect, it } from 'vitest';

import {
  PLATFORM_V7_LEDGER_SOURCE_ENTRIES,
  platformV7AssertLedgerSourceDecision,
  platformV7LedgerHasHeldMoney,
  platformV7LedgerSourceDecision,
  platformV7LedgerSourceViewFor,
} from '../../../src/platform-v7/ledger-source';

describe('platform-v7 ledger source boundary', () => {
  it('exposes frozen controlled-pilot ledger source entries without live claims', () => {
    expect(PLATFORM_V7_LEDGER_SOURCE_ENTRIES).toHaveLength(3);
    expect(Object.isFrozen(PLATFORM_V7_LEDGER_SOURCE_ENTRIES[0])).toBe(true);
    expect(PLATFORM_V7_LEDGER_SOURCE_ENTRIES.map((entry) => entry.source)).toEqual([
      'controlled-pilot-ledger-read-model',
      'controlled-pilot-ledger-read-model',
      'controlled-pilot-ledger-read-model',
    ]);
    expect(PLATFORM_V7_LEDGER_SOURCE_ENTRIES.map((entry) => entry.notes).join(' ')).not.toMatch(
      /production-ready|fully live|bank connected|fully integrated/i,
    );
  });

  it('builds deterministic integer-money ledger view by deal and tenant', () => {
    const view = platformV7LedgerSourceViewFor('DL-9102', 'TENANT-GRAIN-001');

    expect(view).not.toBeNull();
    expect(view?.reserved).toEqual({ currency: 'RUB', minorUnits: 296400000 });
    expect(view?.held).toEqual({ currency: 'RUB', minorUnits: 62400000 });
    expect(view?.released).toEqual({ currency: 'RUB', minorUnits: 0 });
    expect(view?.refunded).toEqual({ currency: 'RUB', minorUnits: 0 });
    expect(view?.commission).toEqual({ currency: 'RUB', minorUnits: 1482000 });
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view?.entries)).toBe(true);
  });

  it('returns null for unknown deal or tenant view', () => {
    expect(platformV7LedgerSourceViewFor('DL-404', 'TENANT-GRAIN-001')).toBeNull();
    expect(platformV7LedgerSourceViewFor('DL-9102', 'TENANT-OTHER')).toBeNull();
  });

  it('allows only canonical money-basis owner roles to read the ledger source', () => {
    expect(platformV7LedgerSourceDecision('bank', 'DL-9102', 'TENANT-GRAIN-001')).toMatchObject({
      allowed: true,
      reason: 'ledger-source-selected',
    });
    expect(platformV7LedgerSourceDecision('compliance', 'DL-9102', 'TENANT-GRAIN-001')).toMatchObject({
      allowed: true,
      reason: 'ledger-source-selected',
    });
    expect(platformV7LedgerSourceDecision('operator', 'DL-9102', 'TENANT-GRAIN-001')).toMatchObject({
      allowed: true,
      reason: 'ledger-source-selected',
    });
    expect(platformV7LedgerSourceDecision('executive', 'DL-9102', 'TENANT-GRAIN-001')).toMatchObject({
      allowed: true,
      reason: 'ledger-source-selected',
    });
  });

  it('rejects commercial and field roles through canonical money-basis policy', () => {
    expect(platformV7LedgerSourceDecision('seller', 'DL-9102', 'TENANT-GRAIN-001')).toMatchObject({
      allowed: false,
      reason: 'canonical-money-basis-rejected',
    });
    expect(platformV7LedgerSourceDecision('driver', 'DL-9102', 'TENANT-GRAIN-001')).toMatchObject({
      allowed: false,
      reason: 'canonical-money-basis-rejected',
    });
    expect(platformV7LedgerSourceDecision('lab', 'DL-9102', 'TENANT-GRAIN-001')).toMatchObject({
      allowed: false,
      reason: 'canonical-money-basis-rejected',
    });
  });

  it('separates unknown deal from tenant mismatch', () => {
    expect(platformV7LedgerSourceDecision('bank', 'DL-404', 'TENANT-GRAIN-001')).toMatchObject({
      allowed: false,
      reason: 'deal-mismatch',
    });
    expect(platformV7LedgerSourceDecision('bank', 'DL-9102', 'TENANT-OTHER')).toMatchObject({
      allowed: false,
      reason: 'tenant-mismatch',
    });
  });

  it('asserts accepted and rejected ledger decisions', () => {
    expect(() => platformV7AssertLedgerSourceDecision('bank', 'DL-9102', 'TENANT-GRAIN-001')).not.toThrow();
    expect(() => platformV7AssertLedgerSourceDecision('seller', 'DL-9102', 'TENANT-GRAIN-001')).toThrow(
      'canonical-money-basis-rejected',
    );
  });

  it('detects held money without mutating ledger state', () => {
    const view = platformV7LedgerSourceViewFor('DL-9102', 'TENANT-GRAIN-001');

    expect(view).not.toBeNull();
    expect(platformV7LedgerHasHeldMoney(view!)).toBe(true);
  });
});
