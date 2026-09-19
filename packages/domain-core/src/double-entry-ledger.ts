export type LedgerEntryType = 'RESERVE' | 'HOLD' | 'RELEASE' | 'REFUND' | 'COMMISSION' | 'TRANSFER';

export type LedgerAccountType = 'BUYER_ESCROW' | 'SELLER_SETTLEMENT' | 'COMMISSION_POOL' | 'DISPUTE_HOLD' | 'PLATFORM_RESERVE';

export interface LedgerEntry {
  readonly id: string;
  readonly dealId: string;
  readonly entryType: LedgerEntryType;
  readonly debitAccount: LedgerAccountType;
  readonly creditAccount: LedgerAccountType;
  readonly amountKopecks: number; // always positive, in kopecks (integer)
  readonly currencyCode: 'RUB';
  readonly actorId: string;
  readonly reference?: string;
  readonly createdAt: string; // ISO-8601, append-only — never updated
}

export interface LedgerBalance {
  account: LedgerAccountType;
  balanceKopecks: number;
}

export class AppendOnlyLedger {
  private readonly entries: LedgerEntry[] = [];

  append(entry: Omit<LedgerEntry, 'createdAt'>): LedgerEntry {
    validateEntry(entry);
    const committed: LedgerEntry = { ...entry, createdAt: new Date().toISOString() };
    this.entries.push(committed);
    return committed;
  }

  reserve(params: { id: string; dealId: string; amountKopecks: number; actorId: string }): LedgerEntry {
    return this.append({ ...params, entryType: 'RESERVE', debitAccount: 'BUYER_ESCROW', creditAccount: 'PLATFORM_RESERVE', currencyCode: 'RUB' });
  }

  hold(params: { id: string; dealId: string; amountKopecks: number; actorId: string }): LedgerEntry {
    return this.append({ ...params, entryType: 'HOLD', debitAccount: 'PLATFORM_RESERVE', creditAccount: 'BUYER_ESCROW', currencyCode: 'RUB' });
  }

  release(params: { id: string; dealId: string; amountKopecks: number; actorId: string; commissionKopecks?: number }): { release: LedgerEntry; commission?: LedgerEntry } {
    const { commissionKopecks = 0, ...rest } = params;
    const net = params.amountKopecks - commissionKopecks;
    if (net <= 0) throw new Error('Net release amount must be positive');
    const release = this.append({ ...rest, amountKopecks: net, entryType: 'RELEASE', debitAccount: 'BUYER_ESCROW', creditAccount: 'SELLER_SETTLEMENT', currencyCode: 'RUB' });
    let commission: LedgerEntry | undefined;
    if (commissionKopecks > 0) {
      commission = this.append({ id: `${params.id}_comm`, dealId: params.dealId, actorId: params.actorId, amountKopecks: commissionKopecks, entryType: 'COMMISSION', debitAccount: 'BUYER_ESCROW', creditAccount: 'COMMISSION_POOL', currencyCode: 'RUB' });
    }
    return { release, commission };
  }

  refund(params: { id: string; dealId: string; amountKopecks: number; actorId: string }): LedgerEntry {
    return this.append({ ...params, entryType: 'REFUND', debitAccount: 'PLATFORM_RESERVE', creditAccount: 'BUYER_ESCROW', currencyCode: 'RUB' });
  }

  getEntriesByDeal(dealId: string): readonly LedgerEntry[] {
    return this.entries.filter((e) => e.dealId === dealId);
  }

  getBalance(account: LedgerAccountType): number {
    return this.entries.reduce((acc, e) => {
      if (e.debitAccount === account) return acc - e.amountKopecks;
      if (e.creditAccount === account) return acc + e.amountKopecks;
      return acc;
    }, 0);
  }

  getBalances(): LedgerBalance[] {
    const accounts: LedgerAccountType[] = ['BUYER_ESCROW', 'SELLER_SETTLEMENT', 'COMMISSION_POOL', 'DISPUTE_HOLD', 'PLATFORM_RESERVE'];
    return accounts.map((account) => ({ account, balanceKopecks: this.getBalance(account) }));
  }

  verifyDoubleEntryInvariant(): boolean {
    const total = this.entries.reduce((acc, e) => acc + e.amountKopecks, 0);
    const debitTotal = this.entries.reduce((acc, e) => acc + e.amountKopecks, 0);
    // Every entry has exactly one debit and one credit — sum of all debits == sum of all credits == sum of amounts
    // Net balance across all accounts must be zero
    const netAcrossAll = this.getBalances().reduce((acc, b) => acc + b.balanceKopecks, 0);
    return total === debitTotal && netAcrossAll === 0;
  }

  get length() {
    return this.entries.length;
  }
}

function validateEntry(entry: Omit<LedgerEntry, 'createdAt'>): void {
  if (!Number.isInteger(entry.amountKopecks) || entry.amountKopecks <= 0) {
    throw new Error(`amountKopecks must be a positive integer, got ${entry.amountKopecks}`);
  }
  if (entry.debitAccount === entry.creditAccount) {
    throw new Error('debitAccount and creditAccount must differ');
  }
  if (!entry.id || !entry.dealId || !entry.actorId) {
    throw new Error('id, dealId, and actorId are required');
  }
}
