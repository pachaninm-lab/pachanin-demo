export type LedgerEntryType = 'RESERVE' | 'HOLD' | 'RELEASE' | 'REFUND' | 'COMMISSION' | 'TRANSFER';

/**
 * Один источник правды для счетов книги.
 *
 * Раньше список существовал дважды: как union типа и как массив внутри
 * getBalances(). Разъехаться они могли молча — новый счёт в union, забытый в
 * массиве, делал бы проводки по нему невидимыми в балансах. Тип выводится из
 * массива, поэтому расхождение теперь невыразимо.
 */
export const LEDGER_ACCOUNTS = [
  'BUYER_ESCROW',
  'SELLER_SETTLEMENT',
  'COMMISSION_POOL',
  'DISPUTE_HOLD',
  'PLATFORM_RESERVE',
] as const;

export type LedgerAccountType = typeof LEDGER_ACCOUNTS[number];

const KNOWN_ACCOUNTS: ReadonlySet<string> = new Set(LEDGER_ACCOUNTS);

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
    return LEDGER_ACCOUNTS.map((account) => ({ account, balanceKopecks: this.getBalance(account) }));
  }

  /**
   * Сумма балансов по всем счетам обязана быть нулём.
   *
   * Прежняя версия начиналась с `total === debitTotal`, где обе величины
   * вычислялись БУКВАЛЬНО одним и тем же выражением — редукцией по
   * `amountKopecks`. Это `x === x`: замерено, что половина давала `true` в том
   * числе для книги с проводкой на счёт вне набора, то есть не проверяла
   * ничего. Сторож, который по построению не может упасть, — это заявление о
   * намерении, выданное за контроль.
   *
   * Осталась единственная величина, которая действительно может разойтись.
   * После проверки счетов в validateEntry это пост-условие, а не независимое
   * открытие: каждая проводка вносит −amount и +amount по двум известным
   * счетам. Проверка оставлена намеренно дешёвой страховкой на случай, если
   * getBalances() когда-нибудь начнёт перечислять подмножество счетов.
   */
  verifyDoubleEntryInvariant(): boolean {
    return this.getBalances().reduce((acc, b) => acc + b.balanceKopecks, 0) === 0;
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
  // Счёт вне известного набора принимался молча, а getBalances() его не
  // перечисляет — поэтому дебетовая сторона такой проводки исчезала из
  // балансов, а кредитовая оставалась. Замерено: книга с одной такой проводкой
  // на 50 000 копеек показывала BUYER_ESCROW −50 000 при нулях по остальным
  // счетам. Отказ на входе, а не искажённые балансы на выходе.
  for (const [side, account] of [['debitAccount', entry.debitAccount], ['creditAccount', entry.creditAccount]] as const) {
    if (!KNOWN_ACCOUNTS.has(account)) {
      throw new Error(`${side} is not a known ledger account: ${String(account)}`);
    }
  }
  if (!entry.id || !entry.dealId || !entry.actorId) {
    throw new Error('id, dealId, and actorId are required');
  }
}
