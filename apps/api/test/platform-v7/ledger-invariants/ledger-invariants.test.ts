import { describe, expect, it } from 'vitest';

import { PLATFORM_V7_LEDGER_SOURCE_ENTRIES, platformV7LedgerSourceViewFor, type PlatformV7LedgerEntry } from '../../../src/platform-v7/ledger-source';
import { platformV7MoneyInteger } from '../../../src/platform-v7/money-integer';
import {
  platformV7AssertLedgerInvariants,
  platformV7LedgerInvariantCheck,
  platformV7LedgerViewInvariantCheck,
} from '../../../src/platform-v7/ledger-invariants';

const balancingCredit: PlatformV7LedgerEntry = Object.freeze({
  entryId: 'LEDGER-DL-9102-BALANCE-001',
  dealId: 'DL-9102',
  tenantId: 'TENANT-GRAIN-001',
  kind: 'release',
  direction: 'credit',
  amount: platformV7MoneyInteger(357318000),
  status: 'posted',
  source: 'controlled-pilot-ledger-read-model',
  notes: 'Controlled-pilot balancing entry for invariant test only; no live settlement or bank movement.',
});

describe('platform-v7 ledger invariants boundary', () => {
  it('accepts deterministic balanced controlled-pilot ledger entries', () => {
    const result = platformV7LedgerInvariantCheck([...PLATFORM_V7_LEDGER_SOURCE_ENTRIES, balancingCredit]);

    expect(result).toMatchObject({
      valid: true,
      violations: [],
      currency: 'RUB',
      debitTotal: { currency: 'RUB', minorUnits: 358800000 },
      creditTotal: { currency: 'RUB', minorUnits: 358800000 },
      netDebit: { currency: 'RUB', minorUnits: 0 },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.violations)).toBe(true);
  });

  it('rejects the current read model as intentionally unbalanced without mutating it', () => {
    const result = platformV7LedgerInvariantCheck(PLATFORM_V7_LEDGER_SOURCE_ENTRIES);

    expect(result.valid).toBe(false);
    expect(result.violations).toContain('unbalanced-ledger');
    expect(PLATFORM_V7_LEDGER_SOURCE_ENTRIES).toHaveLength(3);
  });

  it('rejects empty ledgers', () => {
    expect(platformV7LedgerInvariantCheck([])).toMatchObject({
      valid: false,
      violations: ['empty-ledger'],
    });
  });

  it('rejects invalid metadata, unsafe money and fake-live notes at the boundary', () => {
    const invalidEntry = {
      ...PLATFORM_V7_LEDGER_SOURCE_ENTRIES[0],
      entryId: 'BAD-001',
      dealId: 'BAD-DEAL',
      tenantId: 'BAD-TENANT',
      amount: { currency: 'RUB', minorUnits: 1.5 },
      notes: 'production-ready fully live bank connected payment guarantee',
    } as PlatformV7LedgerEntry;

    const result = platformV7LedgerInvariantCheck([invalidEntry]);

    expect(result.valid).toBe(false);
    expect(result.violations).toEqual([
      'invalid-entry-id',
      'invalid-deal-id',
      'invalid-tenant-id',
      'invalid-notes',
      'unsafe-money',
      'unbalanced-ledger',
    ]);
  });

  it('rejects cross-currency ledgers before arithmetic acceptance', () => {
    const crossCurrencyEntry = {
      ...PLATFORM_V7_LEDGER_SOURCE_ENTRIES[0],
      entryId: 'LEDGER-DL-9102-USD-001',
      amount: { currency: 'USD', minorUnits: 100 },
    } as unknown as PlatformV7LedgerEntry;

    const result = platformV7LedgerInvariantCheck([PLATFORM_V7_LEDGER_SOURCE_ENTRIES[0], crossCurrencyEntry]);

    expect(result.valid).toBe(false);
    expect(result.violations).toContain('unsafe-money');
  });

  it('checks source view summaries against immutable entry sums', () => {
    const view = platformV7LedgerSourceViewFor('DL-9102', 'TENANT-GRAIN-001');

    expect(view).not.toBeNull();
    const result = platformV7LedgerViewInvariantCheck(view!);

    expect(result.violations).toContain('unbalanced-ledger');
    expect(result.violations).not.toContain('view-summary-mismatch');
  });

  it('rejects stale or mismatched source view summaries', () => {
    const view = platformV7LedgerSourceViewFor('DL-9102', 'TENANT-GRAIN-001');

    expect(view).not.toBeNull();
    const staleView = {
      ...view!,
      held: platformV7MoneyInteger(1),
    };

    expect(platformV7LedgerViewInvariantCheck(staleView).violations).toContain('view-summary-mismatch');
  });

  it('asserts accepted and rejected invariant states', () => {
    expect(() => platformV7AssertLedgerInvariants([...PLATFORM_V7_LEDGER_SOURCE_ENTRIES, balancingCredit])).not.toThrow();
    expect(() => platformV7AssertLedgerInvariants(PLATFORM_V7_LEDGER_SOURCE_ENTRIES)).toThrow(
      'platform-v7 ledger invariants rejected: unbalanced-ledger',
    );
  });
});
