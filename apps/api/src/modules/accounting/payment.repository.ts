import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import { monthIsClosed } from './period-window';
import {
  AllocationRefusal,
  type BankEvidenceFacts,
  type ObligationFacts,
  PaymentRefusal,
  evaluateAllocatePayment,
  evaluateRecordPayment,
  unallocatedKopecks,
} from './payment.policy';
import { WorkTaskRepository } from './work-task.repository';

/**
 * Recording payments and allocating them against what is owed.
 *
 * The amount is read from the bank operation rather than taken on trust, and the
 * unallocated remainder is read under the same lock the guard takes, so the
 * answer this layer gives and the answer the database gives cannot come from
 * different moments. An allocation is exactly where somebody would like the
 * remainder to be larger than it is.
 */

export const PaymentOutcome = {
  RECORDED: 'RECORDED',
  ALLOCATED: 'ALLOCATED',
  /** A retry of a command already applied. Not an error. */
  ALREADY_APPLIED: 'ALREADY_APPLIED',
  REFUSED_BY_POLICY: 'REFUSED_BY_POLICY',
  REFUSED_BY_DATABASE: 'REFUSED_BY_DATABASE',
} as const;
export type PaymentOutcome = (typeof PaymentOutcome)[keyof typeof PaymentOutcome];

export interface PaymentResult {
  readonly outcome: PaymentOutcome;
  readonly refusals: readonly (PaymentRefusal | AllocationRefusal)[];
  readonly databaseReason: string | null;
  readonly paymentId: string | null;
  readonly allocationId: string | null;
}

export interface PaymentView {
  readonly id: string;
  readonly dealId: string;
  readonly counterpartyOrgId: string;
  readonly direction: string;
  readonly amountKopecks: bigint;
  readonly allocatedKopecks: bigint;
  readonly unallocatedKopecks: bigint;
  readonly currency: string;
  readonly paidAt: Date;
  readonly bankOperationId: string;
  readonly version: bigint;
}

// Existing vocabulary, deliberately: matching arrived money to a deal is
// `payments.match`, and applying it against what is owed is
// `payments.reconcile`. The advance contour reads the same two for the same
// two acts.
const RECORD_CAPABILITY = 'payments.match';
const ALLOCATE_CAPABILITY = 'payments.reconcile';

function result(
  outcome: PaymentOutcome,
  extra: Partial<PaymentResult> = {},
): PaymentResult {
  return {
    outcome,
    refusals: [],
    databaseReason: null,
    paymentId: null,
    allocationId: null,
    ...extra,
  };
}

function identifier(prefix: string, orgId: string): string {
  return `${prefix}_${orgId}_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2, 10)}`.slice(0, 190);
}

@Injectable()
export class PaymentRepository {
  constructor(
    private readonly transactions: RlsTransactionService,
    private readonly tasks: WorkTaskRepository,
  ) {}

  /** The payments on a deal, each with what is left to allocate. */
  async listForDeal(
    user: RequestUser | undefined,
    dealId: string,
  ): Promise<readonly PaymentView[]> {
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const rows = await tx.$queryRaw<
        {
          id: string;
          dealId: string;
          counterpartyOrgId: string;
          direction: string;
          amountKopecks: bigint;
          allocated: bigint | null;
          currency: string;
          paidAt: Date;
          bankOperationId: string;
          version: bigint;
        }[]
      >`
        SELECT p."id", p."dealId", p."counterpartyOrgId", p."direction",
               p."amountKopecks", p."currency", p."paidAt", p."bankOperationId",
               p."version",
               (SELECT COALESCE(sum(a."amountKopecks"), 0)
                  FROM public."accounting_payment_allocations" a
                 WHERE a."paymentId" = p."id") AS allocated
          FROM public."accounting_payments" p
         WHERE p."organizationId" = ${context.orgId}
           AND p."dealId" = ${dealId}
         ORDER BY p."paidAt" ASC, p."id" ASC
      `;

      return rows.map((row) => {
        const allocated = BigInt(row.allocated ?? 0);
        return {
          id: row.id,
          dealId: row.dealId,
          counterpartyOrgId: row.counterpartyOrgId,
          direction: row.direction,
          amountKopecks: row.amountKopecks,
          allocatedKopecks: allocated,
          unallocatedKopecks: unallocatedKopecks(row.amountKopecks, allocated),
          currency: row.currency,
          paidAt: row.paidAt,
          bankOperationId: row.bankOperationId,
          version: row.version,
        };
      });
    });
  }

  async record(
    user: RequestUser | undefined,
    input: {
      dealId: string;
      counterpartyOrgId: string;
      direction: string;
      amountKopecks: bigint;
      currency: string;
      bankOperationId: string;
      paidAt: Date;
      idempotencyKey: string;
    },
  ): Promise<PaymentResult> {
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const replayed = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM public."accounting_payments"
         WHERE "idempotencyKey" = ${input.idempotencyKey}
      `;
      if (replayed.length > 0) {
        return result(PaymentOutcome.ALREADY_APPLIED, {
          paymentId: replayed[0].id,
        });
      }

      const capabilities = await this.tasks.capabilitiesWithin(tx);
      const membership = await this.tasks.membershipWithin(tx);

      const decision = evaluateRecordPayment({
        mayRecord:
          membership !== null && capabilities.includes(RECORD_CAPABILITY),
        organizationId: context.orgId,
        counterpartyOrgId: input.counterpartyOrgId,
        dealId: input.dealId,
        direction: input.direction,
        amountKopecks: input.amountKopecks,
        currency: input.currency,
        bankOperationId: input.bankOperationId,
        idempotencyKey: input.idempotencyKey,
        evidence: await this.readEvidence(
          tx,
          context.orgId,
          input.bankOperationId,
        ),
        paidMonthIsClosed: await monthIsClosed(tx, context.orgId, input.paidAt),
      });

      if (decision.permitted === false) {
        return result(PaymentOutcome.REFUSED_BY_POLICY, {
          refusals: decision.refusals,
        });
      }

      const id = identifier('pay', context.orgId);
      try {
        await tx.$executeRaw`
          INSERT INTO public."accounting_payments"
            ("id","tenantId","organizationId","dealId","counterpartyOrgId",
             "direction","amountKopecks","currency","paidAt","bankOperationId",
             "recordedByMembershipId","idempotencyKey","createdAt","updatedAt")
          VALUES (${id}, ${context.tenantId}, ${context.orgId}, ${input.dealId},
                  ${input.counterpartyOrgId}, ${input.direction},
                  ${input.amountKopecks}, ${input.currency}, ${input.paidAt},
                  ${input.bankOperationId}, ${membership},
                  ${input.idempotencyKey}, now(), now())
        `;
      } catch (error) {
        return result(PaymentOutcome.REFUSED_BY_DATABASE, {
          databaseReason: error instanceof Error ? error.message : String(error),
        });
      }

      return result(PaymentOutcome.RECORDED, { paymentId: id });
    });
  }

  /**
   * Allocate part or all of a payment to one obligation.
   *
   * Both ceilings are read here under the same locks the guard takes: what is
   * left of the payment, and what is left owed on the obligation. Either one
   * read a moment earlier would let two allocations pass a check that only one
   * of them can actually satisfy.
   */
  async allocate(
    user: RequestUser | undefined,
    input: {
      paymentId: string;
      amountKopecks: bigint;
      allocatedAt: Date;
      reason: string;
      idempotencyKey: string;
      documentVersionId?: string | null;
      dealServiceId?: string | null;
    },
  ): Promise<PaymentResult> {
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const replayed = await tx.$queryRaw<{ id: string; paymentId: string }[]>`
        SELECT "id", "paymentId" FROM public."accounting_payment_allocations"
         WHERE "idempotencyKey" = ${input.idempotencyKey}
      `;
      if (replayed.length > 0) {
        return result(PaymentOutcome.ALREADY_APPLIED, {
          paymentId: replayed[0].paymentId,
          allocationId: replayed[0].id,
        });
      }

      const capabilities = await this.tasks.capabilitiesWithin(tx);
      const membership = await this.tasks.membershipWithin(tx);

      const payments = await tx.$queryRaw<
        {
          dealId: string;
          currency: string;
          amountKopecks: bigint;
          allocated: bigint | null;
        }[]
      >`
        SELECT p."dealId", p."currency", p."amountKopecks",
               (SELECT COALESCE(sum(a."amountKopecks"), 0)
                  FROM public."accounting_payment_allocations" a
                 WHERE a."paymentId" = p."id") AS allocated
          FROM public."accounting_payments" p
         WHERE p."id" = ${input.paymentId}
           AND p."organizationId" = ${context.orgId}
           FOR UPDATE OF p
      `;
      const payment = payments[0];

      const dealServiceId = input.dealServiceId ?? null;
      const documentVersionId = input.documentVersionId ?? null;

      const decision = evaluateAllocatePayment({
        mayAllocate:
          membership !== null && capabilities.includes(ALLOCATE_CAPABILITY),
        paymentFound: payment !== undefined,
        paymentDealId: payment?.dealId ?? null,
        paymentCurrency: payment?.currency ?? null,
        paymentAmountKopecks: payment?.amountKopecks ?? 0n,
        alreadyAllocatedKopecks: BigInt(payment?.allocated ?? 0),
        amountKopecks: input.amountKopecks,
        documentVersionId,
        dealServiceId,
        obligation:
          dealServiceId === null
            ? null
            : await this.readServiceObligation(tx, context.orgId, dealServiceId),
        allocationMonthIsClosed: await monthIsClosed(
          tx,
          context.orgId,
          input.allocatedAt,
        ),
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
      });

      if (decision.permitted === false) {
        return result(PaymentOutcome.REFUSED_BY_POLICY, {
          refusals: decision.refusals,
          paymentId: payment === undefined ? null : input.paymentId,
        });
      }

      const id = identifier('payall', context.orgId);
      try {
        await tx.$executeRaw`
          INSERT INTO public."accounting_payment_allocations"
            ("id","tenantId","organizationId","paymentId","documentVersionId",
             "dealServiceId","amountKopecks","allocatedAt","reason",
             "idempotencyKey","allocatedByMembershipId","createdAt")
          VALUES (${id}, ${context.tenantId}, ${context.orgId},
                  ${input.paymentId}, ${documentVersionId}, ${dealServiceId},
                  ${input.amountKopecks}, ${input.allocatedAt}, ${input.reason},
                  ${input.idempotencyKey}, ${membership}, now())
        `;
      } catch (error) {
        return result(PaymentOutcome.REFUSED_BY_DATABASE, {
          databaseReason: error instanceof Error ? error.message : String(error),
          paymentId: input.paymentId,
        });
      }

      return result(PaymentOutcome.ALLOCATED, {
        paymentId: input.paymentId,
        allocationId: id,
      });
    });
  }

  private async readEvidence(
    tx: Prisma.TransactionClient,
    organizationId: string,
    bankOperationId: string,
  ): Promise<BankEvidenceFacts> {
    const absent: BankEvidenceFacts = {
      found: false,
      confirmed: false,
      dealId: null,
      amountKopecks: null,
      currency: null,
      alreadyUsed: false,
    };
    if (bankOperationId.trim() === '') return absent;

    const rows = await tx.$queryRaw<
      { dealId: string; status: string; amountKopecks: bigint; currency: string }[]
    >`
      SELECT "dealId", "status", "amountKopecks", "currency"
        FROM public.app_pc_crop_advance_evidence(${bankOperationId})
    `;
    const operation = rows[0];
    if (operation === undefined) return absent;

    // Both tables, because the guard refuses both: an operation already spent as
    // an advance, and one already recorded as another payment.
    const used = await tx.$queryRaw<{ used: boolean }[]>`
      SELECT (
        EXISTS (SELECT 1 FROM public."accounting_advances"
                 WHERE "organizationId" = ${organizationId}
                   AND "bankOperationId" = ${bankOperationId})
        OR EXISTS (SELECT 1 FROM public."accounting_payments"
                    WHERE "organizationId" = ${organizationId}
                      AND "bankOperationId" = ${bankOperationId})
      ) AS used
    `;

    return {
      found: true,
      confirmed: operation.status === 'CONFIRMED',
      dealId: operation.dealId,
      amountKopecks: operation.amountKopecks,
      currency: operation.currency,
      alreadyUsed: used[0]?.used === true,
    };
  }

  private async readServiceObligation(
    tx: Prisma.TransactionClient,
    organizationId: string,
    dealServiceId: string,
  ): Promise<ObligationFacts> {
    const rows = await tx.$queryRaw<
      {
        dealId: string;
        currency: string;
        amountKopecks: bigint;
        status: string;
        reversesServiceId: string | null;
        reversed: boolean;
        settled: bigint | null;
      }[]
    >`
      SELECT s."dealId", s."currency", s."amountKopecks", s."status",
             s."reversesServiceId",
             EXISTS (SELECT 1 FROM public."accounting_deal_services" r
                      WHERE r."reversesServiceId" = s."id"
                        AND r."status" = 'APPROVED') AS reversed,
             (SELECT COALESCE(sum(a."amountKopecks"), 0)
                FROM public."accounting_payment_allocations" a
               WHERE a."dealServiceId" = s."id") AS settled
        FROM public."accounting_deal_services" s
       WHERE s."id" = ${dealServiceId}
         AND s."organizationId" = ${organizationId}
         FOR UPDATE OF s
    `;
    const service = rows[0];
    if (service === undefined) {
      return {
        found: false,
        owed: false,
        dealId: null,
        currency: null,
        amountKopecks: null,
        alreadySettledKopecks: 0n,
      };
    }

    return {
      found: true,
      owed:
        service.status === 'APPROVED'
        && service.reversesServiceId === null
        && service.reversed === false,
      dealId: service.dealId,
      currency: service.currency,
      amountKopecks: service.amountKopecks,
      alreadySettledKopecks: BigInt(service.settled ?? 0),
    };
  }
}
