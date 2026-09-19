export type PlatformV7BankLedgerEntryType = 'reserve' | 'hold' | 'release' | 'refund' | 'fee';
export type PlatformV7BankLedgerEntryStatus = 'pending' | 'confirmed' | 'failed' | 'reversed';

export interface PlatformV7BankLedgerEntry {
  id: string;
  dealId: string;
  type: PlatformV7BankLedgerEntryType;
  amount: number;
  status: PlatformV7BankLedgerEntryStatus;
  externalRef?: string;
  createdAt: string;
  confirmedAt?: string;
}

export interface PlatformV7BankLedgerSummary {
  dealId: string;
  reserved: number;
  held: number;
  released: number;
  refunded: number;
  fees: number;
  pending: number;
  failed: number;
  balance: number;
  isBalanced: boolean;
}

export function platformV7BankLedgerSummary(
  dealId: string,
  entries: PlatformV7BankLedgerEntry[],
): PlatformV7BankLedgerSummary {
  const dealEntries = entries.filter((entry) => entry.dealId === dealId);
  const confirmed = dealEntries.filter((entry) => entry.status === 'confirmed');
  const sum = (type: PlatformV7BankLedgerEntryType) => confirmed
    .filter((entry) => entry.type === type)
    .reduce((total, entry) => total + Math.max(0, entry.amount), 0);

  const reserved = sum('reserve');
  const held = sum('hold');
  const released = sum('release');
  const refunded = sum('refund');
  const fees = sum('fee');
  const pending = dealEntries.filter((entry) => entry.status === 'pending').length;
  const failed = dealEntries.filter((entry) => entry.status === 'failed').length;
  const balance = reserved - held - released - refunded - fees;

  return {
    dealId,
    reserved,
    held,
    released,
    refunded,
    fees,
    pending,
    failed,
    balance,
    isBalanced: balance >= 0 && failed === 0,
  };
}

export function platformV7BankLedgerEntryKey(entry: PlatformV7BankLedgerEntry): string {
  return `${entry.dealId}:${entry.id}:${entry.status}`;
}

export function platformV7BankLedgerBlocksRelease(summary: PlatformV7BankLedgerSummary): boolean {
  return summary.pending > 0 || summary.failed > 0 || !summary.isBalanced;
}
