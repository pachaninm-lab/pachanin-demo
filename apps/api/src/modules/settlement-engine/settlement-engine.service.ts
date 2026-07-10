import { ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import { ActionExecutorService } from '../../common/action-executor/action-executor.service';
import { OutboxService, type OutboxEntry } from '../../common/outbox/outbox.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';
import { PAYMENT_REPOSITORY, type PaymentRepository } from './payment.repository';
import { RuntimePaymentRepository } from './runtime-payment.repository';

const MONEY_MUTATION_ROLES: Set<Role> = new Set([
  Role.ADMIN,
  Role.SUPPORT_MANAGER,
  Role.ACCOUNTING,
]);

@Injectable()
export class SettlementEngineService {
  private readonly payments: PaymentRepository;

  constructor(
    private readonly runtime: RuntimeCoreService,
    private readonly executor: ActionExecutorService,
    private readonly outbox: OutboxService,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() @Inject(PAYMENT_REPOSITORY) payments?: PaymentRepository,
  ) {
    this.payments = payments ?? new RuntimePaymentRepository(runtime);
  }

  worksheet(dealId: string, user: RequestUser) {
    this.assertDealScope(dealId, user);
    return this.payments.worksheet(dealId);
  }

  bankWorkspace(dealId: string, user: RequestUser) {
    this.assertDealScope(dealId, user);
    return this.payments.bankWorkspace(dealId);
  }

  async listPayments(user: RequestUser) {
    const payments = await this.payments.list();
    return this.filterPaymentsByScope(payments, user);
  }

  async paymentDetail(id: string, user: RequestUser) {
    const detail = await this.payments.detail(id);
    if (detail?.dealId) this.assertDealScope(detail.dealId, user);
    return detail;
  }

  async exportDeals(_params: unknown, user: RequestUser) {
    const payments = this.filterPaymentsByScope(await this.payments.list(), user);
    const rows = [
      ['dealId', 'status', 'amountRub', 'callbackState'],
      ...payments.map((payment: any) => [
        payment.dealId,
        payment.status,
        String(payment.amountRub),
        payment.callbackState ?? '',
      ]),
    ];
    return {
      contentType: 'text/csv',
      fileName: 'deals-export.csv',
      body: rows.map((row) => row.join(',')).join('\n'),
    };
  }

  async exportContractors(user: RequestUser) {
    const rows = [['dealId', 'beneficiaryId', 'role', 'bankStatus']];
    for (const payment of this.filterPaymentsByScope(await this.payments.list(), user)) {
      const bank = this.payments.bankWorkspace((payment as any).dealId);
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
   * Legacy reserve compatibility path. Canonical Deal money commands use the
   * PostgreSQL DealCommandService transaction. This path now waits for durable
   * outbox persistence and surfaces payment persistence failures.
   */
  async requestReserve(dealId: string, user: RequestUser) {
    this.assertMoneyMutationRole(user);
    this.assertDealScope(dealId, user);
    const worksheet = this.payments.worksheet(dealId);
    const { result, outboxId } = await this.executor.execute({
      user,
      action: 'money.reserve.request',
      scope: { objectType: 'deal', objectId: dealId },
      bankOutbox: {
        type: 'BANK_RESERVE_REQUEST',
        idempotencyKey: `bank-reserve:${dealId}`,
        payload: {
          dealId,
          amountRub: worksheet.payment?.amountRub,
          bankEventId: worksheet.payment?.bankEventId,
        },
      },
      fn: () => this.runtime.reservePrepayment(dealId, user),
    });
    const updated = this.payments.worksheet(dealId);
    await this.upsertPayment(dealId, updated.payment);
    return { ...result, outboxStatus: 'PENDING', outboxId };
  }

  /**
   * Legacy release compatibility path. The platform queues a bank command and
   * never releases money without a verified callback.
   */
  async requestRelease(dealId: string, user: RequestUser) {
    this.assertMoneyMutationRole(user);
    this.assertDealScope(dealId, user);
    const workspace = this.runtime.dealWorkspace(dealId);
    const blockers = workspace.blockers ?? [];

    if (blockers.length > 0) {
      return {
        dealId,
        released: false,
        blocked: true,
        blockers,
        message: 'Release blocked — resolve all blockers first',
      };
    }

    const { result, outboxId } = await this.executor.execute({
      user,
      action: 'money.release.request',
      scope: { objectType: 'deal', objectId: dealId },
      gates: {
        disputeOpen: workspace.payment?.status === 'HOLD_ACTIVE'
          && workspace.blockers?.some((blocker: string) => blocker.includes('спор')),
        documentsComplete: workspace.completeness?.isComplete,
        reserveConfirmed: ['RESERVED', 'HOLD_ACTIVE', 'READY_FOR_RELEASE'].includes(workspace.payment?.status),
      },
      bankOutbox: {
        type: 'BANK_RELEASE_REQUEST',
        idempotencyKey: `bank-release:${dealId}`,
        payload: {
          dealId,
          amountRub: workspace.payment?.undisputedAmountRub,
          bankEventId: workspace.payment?.bankEventId,
          beneficiaries: workspace.bankWorkspace?.beneficiaries,
        },
      },
      fn: () => ({
        dealId,
        status: 'RELEASE_REQUEST_SENT',
        message: 'Release request queued for bank. Awaiting verified bank callback.',
      }),
    });

    return { ...result, outboxStatus: 'PENDING', outboxId };
  }

  /** @deprecated Canonical reserve confirmation requires a verified bank callback. */
  confirmWorksheet(dealId: string, user: RequestUser) {
    if (!MONEY_MUTATION_ROLES.has(user.role) && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only accounting/admin can override reserve confirmation');
    }
    this.assertDealScope(dealId, user);
    return this.runtime.confirmWorksheet(dealId, user);
  }

  /** @deprecated Canonical release requires a verified bank callback. */
  releasePayment(dealId: string, user: RequestUser) {
    if (!MONEY_MUTATION_ROLES.has(user.role) && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only accounting/admin can manually release payment');
    }
    this.assertDealScope(dealId, user);
    return this.runtime.releasePayment(dealId, user);
  }

  adjustWorksheet(dealId: string, adjustments: unknown[], user: RequestUser) {
    this.assertMoneyMutationRole(user);
    this.assertDealScope(dealId, user);
    return this.runtime.adjustWorksheet(dealId, adjustments, user);
  }

  importBankStatement(content: string, format: string, user: RequestUser) {
    this.assertMoneyMutationRole(user);
    return this.runtime.importBankStatement(content, format, user);
  }

  async registerSafeDealsCallback(payload: Record<string, unknown>) {
    const dealId = typeof payload.dealId === 'string' ? payload.dealId : '';
    if (!dealId) throw new Error('BANK_CALLBACK_DEAL_ID_REQUIRED');

    const entries = await this.outbox.getByDeal(dealId);
    const expectedType = payload.operation === 'RELEASE'
      ? 'BANK_RELEASE_REQUEST'
      : payload.operation === 'RESERVE'
        ? 'BANK_RESERVE_REQUEST'
        : null;
    if (!expectedType) throw new Error('BANK_CALLBACK_OPERATION_UNSUPPORTED');

    const sentCommand = [...entries]
      .reverse()
      .find((entry) => entry.type === expectedType && entry.status === 'SENT');
    if (!sentCommand) {
      throw new Error('BANK_CALLBACK_HAS_NO_SENT_COMMAND');
    }

    const runtimeResult = this.runtime.registerSafeDealsCallback(payload);
    if (payload.status === 'SUCCESS') {
      await this.outbox.confirm(sentCommand.id);
    } else {
      await this.outbox.markFailed(sentCommand.id, callbackFailureCode(payload));
    }

    const paymentWorkspace = this.payments.worksheet(dealId);
    await this.upsertPayment(dealId, paymentWorkspace.payment);
    return runtimeResult;
  }

  async getOutboxStatus(dealId?: string) {
    const [pending, manualReview] = await Promise.all([
      dealId ? this.outbox.getByDeal(dealId) : this.outbox.listPending(),
      this.outbox.listManualReview(),
    ]);
    const deliverable = dealId
      ? pending.filter((entry) => ['PENDING', 'PROCESSING', 'RETRY'].includes(entry.status))
      : pending;
    return {
      totalPending: deliverable.length,
      pending: deliverable,
      manualReview,
      deliverySemantics: 'at-least-once',
    };
  }

  private async upsertPayment(dealId: string, payment: any): Promise<void> {
    if (!payment?.id) return;
    if (!this.prisma) {
      if (String(process.env.NODE_ENV ?? '').toLowerCase() === 'production') {
        throw new Error('PAYMENT_PERSISTENCE_UNAVAILABLE');
      }
      return;
    }
    const amountRub = payment.amountRub ?? payment.holdAmountRub ?? null;
    await this.prisma.payment.upsert({
      where: { id: payment.id },
      update: {
        status: payment.status,
        amountRub,
        reservedAt: payment.reserveConfirmedAt ? new Date(payment.reserveConfirmedAt) : null,
        releasedAt: payment.releasedAt ? new Date(payment.releasedAt) : null,
        callbackState: payment.callbackState ?? 'NONE',
        bankRef: payment.bankEventId ?? null,
      },
      create: {
        id: payment.id,
        dealId,
        status: payment.status ?? 'PENDING',
        amountRub,
        reservedAt: payment.reserveConfirmedAt ? new Date(payment.reserveConfirmedAt) : null,
        releasedAt: payment.releasedAt ? new Date(payment.releasedAt) : null,
        callbackState: payment.callbackState ?? 'NONE',
        bankRef: payment.bankEventId ?? null,
      },
    });
  }

  private assertDealScope(dealId: string, user: RequestUser): void {
    const role = String(user?.role || '');
    if (role === Role.ADMIN || role === Role.SUPPORT_MANAGER || role === Role.EXECUTIVE) return;
    let deal: any = null;
    try {
      deal = this.runtime.getDeal(dealId);
    } catch {
      deal = null;
    }
    const isParty = !!deal && (deal.sellerOrgId === user?.orgId || deal.buyerOrgId === user?.orgId);
    if (!isParty) throw new ForbiddenException(`Cross-organization access denied for deal:${dealId}`);
  }

  private filterPaymentsByScope(payments: any[], user: RequestUser): any[] {
    const role = String(user?.role || '');
    if (role === Role.ADMIN || role === Role.SUPPORT_MANAGER || role === Role.EXECUTIVE) return payments;
    return payments.filter((payment: any) => {
      let deal: any = null;
      try {
        deal = payment?.dealId ? this.runtime.getDeal(payment.dealId) : null;
      } catch {
        deal = null;
      }
      return !!deal && (deal.sellerOrgId === user?.orgId || deal.buyerOrgId === user?.orgId);
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

function callbackFailureCode(payload: Record<string, unknown>): string {
  const source = typeof payload.errorCode === 'string'
    ? payload.errorCode
    : typeof payload.status === 'string'
      ? payload.status
      : 'bank_callback_failure';
  const normalized = source.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').slice(0, 80);
  return normalized ? `bank_${normalized}` : 'bank_callback_failure';
}
