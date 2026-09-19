import { Injectable, BadRequestException, ConflictException, Logger } from '@nestjs/common';

// All amounts stored as integer kopecks — NEVER float
export type Kopecks = number;

export type EntryType =
  | 'RESERVE'       // buyer_account → escrow (hold until delivery)
  | 'HOLD'          // escrow → dispute_hold (freeze during dispute)
  | 'RELEASE'       // escrow → seller_account (conditions met)
  | 'REFUND'        // dispute_hold → buyer_account (seller at fault)
  | 'COMMISSION'    // escrow → platform_account
  | 'PLATFORM_FEE'  // escrow → platform_account (ЭДО fee)
  | 'PENALTY';      // dispute_hold → platform_account (fine)

export interface LedgerEntry {
  id: string;
  dealId?: string;
  entryType: EntryType;
  debitAccountId: string;
  creditAccountId: string;
  amountKopecks: Kopecks;
  currency: string;
  idempotencyKey: string;
  reference?: string;
  note?: string;
  createdAt: string;
}

export interface Account {
  id: string;
  name: string;
  balanceKopecks: Kopecks;
  reservedKopecks: Kopecks;
}

// System accounts
const SYSTEM_ACCOUNTS: Record<string, Account> = {
  ESCROW: { id: 'acc-escrow', name: 'Escrow (номинальный счёт)', balanceKopecks: 0, reservedKopecks: 0 },
  DISPUTE_HOLD: { id: 'acc-dispute-hold', name: 'Dispute Hold', balanceKopecks: 0, reservedKopecks: 0 },
  PLATFORM: { id: 'acc-platform', name: 'Platform Revenue', balanceKopecks: 0, reservedKopecks: 0 },
};

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);
  private readonly entries: LedgerEntry[] = [];
  private readonly accounts = new Map<string, Account>(
    Object.entries(SYSTEM_ACCOUNTS).map(([, acc]) => [acc.id, { ...acc }])
  );
  private readonly processedKeys = new Set<string>();

  private getOrCreateAccount(id: string): Account {
    if (!this.accounts.has(id)) {
      this.accounts.set(id, { id, name: id, balanceKopecks: 0, reservedKopecks: 0 });
    }
    return this.accounts.get(id)!;
  }

  post(params: {
    dealId?: string;
    entryType: EntryType;
    debitAccountId: string;
    creditAccountId: string;
    amountKopecks: Kopecks;
    currency?: string;
    idempotencyKey: string;
    reference?: string;
    note?: string;
  }): LedgerEntry {
    if (params.amountKopecks <= 0) {
      throw new BadRequestException('Сумма проводки должна быть положительной');
    }
    if (!Number.isInteger(params.amountKopecks)) {
      throw new BadRequestException('Сумма должна быть целым числом копеек');
    }
    if (this.processedKeys.has(params.idempotencyKey)) {
      const existing = this.entries.find(e => e.idempotencyKey === params.idempotencyKey);
      if (existing) return existing;
      throw new ConflictException(`Idempotency key already processed: ${params.idempotencyKey}`);
    }

    const debitAcc = this.getOrCreateAccount(params.debitAccountId);
    const creditAcc = this.getOrCreateAccount(params.creditAccountId);

    // Invariant: debit account must have sufficient balance (except for initial RESERVE from buyer)
    if (params.entryType !== 'RESERVE' && debitAcc.balanceKopecks < params.amountKopecks) {
      throw new BadRequestException(
        `Недостаточно средств на счёте ${params.debitAccountId}: ` +
        `баланс ${debitAcc.balanceKopecks} коп, требуется ${params.amountKopecks} коп`
      );
    }

    if (params.entryType === 'RESERVE') {
      debitAcc.reservedKopecks += params.amountKopecks;
    }
    debitAcc.balanceKopecks -= params.amountKopecks;
    creditAcc.balanceKopecks += params.amountKopecks;

    this.processedKeys.add(params.idempotencyKey);

    const entry: LedgerEntry = {
      id: `ledger-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      dealId: params.dealId,
      entryType: params.entryType,
      debitAccountId: params.debitAccountId,
      creditAccountId: params.creditAccountId,
      amountKopecks: params.amountKopecks,
      currency: params.currency ?? 'RUB',
      idempotencyKey: params.idempotencyKey,
      reference: params.reference,
      note: params.note,
      createdAt: new Date().toISOString(),
    };
    this.entries.push(entry);

    this.logger.log(
      `Ledger ${params.entryType}: ${params.debitAccountId} → ${params.creditAccountId} ` +
      `${params.amountKopecks} коп (deal=${params.dealId ?? '-'})`
    );
    return entry;
  }

  reserve(dealId: string, buyerAccountId: string, amountKopecks: Kopecks): LedgerEntry {
    return this.post({
      dealId,
      entryType: 'RESERVE',
      debitAccountId: buyerAccountId,
      creditAccountId: SYSTEM_ACCOUNTS.ESCROW.id,
      amountKopecks,
      idempotencyKey: `reserve:${dealId}`,
      note: 'Резервирование оплаты в escrow',
    });
  }

  releaseToSeller(dealId: string, sellerAccountId: string, netAmountKopecks: Kopecks): LedgerEntry {
    return this.post({
      dealId,
      entryType: 'RELEASE',
      debitAccountId: SYSTEM_ACCOUNTS.ESCROW.id,
      creditAccountId: sellerAccountId,
      amountKopecks: netAmountKopecks,
      idempotencyKey: `release:${dealId}`,
      note: 'Освобождение оплаты продавцу (за вычетом комиссии)',
    });
  }

  chargeCommission(dealId: string, commissionKopecks: Kopecks): LedgerEntry {
    return this.post({
      dealId,
      entryType: 'COMMISSION',
      debitAccountId: SYSTEM_ACCOUNTS.ESCROW.id,
      creditAccountId: SYSTEM_ACCOUNTS.PLATFORM.id,
      amountKopecks: commissionKopecks,
      idempotencyKey: `commission:${dealId}`,
      note: 'Комиссия платформы 0.5% + 0.5%',
    });
  }

  holdForDispute(dealId: string, amountKopecks: Kopecks): LedgerEntry {
    return this.post({
      dealId,
      entryType: 'HOLD',
      debitAccountId: SYSTEM_ACCOUNTS.ESCROW.id,
      creditAccountId: SYSTEM_ACCOUNTS.DISPUTE_HOLD.id,
      amountKopecks,
      idempotencyKey: `dispute-hold:${dealId}`,
      note: 'Заморозка при открытии спора',
    });
  }

  refundToBuyer(dealId: string, buyerAccountId: string, amountKopecks: Kopecks): LedgerEntry {
    return this.post({
      dealId,
      entryType: 'REFUND',
      debitAccountId: SYSTEM_ACCOUNTS.DISPUTE_HOLD.id,
      creditAccountId: buyerAccountId,
      amountKopecks,
      idempotencyKey: `refund:${dealId}`,
      note: 'Возврат покупателю по решению арбитра',
    });
  }

  // Legacy compatibility
  record(entry: { dealId: string; amount: number; type: string; note?: string }) {
    return this.post({
      dealId: entry.dealId,
      entryType: (entry.type as EntryType) || 'RESERVE',
      debitAccountId: 'legacy-debit',
      creditAccountId: 'legacy-credit',
      amountKopecks: Math.round(entry.amount * 100),
      idempotencyKey: `legacy-${entry.dealId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      note: entry.note,
    });
  }

  list(dealId: string): LedgerEntry[] {
    return this.entries.filter(e => e.dealId === dealId);
  }

  getAccount(accountId: string): Account | undefined {
    return this.accounts.get(accountId);
  }

  verifyInvariant(dealId: string): { balanced: boolean; totalDebitKopecks: Kopecks; totalCreditKopecks: Kopecks } {
    const dealEntries = this.list(dealId);
    // For a closed deal: sum of all RELEASE + COMMISSION + REFUND must equal RESERVE
    const reserved = dealEntries.filter(e => e.entryType === 'RESERVE').reduce((s, e) => s + e.amountKopecks, 0);
    const released = dealEntries
      .filter(e => ['RELEASE', 'COMMISSION', 'REFUND', 'PENALTY', 'PLATFORM_FEE'].includes(e.entryType))
      .reduce((s, e) => s + e.amountKopecks, 0);
    return { balanced: reserved === released, totalDebitKopecks: reserved, totalCreditKopecks: released };
  }

  getPlatformRevenue(): Kopecks {
    return this.accounts.get(SYSTEM_ACCOUNTS.PLATFORM.id)?.balanceKopecks ?? 0;
  }
}
