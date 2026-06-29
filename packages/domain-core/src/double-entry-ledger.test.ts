import { describe, it, expect } from 'vitest';
import { AppendOnlyLedger } from './double-entry-ledger';

describe('AppendOnlyLedger', () => {
  const mkParams = (id: string, amountKopecks: number) => ({
    id,
    dealId: 'd1',
    actorId: 'bank-service',
    amountKopecks,
  });

  it('reserve increases PLATFORM_RESERVE and decreases BUYER_ESCROW', () => {
    const ledger = new AppendOnlyLedger();
    ledger.reserve(mkParams('e1', 500_000_00));
    expect(ledger.getBalance('PLATFORM_RESERVE')).toBe(500_000_00);
    expect(ledger.getBalance('BUYER_ESCROW')).toBe(-500_000_00);
  });

  it('release cycles: reserve → release with commission', () => {
    const ledger = new AppendOnlyLedger();
    ledger.reserve(mkParams('e1', 100_000_00));
    const { release, commission } = ledger.release({ id: 'e2', dealId: 'd1', actorId: 'bank-service', amountKopecks: 100_000_00, commissionKopecks: 1_000_00 });
    expect(release.amountKopecks).toBe(99_000_00);
    expect(commission?.amountKopecks).toBe(1_000_00);
    expect(ledger.getBalance('SELLER_SETTLEMENT')).toBe(99_000_00);
    expect(ledger.getBalance('COMMISSION_POOL')).toBe(1_000_00);
  });

  it('refund returns funds to BUYER_ESCROW', () => {
    const ledger = new AppendOnlyLedger();
    ledger.reserve(mkParams('e1', 50_000_00));
    ledger.refund(mkParams('e2', 50_000_00));
    expect(ledger.getBalance('BUYER_ESCROW')).toBe(0);
  });

  it('rejects non-integer amountKopecks', () => {
    const ledger = new AppendOnlyLedger();
    expect(() => ledger.reserve({ ...mkParams('e1', 100.5) })).toThrow('positive integer');
  });

  it('rejects zero or negative amount', () => {
    const ledger = new AppendOnlyLedger();
    expect(() => ledger.reserve(mkParams('e1', 0))).toThrow('positive integer');
    expect(() => ledger.reserve(mkParams('e2', -1000))).toThrow('positive integer');
  });

  it('rejects same debit and credit accounts via append', () => {
    const ledger = new AppendOnlyLedger();
    expect(() =>
      ledger.append({
        id: 'e1', dealId: 'd1', actorId: 'a', amountKopecks: 1000,
        entryType: 'TRANSFER',
        debitAccount: 'BUYER_ESCROW',
        creditAccount: 'BUYER_ESCROW',
        currencyCode: 'RUB',
      })
    ).toThrow('must differ');
  });

  it('verifies double-entry invariant', () => {
    const ledger = new AppendOnlyLedger();
    ledger.reserve(mkParams('e1', 200_000_00));
    ledger.release({ id: 'e2', dealId: 'd1', actorId: 'bank-service', amountKopecks: 200_000_00, commissionKopecks: 2_000_00 });
    expect(ledger.verifyDoubleEntryInvariant()).toBe(true);
  });

  it('entries are append-only — length only grows', () => {
    const ledger = new AppendOnlyLedger();
    ledger.reserve(mkParams('e1', 10_000_00));
    ledger.reserve(mkParams('e2', 20_000_00));
    expect(ledger.length).toBe(2);
  });

  it('getEntriesByDeal returns only matching entries', () => {
    const ledger = new AppendOnlyLedger();
    ledger.reserve({ id: 'e1', dealId: 'd1', actorId: 'a', amountKopecks: 10_000_00 });
    ledger.reserve({ id: 'e2', dealId: 'd2', actorId: 'a', amountKopecks: 20_000_00 });
    expect(ledger.getEntriesByDeal('d1').length).toBe(1);
    expect(ledger.getEntriesByDeal('d2').length).toBe(1);
  });
});
