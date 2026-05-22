import { ForbiddenException, Injectable, Logger, Optional } from '@nestjs/common';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import { ActionExecutorService } from '../../common/action-executor/action-executor.service';
import { OutboxService } from '../../common/outbox/outbox.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';

const MONEY_MUTATION_ROLES: Set<Role> = new Set([
  Role.ADMIN,
  Role.SUPPORT_MANAGER,
  Role.ACCOUNTING,
]);

@Injectable()
export class SettlementEngineService {
  private readonly logger = new Logger(SettlementEngineService.name);

  constructor(
    private readonly runtime: RuntimeCoreService,
    private readonly executor: ActionExecutorService,
    private readonly outbox: OutboxService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  worksheet(dealId: string) {
    return this.runtime.worksheet(dealId);
  }

  bankWorkspace(dealId: string) {
    return this.runtime.bankWorkspace(dealId);
  }

  listPayments(user: RequestUser) {
    return this.runtime.listPayments();
  }

  paymentDetail(id: string, user: RequestUser) {
    return this.runtime.paymentDetail(id);
  }

  async exportDeals(_params: any, _user: RequestUser) {
    const payments = this.runtime.listPayments();
    const rows = [
      ['dealId', 'status', 'amountRub', 'callbackState'],
      ...payments.map((p: any) => [p.dealId, p.status, String(p.amountRub), p.callbackState ?? '']),
    ];
    return {
      contentType: 'text/csv',
      fileName: 'deals-export.csv',
      body: rows.map((row) => row.join(',')).join('\n'),
    };
  }

  async exportContractors(_user: RequestUser) {
    const rows = [['dealId', 'beneficiaryId', 'role', 'bankStatus']];
    for (const payment of this.runtime.listPayments()) {
      const bank = this.runtime.bankWorkspace((payment as any).dealId);
      for (const beneficiary of bank.beneficiaries) {
        rows.push([(payment as any).dealId, beneficiary.id, beneficiary.role, beneficiary.bankStatus]);
      }
    }
    return {
      contentType: 'text/csv',
      fileName: 'contractors.csv',
      body: rows.map((row) => row.join(',')).join('\n'),
    };
  }

  /**
   * Request reserve: creates an outbox entry for the bank.
   * Payment stays RESERVE_PENDING until bank callback arrives.
   * Platform never self-confirms a reserve.
   */
  async requestReserve(dealId: string, user: RequestUser) {
    this.assertMoneyMutationRole(user);
    const ws = this.runtime.worksheet(dealId);
    const { result } = await this.executor.execute({
      user,
      action: 'money.reserve.request',
      scope: { objectType: 'deal', objectId: dealId },
      bankOutbox: {
        type: 'BANK_RESERVE_REQUEST',
        payload: {
          dealId,
          amountRub: ws.payment?.amountRub,
          bankEventId: ws.payment?.bankEventId,
        },
      },
      fn: () => this.runtime.reservePrepayment(dealId, user),
    });
    const outboxEntries = this.outbox.getByDeal(dealId);
    const ws2 = this.runtime.worksheet(dealId);
    this.upsertPayment(dealId, ws2.payment).catch((e) => this.logger.debug(`Payment DB write skipped: ${e.message}`));
    return { ...result, outboxStatus: 'PENDING', outboxId: outboxEntries.at(-1)?.id };
  }

  /**
   * Request release: creates an outbox entry for the bank.
   * Payment stays CALLBACK_PENDING until bank release callback arrives.
   * Platform never self-releases money.
   */
  async requestRelease(dealId: string, user: RequestUser) {
    this.assertMoneyMutationRole(user);
    const ws = this.runtime.dealWorkspace(dealId);
    const blockers = ws.blockers ?? [];

    if (blockers.length > 0) {
      return {
        dealId,
        released: false,
        blocked: true,
        blockers,
        message: 'Release blocked — resolve all blockers first',
      };
    }

    const { result } = await this.executor.execute({
      user,
      action: 'money.release.request',
      scope: { objectType: 'deal', objectId: dealId },
      gates: {
        disputeOpen: ws.payment?.status === 'HOLD_ACTIVE' && ws.blockers?.some((b: string) => b.includes('спор')),
        documentsComplete: ws.completeness?.isComplete,
        reserveConfirmed: ['RESERVED', 'HOLD_ACTIVE', 'READY_FOR_RELEASE'].includes(ws.payment?.status),
      },
      bankOutbox: {
        type: 'BANK_RELEASE_REQUEST',
        payload: {
          dealId,
          amountRub: ws.payment?.undisputedAmountRub,
          bankEventId: ws.payment?.bankEventId,
          beneficiaries: ws.bankWorkspace?.beneficiaries,
        },
      },
      fn: () => ({
        dealId,
        status: 'RELEASE_REQUEST_SENT',
        message: 'Release request queued for bank. Awaiting bank callback.',
      }),
    });

    return result;
  }

  /**
   * @deprecated Use requestReserve / bank callbacks instead.
   * Kept for operator override in demo context only.
   */
  confirmWorksheet(dealId: string, user: RequestUser) {
    if (!MONEY_MUTATION_ROLES.has(user.role) && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only accounting/admin can override reserve confirmation');
    }
    return this.runtime.confirmWorksheet(dealId, user);
  }

  /**
   * @deprecated Use requestRelease / bank callbacks instead.
   * Kept for operator override only.
   */
  releasePayment(dealId: string, user: RequestUser) {
    if (!MONEY_MUTATION_ROLES.has(user.role) && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only accounting/admin can manually release payment');
    }
    return this.runtime.releasePayment(dealId, user);
  }

  adjustWorksheet(dealId: string, adjustments: any[], user: RequestUser) {
    this.assertMoneyMutationRole(user);
    return this.runtime.adjustWorksheet(dealId, adjustments, user);
  }

  importBankStatement(content: string, format: string, user: RequestUser) {
    this.assertMoneyMutationRole(user);
    return this.runtime.importBankStatement(content, format, user);
  }

  registerSafeDealsCallback(payload: any) {
    // Bank callback: only path to confirm reserve or release
    const outboxEntries = this.outbox.getByDeal(payload?.dealId);
    const pending = outboxEntries.find((e) => e.status === 'PENDING' || e.status === 'SENT');
    if (pending) {
      if (payload?.status === 'SUCCESS') {
        this.outbox.confirm(pending.id);
      } else {
        this.outbox.markFailed(pending.id, payload?.errorMessage ?? 'callback_failure');
      }
    }
    const result = this.runtime.registerSafeDealsCallback(payload);
    if (payload?.dealId) {
      const ws = this.runtime.worksheet(payload.dealId);
      this.upsertPayment(payload.dealId, ws.payment).catch((e) =>
        this.logger.debug(`Payment DB callback write skipped: ${e.message}`),
      );
    }
    return result;
  }

  getOutboxStatus(dealId?: string) {
    return {
      totalPending: dealId ? this.outbox.getByDeal(dealId).length : this.outbox.listPending().length,
      pending: dealId ? this.outbox.getByDeal(dealId) : this.outbox.listPending(),
      manualReview: this.outbox.listManualReview(),
    };
  }

  private async upsertPayment(dealId: string, payment: any) {
    if (!this.prisma || !payment?.id) return;
    await this.prisma.payment.upsert({
      where: { id: payment.id },
      update: {
        status: payment.status,
        amountRub: payment.amountRub,
        reservedAt: payment.reserveConfirmedAt ? new Date(payment.reserveConfirmedAt) : null,
        releasedAt: payment.releasedAt ? new Date(payment.releasedAt) : null,
        holdAmountRub: payment.holdAmountRub ?? null,
        callbackState: payment.callbackState ?? 'NONE',
        bankRef: payment.bankEventId ?? null,
      },
      create: {
        id: payment.id,
        dealId,
        status: payment.status ?? 'PENDING',
        amountRub: payment.amountRub,
        reservedAt: payment.reserveConfirmedAt ? new Date(payment.reserveConfirmedAt) : null,
        releasedAt: payment.releasedAt ? new Date(payment.releasedAt) : null,
        holdAmountRub: payment.holdAmountRub ?? null,
        callbackState: payment.callbackState ?? 'NONE',
        bankRef: payment.bankEventId ?? null,
      },
    });
  }

  private assertMoneyMutationRole(user: RequestUser): void {
    if (!MONEY_MUTATION_ROLES.has(user.role) && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        `Role ${user.role} cannot perform money operations. Allowed: ACCOUNTING, ADMIN, SUPPORT_MANAGER`,
      );
    }
  }
}
