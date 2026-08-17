import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import {
  type AnswerRefusal,
  type ReconciliationFigures,
  type ReconciliationRefusal,
  ReconciliationStatus,
  closingBalanceKopecks,
  evaluateAnswerReconciliation,
  evaluatePrepareReconciliation,
  payloadHash,
} from './reconciliation.policy';
import { WorkTaskRepository } from './work-task.repository';

/**
 * Preparing a statement of mutual settlements, and answering one.
 *
 * Not one figure is accepted from the caller. The four that make up the bottom
 * line are read here from the approved service lines, the payment allocations
 * and the advance offsets that fall in the window, and the opening balance is
 * the closing balance of the statement that ended where this one begins. A
 * statement whose numbers came from the request would be a claim about the books
 * rather than a reading of them, which is exactly what a counterparty cannot
 * check.
 */

export const ReconciliationOutcome = {
  PREPARED: 'PREPARED',
  ANSWERED: 'ANSWERED',
  REFUSED_BY_POLICY: 'REFUSED_BY_POLICY',
  REFUSED_BY_DATABASE: 'REFUSED_BY_DATABASE',
} as const;
export type ReconciliationOutcome =
  (typeof ReconciliationOutcome)[keyof typeof ReconciliationOutcome];

export interface ReconciliationResult {
  readonly outcome: ReconciliationOutcome;
  readonly refusals: readonly (ReconciliationRefusal | AnswerRefusal)[];
  readonly databaseReason: string | null;
  readonly reconciliationId: string | null;
  readonly figures: ReconciliationFigures | null;
  readonly closingBalanceKopecks: bigint | null;
  readonly payloadHash: string | null;
}

export interface ReconciliationView {
  readonly id: string;
  readonly dealId: string;
  readonly counterpartyOrgId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly currency: string;
  readonly openingBalanceKopecks: bigint;
  readonly chargedKopecks: bigint;
  readonly reversedKopecks: bigint;
  readonly paidKopecks: bigint;
  readonly advanceAppliedKopecks: bigint;
  readonly closingBalanceKopecks: bigint;
  readonly payloadHash: string;
  readonly status: string;
  readonly preparedByMembershipId: string;
  readonly respondedAt: Date | null;
  readonly respondedByMembershipId: string | null;
  readonly responseNote: string | null;
  readonly version: bigint;
}

// Existing vocabulary. Preparing the package's statement is
// `accounting.package.prepare`; answering it is agreeing a figure, which is
// what `documents.validate` already names in this contour.
const PREPARE_CAPABILITY = 'accounting.package.prepare';
const ANSWER_CAPABILITY = 'documents.validate';

function result(
  outcome: ReconciliationOutcome,
  extra: Partial<ReconciliationResult> = {},
): ReconciliationResult {
  return {
    outcome,
    refusals: [],
    databaseReason: null,
    reconciliationId: null,
    figures: null,
    closingBalanceKopecks: null,
    payloadHash: null,
    ...extra,
  };
}

function identifier(prefix: string, orgId: string): string {
  return `${prefix}_${orgId}_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2, 10)}`.slice(0, 190);
}

@Injectable()
export class ReconciliationRepository {
  constructor(
    private readonly transactions: RlsTransactionService,
    private readonly tasks: WorkTaskRepository,
  ) {}

  async listForDeal(
    user: RequestUser | undefined,
    dealId: string,
  ): Promise<readonly ReconciliationView[]> {
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      return tx.$queryRaw<ReconciliationView[]>`
        SELECT "id", "dealId", "counterpartyOrgId", "periodStart", "periodEnd",
               "currency", "openingBalanceKopecks", "chargedKopecks",
               "reversedKopecks", "paidKopecks", "advanceAppliedKopecks",
               "closingBalanceKopecks",
               "payloadHash", "status", "preparedByMembershipId", "respondedAt",
               "respondedByMembershipId", "responseNote", "version"
          FROM public."accounting_reconciliations"
         WHERE "organizationId" = ${context.orgId}
           AND "dealId" = ${dealId}
         ORDER BY "periodStart" ASC, "id" ASC
      `;
    });
  }

  /**
   * What the books say for this counterparty over this window, without writing
   * anything.
   *
   * The same reading the statement is built from, so a screen can show the
   * figures before anybody commits to them — and so the two can be compared.
   */
  async preview(
    user: RequestUser | undefined,
    input: {
      dealId: string;
      counterpartyOrgId: string;
      periodStart: Date;
      periodEnd: Date;
    },
  ): Promise<ReconciliationFigures & { closingBalanceKopecks: bigint }> {
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const figures = await this.readFigures(tx, context.orgId, input);
      return { ...figures, closingBalanceKopecks: closingBalanceKopecks(figures) };
    });
  }

  async prepare(
    user: RequestUser | undefined,
    input: {
      dealId: string;
      counterpartyOrgId: string;
      periodStart: Date;
      periodEnd: Date;
      currency: string;
    },
  ): Promise<ReconciliationResult> {
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const capabilities = await this.tasks.capabilitiesWithin(tx);
      const membership = await this.tasks.membershipWithin(tx);

      const overlaps = await tx.$queryRaw<{ overlaps: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM public."accounting_reconciliations"
           WHERE "organizationId" = ${context.orgId}
             AND "dealId" = ${input.dealId}
             AND "counterpartyOrgId" = ${input.counterpartyOrgId}
             AND "periodStart" < ${input.periodEnd}
             AND "periodEnd" > ${input.periodStart}
        ) AS overlaps
      `;

      const decision = evaluatePrepareReconciliation({
        mayPrepare:
          membership !== null && capabilities.includes(PREPARE_CAPABILITY),
        organizationId: context.orgId,
        counterpartyOrgId: input.counterpartyOrgId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        currency: input.currency,
        windowOverlapsAnother: overlaps[0]?.overlaps === true,
      });

      if (decision.permitted === false) {
        return result(ReconciliationOutcome.REFUSED_BY_POLICY, {
          refusals: decision.refusals,
        });
      }

      const figures = await this.readFigures(tx, context.orgId, input);
      const closing = closingBalanceKopecks(figures);
      const hash = payloadHash({
        dealId: input.dealId,
        counterpartyOrgId: input.counterpartyOrgId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        currency: input.currency,
        figures,
      });

      const id = identifier('recon', context.orgId);
      try {
        await tx.$executeRaw`
          INSERT INTO public."accounting_reconciliations"
            ("id","tenantId","organizationId","dealId","counterpartyOrgId",
             "periodStart","periodEnd","currency","openingBalanceKopecks",
             "chargedKopecks","reversedKopecks","paidKopecks",
             "advanceAppliedKopecks",
             "closingBalanceKopecks","payloadHash","status",
             "preparedByMembershipId","createdAt","updatedAt")
          VALUES (${id}, ${context.tenantId}, ${context.orgId}, ${input.dealId},
                  ${input.counterpartyOrgId}, ${input.periodStart},
                  ${input.periodEnd}, ${input.currency},
                  ${figures.openingBalanceKopecks}, ${figures.chargedKopecks},
                  ${figures.reversedKopecks}, ${figures.paidKopecks},
                  ${figures.advanceAppliedKopecks},
                  ${closing}, ${hash}, ${ReconciliationStatus.PREPARED},
                  ${membership}, now(), now())
        `;
      } catch (error) {
        return result(ReconciliationOutcome.REFUSED_BY_DATABASE, {
          databaseReason: error instanceof Error ? error.message : String(error),
        });
      }

      return result(ReconciliationOutcome.PREPARED, {
        reconciliationId: id,
        figures,
        closingBalanceKopecks: closing,
        payloadHash: hash,
      });
    });
  }

  /**
   * Agree with a statement, or dispute it.
   *
   * The answering membership is the session's own and may not be the one that
   * prepared the statement. Neither the answer time nor the figures are
   * touchable here: a statement is disagreed with, never edited.
   */
  async answer(
    user: RequestUser | undefined,
    input: { reconciliationId: string; intended: string; note?: string | null },
  ): Promise<ReconciliationResult> {
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const capabilities = await this.tasks.capabilitiesWithin(tx);
      const membership = await this.tasks.membershipWithin(tx);

      const rows = await tx.$queryRaw<
        { status: string; preparedByMembershipId: string }[]
      >`
        SELECT "status", "preparedByMembershipId"
          FROM public."accounting_reconciliations"
         WHERE "id" = ${input.reconciliationId}
           AND "organizationId" = ${context.orgId}
           FOR UPDATE
      `;
      const statement = rows[0];
      const status =
        statement === undefined
          ? null
          : statement.status === ReconciliationStatus.PREPARED
            || statement.status === ReconciliationStatus.AGREED
            || statement.status === ReconciliationStatus.DISPUTED
            ? statement.status
            : null;

      const decision = evaluateAnswerReconciliation({
        mayAnswer:
          membership !== null && capabilities.includes(ANSWER_CAPABILITY),
        statementFound: statement !== undefined,
        currentStatus: status,
        intended: input.intended,
        preparedByMembershipId: statement?.preparedByMembershipId ?? null,
        answeringMembershipId: membership,
      });

      if (decision.permitted === false) {
        return result(ReconciliationOutcome.REFUSED_BY_POLICY, {
          refusals: decision.refusals,
          reconciliationId: statement === undefined ? null : input.reconciliationId,
        });
      }

      try {
        await tx.$executeRaw`
          UPDATE public."accounting_reconciliations"
             SET "status" = ${input.intended},
                 "respondedByMembershipId" = ${membership},
                 "responseNote" = ${input.note ?? null},
                 "version" = "version" + 1,
                 "updatedAt" = now()
           WHERE "id" = ${input.reconciliationId}
        `;
      } catch (error) {
        return result(ReconciliationOutcome.REFUSED_BY_DATABASE, {
          databaseReason: error instanceof Error ? error.message : String(error),
          reconciliationId: input.reconciliationId,
        });
      }

      return result(ReconciliationOutcome.ANSWERED, {
        reconciliationId: input.reconciliationId,
      });
    });
  }

  /**
   * The four figures, read from the rows.
   *
   * Each one is a sum over facts that already carry their own guards: service
   * lines that two people approved, allocations that could not exceed what was
   * paid, offsets that could not exceed what arrived. This layer adds no rules —
   * it only counts what those rules already admitted.
   */
  private async readFigures(
    tx: Prisma.TransactionClient,
    organizationId: string,
    input: {
      dealId: string;
      counterpartyOrgId: string;
      periodStart: Date;
      periodEnd: Date;
    },
  ): Promise<ReconciliationFigures> {
    const rows = await tx.$queryRaw<
      {
        charged: bigint | null;
        reversed: bigint | null;
        paid: bigint | null;
        advanceApplied: bigint | null;
        opening: bigint | null;
      }[]
    >`
      SELECT
        (SELECT COALESCE(sum(s."amountKopecks"), 0)
           FROM public."accounting_deal_services" s
          WHERE s."organizationId" = ${organizationId}
            AND s."dealId" = ${input.dealId}
            AND s."counterpartyOrgId" = ${input.counterpartyOrgId}
            AND s."status" = 'APPROVED'
            AND s."reversesServiceId" IS NULL
            AND s."renderedAt" >= ${input.periodStart}
            AND s."renderedAt" < ${input.periodEnd}) AS charged,
        (SELECT COALESCE(sum(r."amountKopecks"), 0)
           FROM public."accounting_deal_services" r
          WHERE r."organizationId" = ${organizationId}
            AND r."dealId" = ${input.dealId}
            AND r."counterpartyOrgId" = ${input.counterpartyOrgId}
            AND r."status" = 'APPROVED'
            AND r."reversesServiceId" IS NOT NULL
            AND r."renderedAt" >= ${input.periodStart}
            AND r."renderedAt" < ${input.periodEnd}) AS reversed,
        (SELECT COALESCE(sum(a."amountKopecks"), 0)
           FROM public."accounting_payment_allocations" a
           JOIN public."accounting_payments" p ON p."id" = a."paymentId"
          WHERE a."organizationId" = ${organizationId}
            AND p."dealId" = ${input.dealId}
            AND p."counterpartyOrgId" = ${input.counterpartyOrgId}
            AND a."allocatedAt" >= ${input.periodStart}
            AND a."allocatedAt" < ${input.periodEnd}) AS paid,
        (SELECT COALESCE(sum(o."amountKopecks"), 0)
           FROM public."accounting_advance_offsets" o
           JOIN public."accounting_advances" adv ON adv."id" = o."advanceId"
          WHERE o."organizationId" = ${organizationId}
            AND adv."dealId" = ${input.dealId}
            AND adv."counterpartyOrgId" = ${input.counterpartyOrgId}
            AND o."appliedAt" >= ${input.periodStart}
            AND o."appliedAt" < ${input.periodEnd}) AS "advanceApplied",
        -- The statement that ended where this one begins. Anything else would
        -- leave a gap whose figures appear in no statement at all.
        (SELECT prior."closingBalanceKopecks"
           FROM public."accounting_reconciliations" prior
          WHERE prior."organizationId" = ${organizationId}
            AND prior."dealId" = ${input.dealId}
            AND prior."counterpartyOrgId" = ${input.counterpartyOrgId}
            AND prior."periodEnd" = ${input.periodStart}
          ORDER BY prior."periodStart" DESC
          LIMIT 1) AS opening
    `;

    const row = rows[0];
    return {
      openingBalanceKopecks: BigInt(row?.opening ?? 0),
      chargedKopecks: BigInt(row?.charged ?? 0),
      // Reported separately rather than netted off the charges. A reversal
      // dated in this window may cancel a charge from an earlier one, and the
      // netted figure would then go negative — which the constraint refuses and
      // a clamp would hide.
      reversedKopecks: BigInt(row?.reversed ?? 0),
      paidKopecks: BigInt(row?.paid ?? 0),
      advanceAppliedKopecks: BigInt(row?.advanceApplied ?? 0),
    };
  }
}
