import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import type {
  BankOperationRecord,
  BankWorkspace,
  LedgerRecord,
  OutboxStatus,
  PaymentRecord,
  PaymentRepository,
  SettlementBlocker,
  SettlementDealRecord,
  SettlementWorkspace,
} from './payment.repository';

const MAX_LIST = 500;
const MAX_WORKSPACE_ROWS = 500;
const COMPLETE_DOCUMENT_STATUSES = new Set(['SIGNED', 'VALIDATED']);

@Injectable()
export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly rls: RlsTransactionService) {}

  async list(user: RequestUser, take = 100): Promise<PaymentRecord[]> {
    const bounded = Math.min(Math.max(Math.trunc(take), 1), MAX_LIST);
    return this.rls.withTrustedContext(user, async (tx) => {
      const payments = await tx.payment.findMany({
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: bounded,
      });
      return payments.map(paymentRecord);
    });
  }

  async detail(id: string, user: RequestUser): Promise<PaymentRecord> {
    const paymentId = requiredIdentifier(id, 'paymentId');
    return this.rls.withTrustedContext(user, async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw scopedNotFound('PAYMENT_NOT_AVAILABLE');
      return paymentRecord(payment);
    });
  }

  async worksheet(dealIdInput: string, user: RequestUser): Promise<SettlementWorkspace> {
    const dealId = requiredIdentifier(dealIdInput, 'dealId');
    return this.rls.withTrustedContext(user, (tx) => this.buildWorkspace(tx, dealId));
  }

  async bankWorkspace(dealIdInput: string, user: RequestUser): Promise<BankWorkspace> {
    const dealId = requiredIdentifier(dealIdInput, 'dealId');
    return this.rls.withTrustedContext(user, async (tx) => {
      const workspace = await this.buildWorkspace(tx, dealId);
      const entries = await tx.bankStatementEntry.findMany({
        where: { matchedDealId: dealId },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: MAX_WORKSPACE_ROWS,
      });
      return {
        ...workspace,
        statementEntries: entries.map((entry) => ({
          id: entry.id,
          amountKopecks: BigInt(entry.amountKopecks).toString(),
          currency: entry.currency,
          reference: entry.reference,
          matchStatus: entry.matchStatus,
          mismatchReason: entry.mismatchReason,
          createdAt: entry.createdAt.toISOString(),
        })),
      };
    });
  }

  async outboxStatus(
    dealIdInput: string | undefined,
    user: RequestUser,
  ): Promise<OutboxStatus> {
    const dealId = dealIdInput ? requiredIdentifier(dealIdInput, 'dealId') : undefined;
    return this.rls.withTrustedContext(user, async (tx) => {
      if (dealId) await this.requireDeal(tx, dealId);
      const financialTypes = [
        'BANK_RESERVE_REQUEST',
        'BANK_RELEASE_REQUEST',
        'BANK_REFUND_REQUEST',
        'bank.reserve.requested',
        'bank.release.requested',
      ];
      const where = {
        ...(dealId ? { dealId } : {}),
        type: { in: financialTypes },
      } as const;
      const [pendingRows, manualRows] = await Promise.all([
        tx.outboxEntry.findMany({
          where: { ...where, status: { in: ['PENDING', 'SENT', 'RETRY'] } },
          orderBy: [{ nextRetryAt: 'asc' }, { id: 'asc' }],
          take: MAX_WORKSPACE_ROWS,
        }),
        tx.outboxEntry.findMany({
          where: { ...where, status: { in: ['FAILED', 'DEAD_LETTER', 'MANUAL_REVIEW'] } },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: MAX_WORKSPACE_ROWS,
        }),
      ]);
      return {
        totalPending: pendingRows.length,
        pending: pendingRows.map((entry) => ({
          id: entry.id,
          type: entry.type,
          dealId: entry.dealId,
          status: entry.status,
          idempotencyKey: entry.idempotencyKey,
          correlationId: entry.correlationId,
          retryCount: entry.retryCount,
          nextRetryAt: entry.nextRetryAt.toISOString(),
          createdAt: entry.createdAt.toISOString(),
        })),
        manualReview: manualRows.map((entry) => ({
          id: entry.id,
          type: entry.type,
          dealId: entry.dealId,
          status: entry.status,
          lastError: entry.lastError,
          createdAt: entry.createdAt.toISOString(),
        })),
      };
    });
  }

  async exportDeals(
    params: { format?: string; from?: string; to?: string },
    user: RequestUser,
  ): Promise<{ contentType: string; fileName: string; body: string }> {
    const format = String(params.format ?? 'csv').trim().toLowerCase();
    if (format !== 'csv') throw new NotFoundException('Only CSV settlement export is available.');
    const from = optionalDate(params.from, 'from');
    const to = optionalDate(params.to, 'to');
    if (from && to && from > to) throw new NotFoundException('Settlement export date range is invalid.');

    return this.rls.withTrustedContext(user, async (tx) => {
      const payments = await tx.payment.findMany({
        where: from || to
          ? { updatedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : undefined,
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: 10_000,
      });
      const rows = [
        ['dealId', 'paymentId', 'status', 'amountKopecks', 'holdAmountKopecks', 'refundedKopecks', 'callbackState', 'version', 'updatedAt'],
        ...payments.map((payment) => {
          const record = paymentRecord(payment);
          return [
            record.dealId,
            record.id,
            record.status,
            record.amountKopecks ?? '',
            record.holdAmountKopecks,
            record.refundedKopecks,
            record.callbackState,
            record.version,
            record.updatedAt,
          ];
        }),
      ];
      return csvResponse('settlement-payments.csv', rows);
    });
  }

  async exportContractors(
    user: RequestUser,
  ): Promise<{ contentType: string; fileName: string; body: string }> {
    return this.rls.withTrustedContext(user, async (tx) => {
      const deals = await tx.deal.findMany({
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: 10_000,
        select: {
          id: true,
          sellerOrgId: true,
          buyerOrgId: true,
          payments: { select: { status: true, callbackState: true } },
        },
      });
      const rows: Array<Array<string>> = [['dealId', 'organizationId', 'role', 'paymentStatus', 'callbackState']];
      for (const deal of deals) {
        const payment = deal.payments[0];
        rows.push([deal.id, deal.sellerOrgId, 'SELLER', payment?.status ?? '', payment?.callbackState ?? '']);
        rows.push([deal.id, deal.buyerOrgId, 'BUYER', payment?.status ?? '', payment?.callbackState ?? '']);
      }
      return csvResponse('settlement-contractors.csv', rows);
    });
  }

  private async buildWorkspace(
    tx: Prisma.TransactionClient,
    dealId: string,
  ): Promise<SettlementWorkspace> {
    const deal = await this.requireDeal(tx, dealId);
    const [payment, operations, ledger, documents, openDisputes, mismatches] = await Promise.all([
      tx.payment.findFirst({ where: { dealId }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }] }),
      tx.bankOperation.findMany({
        where: { dealId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: MAX_WORKSPACE_ROWS,
      }),
      tx.ledgerEntry.findMany({
        where: { dealId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: MAX_WORKSPACE_ROWS,
      }),
      tx.dealDocument.findMany({
        where: { dealId, releaseRequired: true },
        select: { id: true, status: true, hash: true, s3Key: true, isImmutable: true, bankRequired: true, bankAcceptance: true },
        take: MAX_WORKSPACE_ROWS,
      }),
      tx.dispute.count({ where: { dealId, status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED'] } } }),
      tx.bankStatementEntry.count({ where: { matchedDealId: dealId, matchStatus: 'MISMATCH' } }),
    ]);

    const completeDocuments = documents.filter((document) =>
      COMPLETE_DOCUMENT_STATUSES.has(document.status)
      && Boolean(document.hash)
      && Boolean(document.s3Key)
      && document.isImmutable
      && (!document.bankRequired || document.bankAcceptance === 'ACCEPTED'));
    const blockers: SettlementBlocker[] = [];
    if (!payment || payment.amountKopecks === null) {
      blockers.push({ code: 'PAYMENT_BASIS_MISSING', message: 'Не зафиксирована сумма расчёта в копейках.' });
    }
    const hold = BigInt(payment?.holdAmountKopecks ?? 0);
    if (hold > 0n) {
      blockers.push({ code: 'PAYMENT_HOLD_ACTIVE', message: 'Часть суммы удерживается.', amountKopecks: hold.toString() });
    }
    if (openDisputes > 0) {
      blockers.push({ code: 'DISPUTE_OPEN', message: 'Открытый спор блокирует затронутую часть выплаты.' });
    }
    if (mismatches > 0) {
      blockers.push({ code: 'RECONCILIATION_MISMATCH', message: 'Банковская сверка требует ручной проверки.' });
    }
    if (documents.length !== completeDocuments.length) {
      blockers.push({ code: 'RELEASE_DOCUMENTS_INCOMPLETE', message: 'Не завершён комплект документов для выплаты.' });
    }

    return {
      deal: dealRecord(deal),
      payment: payment ? paymentRecord(payment) : null,
      blockers,
      bankOperations: operations.map(bankOperationRecord),
      ledger: ledger.map(ledgerRecord),
      releaseDocuments: {
        required: documents.length,
        complete: completeDocuments.length,
        isComplete: documents.length > 0 && documents.length === completeDocuments.length,
      },
    };
  }

  private async requireDeal(tx: Prisma.TransactionClient, dealId: string) {
    const deal = await tx.deal.findUnique({
      where: { id: dealId },
      select: {
        id: true,
        dealNumber: true,
        status: true,
        sellerOrgId: true,
        buyerOrgId: true,
        totalKopecks: true,
        currency: true,
        nextAction: true,
        version: true,
        updatedAt: true,
      },
    });
    if (!deal) throw scopedNotFound('DEAL_NOT_AVAILABLE');
    return deal;
  }
}

function paymentRecord(payment: {
  id: string;
  dealId: string;
  status: string;
  amountKopecks: bigint | null;
  holdAmountKopecks: bigint | null;
  refundedKopecks: bigint | null;
  commissionKopecks: bigint | null;
  reservedAt: Date | null;
  releasedAt: Date | null;
  callbackState: string;
  bankRef: string | null;
  escrowAccount: string | null;
  version: bigint;
  createdAt: Date;
  updatedAt: Date;
}): PaymentRecord {
  return {
    id: payment.id,
    dealId: payment.dealId,
    status: payment.status,
    amountKopecks: payment.amountKopecks === null ? null : payment.amountKopecks.toString(),
    holdAmountKopecks: BigInt(payment.holdAmountKopecks ?? 0).toString(),
    refundedKopecks: BigInt(payment.refundedKopecks ?? 0).toString(),
    commissionKopecks: BigInt(payment.commissionKopecks ?? 0).toString(),
    reservedAt: payment.reservedAt?.toISOString() ?? null,
    releasedAt: payment.releasedAt?.toISOString() ?? null,
    callbackState: payment.callbackState,
    bankRef: payment.bankRef,
    escrowAccount: payment.escrowAccount,
    version: payment.version.toString(),
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}

function bankOperationRecord(operation: {
  id: string;
  dealId: string;
  type: string;
  status: string;
  amountKopecks: bigint;
  currency: string;
  debitAccount: string;
  creditAccount: string;
  bankRef: string | null;
  bankName: string | null;
  idempotencyKey: string;
  initiatorUserId: string | null;
  confirmedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): BankOperationRecord {
  return {
    ...operation,
    amountKopecks: operation.amountKopecks.toString(),
    confirmedAt: operation.confirmedAt?.toISOString() ?? null,
    createdAt: operation.createdAt.toISOString(),
    updatedAt: operation.updatedAt.toISOString(),
  };
}

function ledgerRecord(entry: {
  id: string;
  dealId: string | null;
  entryType: string;
  debitAccount: string;
  creditAccount: string;
  amountKopecks: bigint;
  currency: string;
  reference: string | null;
  idempotencyKey: string;
  description: string | null;
  createdAt: Date;
  createdByUserId: string | null;
}): LedgerRecord {
  return {
    ...entry,
    amountKopecks: entry.amountKopecks.toString(),
    createdAt: entry.createdAt.toISOString(),
  };
}

function dealRecord(deal: {
  id: string;
  dealNumber: string | null;
  status: string;
  sellerOrgId: string;
  buyerOrgId: string;
  totalKopecks: bigint | null;
  currency: string;
  nextAction: string | null;
  version: bigint;
  updatedAt: Date;
}): SettlementDealRecord {
  return {
    ...deal,
    totalKopecks: deal.totalKopecks === null ? null : deal.totalKopecks.toString(),
    version: deal.version.toString(),
    updatedAt: deal.updatedAt.toISOString(),
  };
}

function requiredIdentifier(value: string, field: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > 200 || !/^[A-Za-z0-9:_.-]+$/.test(normalized)) {
    throw new NotFoundException({ code: 'INVALID_IDENTIFIER', field });
  }
  return normalized;
}

function optionalDate(value: string | undefined, field: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new NotFoundException({ code: 'INVALID_DATE', field });
  return parsed;
}

function csvResponse(fileName: string, rows: Array<Array<string>>) {
  return {
    contentType: 'text/csv; charset=utf-8',
    fileName,
    body: rows.map((row) => row.map(csvCell).join(',')).join('\n'),
  };
}

function csvCell(value: string): string {
  const normalized = String(value ?? '');
  return /[",\n\r]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function scopedNotFound(code: string): NotFoundException {
  return new NotFoundException({ code });
}
