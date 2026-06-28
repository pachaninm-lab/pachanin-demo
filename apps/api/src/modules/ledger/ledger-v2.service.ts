import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { createHash, randomUUID } from 'crypto';

export type LedgerEntryType =
  | 'RESERVE'
  | 'HOLD'
  | 'RELEASE'
  | 'REFUND'
  | 'COMMISSION'
  | 'PLATFORM_FEE'
  | 'PENALTY';

export interface LedgerMutationParams {
  dealId?: string;
  entryType: LedgerEntryType;
  debitAccount: string;
  creditAccount: string;
  amountKopecks: number;
  currency?: string;
  reference?: string;
  idempotencyKey: string;
  description?: string;
  createdByUserId?: string;
}

export interface AccountBalance {
  accountId: string;
  totalCreditKopecks: number;
  totalDebitKopecks: number;
  balanceKopecks: number;
}

// System accounts
export const SYSTEM_ACCOUNTS = {
  PLATFORM: 'sys:platform',
  ESCROW: 'sys:escrow',
  DISPUTE_HOLD: 'sys:dispute-hold',
} as const;

@Injectable()
export class LedgerV2Service {
  private readonly logger = new Logger(LedgerV2Service.name);

  // In-memory balance cache (in production: materialized view in DB)
  private readonly balances = new Map<string, number>(); // accountId → kopecks

  constructor(private readonly prisma: PrismaService) {}

  private getBalance(accountId: string): number {
    return this.balances.get(accountId) ?? 0;
  }

  private assertSufficientBalance(accountId: string, amountKopecks: number): void {
    const balance = this.getBalance(accountId);
    if (balance < amountKopecks) {
      throw new BadRequestException(
        `Insufficient balance for account ${accountId}: have ${balance} kopecks, need ${amountKopecks}`,
      );
    }
  }

  async record(params: LedgerMutationParams): Promise<{ id: string; balanceAfter: number }> {
    if (params.amountKopecks <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    // Validate balance for debit operations
    const debitRequired: LedgerEntryType[] = ['RESERVE', 'HOLD', 'RELEASE', 'REFUND', 'COMMISSION', 'PLATFORM_FEE', 'PENALTY'];
    if (debitRequired.includes(params.entryType) && params.debitAccount !== SYSTEM_ACCOUNTS.PLATFORM) {
      this.assertSufficientBalance(params.debitAccount, params.amountKopecks);
    }

    // Write to DB with idempotency
    let entry: { id: string };
    try {
      entry = await this.prisma.ledgerEntry.create({
        data: {
          dealId: params.dealId,
          entryType: params.entryType,
          debitAccount: params.debitAccount,
          creditAccount: params.creditAccount,
          amountKopecks: params.amountKopecks,
          currency: params.currency ?? 'RUB',
          reference: params.reference,
          idempotencyKey: params.idempotencyKey,
          description: params.description,
          createdByUserId: params.createdByUserId,
        },
      });
    } catch (err: any) {
      // Unique constraint = already processed (idempotent)
      if (err?.code === 'P2002') {
        const existing = await this.prisma.ledgerEntry.findUnique({
          where: { idempotencyKey: params.idempotencyKey },
        });
        return { id: existing!.id, balanceAfter: this.getBalance(params.creditAccount) };
      }
      throw err;
    }

    // Update in-memory balances
    this.balances.set(params.debitAccount, this.getBalance(params.debitAccount) - params.amountKopecks);
    this.balances.set(params.creditAccount, this.getBalance(params.creditAccount) + params.amountKopecks);

    this.logger.log(`Ledger: ${params.entryType} ${params.amountKopecks}k ${params.debitAccount}→${params.creditAccount} [${params.dealId ?? 'no deal'}]`);

    return { id: entry.id, balanceAfter: this.getBalance(params.creditAccount) };
  }

  async reserve(dealId: string, buyerOrgId: string, amountKopecks: number, ref: string): Promise<string> {
    const { id } = await this.record({
      dealId,
      entryType: 'RESERVE',
      debitAccount: buyerOrgId,
      creditAccount: SYSTEM_ACCOUNTS.ESCROW,
      amountKopecks,
      reference: ref,
      idempotencyKey: `reserve:${dealId}:${ref}`,
      description: `Резервирование средств по сделке ${dealId}`,
    });
    return id;
  }

  async release(dealId: string, sellerOrgId: string, amountKopecks: number, commissionKopecks: number, ref: string): Promise<void> {
    // Release to seller
    await this.record({
      dealId,
      entryType: 'RELEASE',
      debitAccount: SYSTEM_ACCOUNTS.ESCROW,
      creditAccount: sellerOrgId,
      amountKopecks,
      reference: ref,
      idempotencyKey: `release:${dealId}:${ref}`,
      description: `Выплата продавцу по сделке ${dealId}`,
    });
    // Commission to platform
    if (commissionKopecks > 0) {
      await this.record({
        dealId,
        entryType: 'COMMISSION',
        debitAccount: SYSTEM_ACCOUNTS.ESCROW,
        creditAccount: SYSTEM_ACCOUNTS.PLATFORM,
        amountKopecks: commissionKopecks,
        reference: ref,
        idempotencyKey: `commission:${dealId}:${ref}`,
        description: `Комиссия платформы по сделке ${dealId}`,
      });
    }
  }

  async holdForDispute(dealId: string, disputeId: string, amountKopecks: number): Promise<void> {
    await this.record({
      dealId,
      entryType: 'HOLD',
      debitAccount: SYSTEM_ACCOUNTS.ESCROW,
      creditAccount: SYSTEM_ACCOUNTS.DISPUTE_HOLD,
      amountKopecks,
      idempotencyKey: `hold:${disputeId}`,
      description: `Заморозка по спору ${disputeId}`,
    });
  }

  async refundFromDispute(dealId: string, disputeId: string, buyerOrgId: string, amountKopecks: number): Promise<void> {
    await this.record({
      dealId,
      entryType: 'REFUND',
      debitAccount: SYSTEM_ACCOUNTS.DISPUTE_HOLD,
      creditAccount: buyerOrgId,
      amountKopecks,
      idempotencyKey: `refund:${disputeId}`,
      description: `Возврат по спору ${disputeId}`,
    });
  }

  async getAccountBalance(accountId: string): Promise<AccountBalance> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { OR: [{ debitAccount: accountId }, { creditAccount: accountId }] },
    });
    let totalCredit = 0;
    let totalDebit = 0;
    for (const e of entries) {
      if (e.creditAccount === accountId) totalCredit += e.amountKopecks;
      if (e.debitAccount === accountId) totalDebit += e.amountKopecks;
    }
    return { accountId, totalCreditKopecks: totalCredit, totalDebitKopecks: totalDebit, balanceKopecks: totalCredit - totalDebit };
  }

  async getDealLedger(dealId: string) {
    return this.prisma.ledgerEntry.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Verify double-entry balance: sum(debit) == sum(credit) for a deal
  async verifyDealBalance(dealId: string): Promise<{ balanced: boolean; totalKopecks: number }> {
    const entries = await this.prisma.ledgerEntry.findMany({ where: { dealId } });
    const totalDebit = entries.reduce((s, e) => s + e.amountKopecks, 0);
    const totalCredit = entries.reduce((s, e) => s + e.amountKopecks, 0);
    return { balanced: totalDebit === totalCredit, totalKopecks: totalDebit };
  }
}
