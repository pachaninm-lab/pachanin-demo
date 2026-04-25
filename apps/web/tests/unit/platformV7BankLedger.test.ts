import { describe, expect, it } from 'vitest';
import {
  platformV7BankLedgerBlocksRelease,
  platformV7BankLedgerEntryKey,
  platformV7BankLedgerSummary,
  type PlatformV7BankLedgerEntry,
} from '@/lib/platform-v7/bank-ledger';

const entries: PlatformV7BankLedgerEntry[] = [
  { id: 'b1', dealId: 'DL-1', type: 'reserve', amount: 1_000_000, status: 'confirmed', externalRef: 'ext-1', createdAt: '2026-04-25T10:00:00.000Z', confirmedAt: '2026-04-25T10:01:00.000Z' },
  { id: 'b2', dealId: 'DL-1', type: 'hold', amount: 100_000, status: 'confirmed', createdAt: '2026-04-25T10:05:00.000Z', confirmedAt: '2026-04-25T10:06:00.000Z' },
  { id: 'b3', dealId: 'DL-1', type: 'release', amount: 900_000, status: 'confirmed', createdAt: '2026-04-25T10:10:00.000Z', confirmedAt: '2026-04-25T10:11:00.000Z' },
  { id: 'b4', dealId: 'DL-2', type: 'reserve', amount: 500_000, status: 'pending', createdAt: '2026-04-25T10:00:00.000Z' },
];

describe('platform-v7 bank ledger', () => {
  it('summarizes confirmed ledger movements by deal', () => {
    const summary = platformV7BankLedgerSummary('DL-1', entries);

    expect(summary.reserved).toBe(1_000_000);
    expect(summary.held).toBe(100_000);
    expect(summary.released).toBe(900_000);
    expect(summary.balance).toBe(0);
    expect(summary.isBalanced).toBe(true);
    expect(platformV7BankLedgerBlocksRelease(summary)).toBe(false);
  });

  it('blocks release when ledger has pending entries', () => {
    const summary = platformV7BankLedgerSummary('DL-2', entries);

    expect(summary.pending).toBe(1);
    expect(platformV7BankLedgerBlocksRelease(summary)).toBe(true);
  });

  it('builds stable ledger entry keys', () => {
    expect(platformV7BankLedgerEntryKey(entries[0]!)).toBe('DL-1:b1:confirmed');
  });
});
