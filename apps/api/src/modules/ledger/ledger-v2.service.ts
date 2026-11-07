import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

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
  amountKopecks: bigint | number;
  currency?: string;
  reference?: string;
  idempotencyKey: string;
  description?: string;
  createdByUserId?: string;
}

export interface AccountBalance {
  accountId: string;
  totalCreditKopecks: bigint;
  totalDebitKopecks: bigint;
  balanceKopecks: bigint;
}

// System accounts
export const SYSTEM_ACCOUNTS = {
  PLATFORM: 'sys:platform',
  ESCROW: 'sys:escrow',
  DISPUTE_HOLD: 'sys:dispute-hold',
} as const;

function toKopecks(value: bigint | number): bigint {
  if (typeof value === 'bigint') return value;
  if (!Number.isSafeInteger(value)) {
    throw new BadRequestException(`Kopeck amount must be a safe integer, got: ${value}`);
  }
  return BigInt(value);
}

@Injectable()
export class LedgerV2Service {
  private readonly logger = new Logger(LedgerV2Service.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Account balance is derived from the append-only ledger itself —
   * PostgreSQL is the only source of truth, never process memory.
   */
  private async currentBalance(accountId: string): Promise<bigint> {
    const balance = await this.getAccountBalance(accountId);
    return balance.balanceKopecks;
  }

  private async assertSufficientBalance(accountId: string, amountKopecks: bigint): Promise<void> {
    const balance = await this.currentBalance(accountId);
    if (balance < amountKopecks) {
      throw new BadRequestException(
        `Insufficient balance for account ${accountId}: have ${balance} kopecks, need ${amountKopecks}`,
      );
    }
  }

  async record(params: LedgerMutationParams): Promise<{ id: string; balanceAfter: bigint }> {
    const amountKopecks = toKopecks(params.amountKopecks);
    if (amountKopecks <= 0n) {
      throw new BadRequestException('Amount must be positive');
    }
    // Двойная запись требует двух разных счетов. Доменная книга это уже
    // запрещает (validateEntry, «debitAccount and creditAccount must differ»),
    // а этот путь писал в БД без такой проверки. Самоперевод не меняет баланс,
    // но одинаково завышает и дебетовый, и кредитовый итоги счёта, а на них
    // опирается assertSufficientBalance.
    //
    // Ни один из пяти существующих вызовов record() так не делает: каждый
    // спаривает системный счёт (`sys:*`) с org id либо два разных системных.
    // Проверка закрывает путь для будущих вызовов, не ломая нынешние.
    if (!params.debitAccount || !params.creditAccount) {
      throw new BadRequestException('debitAccount and creditAccount are required');
    }
    if (params.debitAccount === params.creditAccount) {
      throw new BadRequestException('debitAccount and creditAccount must differ');
    }

    // Validate balance for debit operations
    const debitRequired: LedgerEntryType[] = ['RESERVE', 'HOLD', 'RELEASE', 'REFUND', 'COMMISSION', 'PLATFORM_FEE', 'PENALTY'];
    if (debitRequired.includes(params.entryType) && params.debitAccount !== SYSTEM_ACCOUNTS.PLATFORM) {
      await this.assertSufficientBalance(params.debitAccount, amountKopecks);
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
          amountKopecks,
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
        return { id: existing!.id, balanceAfter: await this.currentBalance(params.creditAccount) };
      }
      throw err;
    }

    this.logger.log(`Ledger: ${params.entryType} ${amountKopecks}k ${params.debitAccount}→${params.creditAccount} [${params.dealId ?? 'no deal'}]`);

    return { id: entry.id, balanceAfter: await this.currentBalance(params.creditAccount) };
  }

  async reserve(dealId: string, buyerOrgId: string, amountKopecks: bigint | number, ref: string): Promise<string> {
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

  async release(dealId: string, sellerOrgId: string, amountKopecks: bigint | number, commissionKopecks: bigint | number, ref: string): Promise<void> {
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
    if (toKopecks(commissionKopecks) > 0n) {
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

  async holdForDispute(dealId: string, disputeId: string, amountKopecks: bigint | number): Promise<void> {
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

  async refundFromDispute(dealId: string, disputeId: string, buyerOrgId: string, amountKopecks: bigint | number): Promise<void> {
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
    const rows = await this.prisma.$queryRaw<Array<{ credit: bigint | null; debit: bigint | null }>>(Prisma.sql`
      SELECT
        (SELECT COALESCE(SUM("amountKopecks"), 0)::bigint FROM "ledger_entries" WHERE "creditAccount" = ${accountId}) AS credit,
        (SELECT COALESCE(SUM("amountKopecks"), 0)::bigint FROM "ledger_entries" WHERE "debitAccount" = ${accountId}) AS debit
    `);
    const totalCredit = rows[0]?.credit ?? 0n;
    const totalDebit = rows[0]?.debit ?? 0n;
    return {
      accountId,
      totalCreditKopecks: totalCredit,
      totalDebitKopecks: totalDebit,
      balanceKopecks: totalCredit - totalDebit,
    };
  }

  async getDealLedger(dealId: string) {
    return this.prisma.ledgerEntry.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Проверка книги сделки по строкам, лежащим в БД.
   *
   * Прежняя версия вычисляла totalDebit и totalCredit БУКВАЛЬНО одним и тем же
   * выражением — редукцией по amountKopecks, — и возвращала их равенство.
   * То есть `balanced` было тождественно true: метод с именем verify не мог
   * вернуть false ни при каких данных.
   *
   * Равенство дебета и кредита в этой схеме и правда структурно: одна строка
   * несёт одну пару счетов и одну сумму. Поэтому проверяется не оно, а то, что
   * в строках действительно может быть нарушено. Строки пишет record(), но
   * колонки `debitAccount`/`creditAccount` объявлены лишь NOT NULL, а
   * `amountKopecks` не имеет CHECK, так что строка из миграции, восстановления
   * или ручной правки этих проверок не проходила.
   */
  async verifyDealBalance(dealId: string): Promise<{
    balanced: boolean;
    totalKopecks: bigint;
    violations: string[];
  }> {
    const entries = await this.prisma.ledgerEntry.findMany({ where: { dealId } });
    const violations: string[] = [];
    let totalKopecks = 0n;

    for (const entry of entries) {
      const amount = BigInt(entry.amountKopecks);
      if (amount <= 0n) {
        violations.push(`${entry.id}: непозитивная сумма ${amount}`);
      }
      if (!entry.debitAccount || !entry.creditAccount) {
        violations.push(`${entry.id}: пустой счёт одной из сторон`);
      } else if (entry.debitAccount === entry.creditAccount) {
        violations.push(`${entry.id}: самоперевод по счёту ${entry.debitAccount}`);
      }
      totalKopecks += amount;
    }

    return { balanced: violations.length === 0, totalKopecks, violations };
  }

  /**
   * Escrow invariant for one deal: money can never leave the deal's escrow
   * account beyond what was reserved into it. Computed exclusively from the
   * append-only ledger — a violation means tampering or a double release.
   */
  async verifyDealEscrowInvariant(dealId: string): Promise<{
    ok: boolean;
    escrowAccount: string;
    reservedKopecks: bigint;
    releasedKopecks: bigint;
    escrowBalanceKopecks: bigint;
  }> {
    const escrowAccount = `escrow:${dealId}`;
    const entries = await this.prisma.ledgerEntry.findMany({ where: { dealId } });
    const credited = entries
      .filter((entry) => entry.creditAccount === escrowAccount)
      .reduce((sum, entry) => sum + BigInt(entry.amountKopecks), 0n);
    const debited = entries
      .filter((entry) => entry.debitAccount === escrowAccount)
      .reduce((sum, entry) => sum + BigInt(entry.amountKopecks), 0n);
    const balance = credited - debited;
    return {
      ok: balance >= 0n,
      escrowAccount,
      reservedKopecks: credited,
      releasedKopecks: debited,
      escrowBalanceKopecks: balance,
    };
  }
}
