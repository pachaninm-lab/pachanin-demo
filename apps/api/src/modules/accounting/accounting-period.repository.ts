import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import {
  PeriodReadiness,
  PeriodRefusal,
  PeriodStatus,
  type PeriodView,
  describeReadiness,
  deriveSuccessorWindow,
  evaluatePeriodClose,
  evaluatePeriodOpen,
} from './accounting-period.policy';
import { WorkTaskRepository } from './work-task.repository';

/**
 * Opening and closing periods.
 *
 * The counts the policy needs — outstanding derived work, unsigned documents —
 * are read here rather than passed in, for the same reason the task contour
 * refuses a caller-supplied "the condition cleared": a close is exactly the
 * moment somebody would like those numbers to be zero.
 */

export const PeriodOutcome = {
  DONE: 'DONE',
  PERIOD_NOT_FOUND: 'PERIOD_NOT_FOUND',
  REFUSED_BY_POLICY: 'REFUSED_BY_POLICY',
  REFUSED_BY_DATABASE: 'REFUSED_BY_DATABASE',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
} as const;
export type PeriodOutcome = (typeof PeriodOutcome)[keyof typeof PeriodOutcome];

export interface PeriodResult {
  readonly outcome: PeriodOutcome;
  readonly refusals: readonly PeriodRefusal[];
  readonly databaseReason: string | null;
  readonly periodId: string | null;
  /**
   * The period opened to succeed the one just closed, when the closed window
   * was a calendar month. Null otherwise, and null is not an error: a window
   * the platform cannot continue without guessing is one it declines to guess.
   */
  readonly successorPeriodId?: string | null;
}

interface PeriodRow {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  version: bigint;
}

function toView(row: PeriodRow): PeriodView {
  return {
    id: row.id,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    status: row.status as PeriodStatus,
  };
}

export interface PeriodSummary extends PeriodView {
  readonly version: bigint;
  readonly readiness: PeriodReadiness;
  readonly outstandingDerivedTasks: number;
  readonly unsignedDocuments: number;
  readonly undecidedServiceLines: number;
  /**
   * Money received in the window that is not yet matched to anything.
   *
   * Reported, not blocking. Matching is dated when it happens and the
   * allocation guard judges that date, so a payment from a closed month can
   * still be allocated in an open one — nothing is lost by closing over it. It
   * is here because somebody signing off a month should see it.
   */
  readonly unallocatedPaymentKopecks: bigint;
  /** Statements prepared for the window that the counterparty has not answered. */
  readonly unansweredReconciliations: number;
}

@Injectable()
export class AccountingPeriodRepository {
  constructor(
    private readonly transactions: RlsTransactionService,
    private readonly tasks: WorkTaskRepository,
  ) {}

  /** Derived work still open for documents raised inside the window. */
  private async outstandingWork(
    tx: Prisma.TransactionClient,
    orgId: string,
    row: { periodStart: Date; periodEnd: Date },
  ): Promise<number> {
    const rows = await tx.$queryRaw<{ open: bigint }[]>`
      SELECT count(*) AS open
        FROM public."accounting_work_tasks" t
        JOIN public."accounting_documents" d ON d."id" = t."documentId"
       WHERE t."organizationId" = ${orgId}
         AND t."origin" = 'DERIVED'
         AND t."status" NOT IN ('RESOLVED', 'CANCELLED')
         AND d."createdAt" >= ${row.periodStart}
         AND d."createdAt" < ${row.periodEnd}
    `;
    return Number(rows[0]?.open ?? 0n);
  }

  /** Documents raised inside the window with no signed version. */
  private async unsignedDocuments(
    tx: Prisma.TransactionClient,
    orgId: string,
    row: { periodStart: Date; periodEnd: Date },
  ): Promise<number> {
    const rows = await tx.$queryRaw<{ unsigned: bigint }[]>`
      SELECT count(*) AS unsigned
        FROM public."accounting_documents" d
       WHERE d."organizationId" = ${orgId}
         AND d."status" <> 'CANCELLED'
         AND d."createdAt" >= ${row.periodStart}
         AND d."createdAt" < ${row.periodEnd}
         AND EXISTS (
           SELECT 1 FROM public."accounting_document_versions" v
            WHERE v."documentId" = d."id"
         )
         AND NOT EXISTS (
           SELECT 1 FROM public."accounting_document_versions" v
            WHERE v."documentId" = d."id" AND v."signedAt" IS NOT NULL
         )
    `;
    return Number(rows[0]?.unsigned ?? 0n);
  }

  /** Service lines rendered inside the window that nobody decided. */
  private async undecidedServiceLines(
    tx: Prisma.TransactionClient,
    orgId: string,
    row: { periodStart: Date; periodEnd: Date },
  ): Promise<number> {
    const rows = await tx.$queryRaw<{ undecided: bigint }[]>`
      SELECT count(*) AS undecided
        FROM public."accounting_deal_services" s
       WHERE s."organizationId" = ${orgId}
         AND s."status" = 'RENDERED'
         AND s."renderedAt" >= ${row.periodStart}
         AND s."renderedAt" < ${row.periodEnd}
    `;
    return Number(rows[0]?.undecided ?? 0n);
  }

  /** What arrived in the window and has not been matched to anything yet. */
  private async unallocatedPayments(
    tx: Prisma.TransactionClient,
    orgId: string,
    row: { periodStart: Date; periodEnd: Date },
  ): Promise<bigint> {
    const rows = await tx.$queryRaw<{ unallocated: bigint | null }[]>`
      SELECT COALESCE(sum(
               p."amountKopecks"
               - (SELECT COALESCE(sum(a."amountKopecks"), 0)
                    FROM public."accounting_payment_allocations" a
                   WHERE a."paymentId" = p."id")
             ), 0) AS unallocated
        FROM public."accounting_payments" p
       WHERE p."organizationId" = ${orgId}
         AND p."paidAt" >= ${row.periodStart}
         AND p."paidAt" < ${row.periodEnd}
    `;
    return BigInt(rows[0]?.unallocated ?? 0);
  }

  /** Statements covering the window that nobody has answered. */
  private async unansweredReconciliations(
    tx: Prisma.TransactionClient,
    orgId: string,
    row: { periodStart: Date; periodEnd: Date },
  ): Promise<number> {
    const rows = await tx.$queryRaw<{ unanswered: bigint }[]>`
      SELECT count(*) AS unanswered
        FROM public."accounting_reconciliations" r
       WHERE r."organizationId" = ${orgId}
         AND r."status" = 'PREPARED'
         AND r."periodStart" < ${row.periodEnd}
         AND r."periodEnd" > ${row.periodStart}
    `;
    return Number(rows[0]?.unanswered ?? 0n);
  }

  async open(
    user: RequestUser | undefined,
    input: { periodStart: Date; periodEnd: Date },
  ): Promise<PeriodResult> {
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const existing = await tx.$queryRaw<PeriodRow[]>`
        SELECT "id","periodStart","periodEnd","status","version"
          FROM public."accounting_periods"
         WHERE "organizationId" = ${context.orgId}
      `;

      const capabilities = await this.tasks.capabilitiesWithin(tx);
      const decision = evaluatePeriodOpen({
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        existing: existing.map(toView),
        actorCapabilities: capabilities,
      });
      if (decision.permitted === false) {
        return {
          outcome: PeriodOutcome.REFUSED_BY_POLICY,
          refusals: decision.refusals,
          databaseReason: null,
          periodId: null,
        };
      }

      const membership = await this.tasks.membershipWithin(tx);
      const id = `apr_${context.orgId}_${input.periodStart.toISOString()}`.slice(0, 190);
      try {
        await tx.$executeRaw`
          INSERT INTO public."accounting_periods"
            ("id","tenantId","organizationId","periodStart","periodEnd",
             "openedByMembershipId","createdAt","updatedAt")
          VALUES (${id}, ${context.tenantId}, ${context.orgId},
                  ${input.periodStart}, ${input.periodEnd}, ${membership},
                  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
      } catch (error) {
        return {
          outcome: PeriodOutcome.REFUSED_BY_DATABASE,
          refusals: [],
          databaseReason: error instanceof Error ? error.message : String(error),
          periodId: null,
        };
      }

      return {
        outcome: PeriodOutcome.DONE,
        refusals: [],
        databaseReason: null,
        periodId: id,
      };
    });
  }

  /**
   * Move a period towards closed, one step at a time.
   *
   * OPEN -> CLOSING and CLOSING -> CLOSED are separate calls because they are
   * separate decisions: the first says nobody is adding to this month, and only
   * then is counting what is outstanding meaningful.
   */
  async advance(
    user: RequestUser | undefined,
    input: { periodId: string; to: PeriodStatus; expectedVersion: bigint },
  ): Promise<PeriodResult> {
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const rows = await tx.$queryRaw<PeriodRow[]>`
        SELECT "id","periodStart","periodEnd","status","version"
          FROM public."accounting_periods"
         WHERE "id" = ${input.periodId}
           AND "organizationId" = ${context.orgId}
         FOR UPDATE
      `;
      const row = rows[0];
      if (row === undefined) {
        return {
          outcome: PeriodOutcome.PERIOD_NOT_FOUND,
          refusals: [],
          databaseReason: null,
          periodId: null,
        };
      }
      if (row.version !== input.expectedVersion) {
        return {
          outcome: PeriodOutcome.VERSION_CONFLICT,
          refusals: [],
          databaseReason: null,
          periodId: row.id,
        };
      }

      const capabilities = await this.tasks.capabilitiesWithin(tx);

      if (input.to === PeriodStatus.CLOSED) {
        const decision = evaluatePeriodClose({
          period: toView(row),
          actorCapabilities: capabilities,
          outstandingDerivedTasks: await this.outstandingWork(tx, context.orgId, row),
          unsignedDocuments: await this.unsignedDocuments(tx, context.orgId, row),
          undecidedServiceLines: await this.undecidedServiceLines(
            tx,
            context.orgId,
            row,
          ),
          now: new Date(),
        });
        if (decision.permitted === false) {
          return {
            outcome: PeriodOutcome.REFUSED_BY_POLICY,
            refusals: decision.refusals,
            databaseReason: null,
            periodId: row.id,
          };
        }
      } else if (
        !capabilities.includes('accounting.package.close') ||
        row.status !== PeriodStatus.OPEN
      ) {
        return {
          outcome: PeriodOutcome.REFUSED_BY_POLICY,
          refusals: !capabilities.includes('accounting.package.close')
            ? [PeriodRefusal.ACTOR_LACKS_PACKAGE_CLOSE]
            : [PeriodRefusal.PERIOD_ALREADY_CLOSED],
          databaseReason: null,
          periodId: row.id,
        };
      }

      const membership = await this.tasks.membershipWithin(tx);
      try {
        await tx.$executeRaw`
          UPDATE public."accounting_periods"
             SET "status" = ${input.to},
                 "closedByMembershipId" = CASE WHEN ${input.to} = 'CLOSED'
                                          THEN ${membership}
                                          ELSE "closedByMembershipId" END,
                 "version" = "version" + 1,
                 "updatedAt" = CURRENT_TIMESTAMP
           WHERE "id" = ${row.id}
             AND "version" = ${input.expectedVersion}
        `;
      } catch (error) {
        return {
          outcome: PeriodOutcome.REFUSED_BY_DATABASE,
          refusals: [],
          databaseReason: error instanceof Error ? error.message : String(error),
          periodId: row.id,
        };
      }

      // The month is closed; the next one has to exist for anything to be
      // filed into. Opened here rather than left to a caller, because a gap
      // between periods is invisible until somebody tries to close the month
      // that fell into it.
      let successorPeriodId: string | null = null;
      if (input.to === PeriodStatus.CLOSED) {
        successorPeriodId = await this.openSuccessor(tx, context, row);
      }

      return {
        outcome: PeriodOutcome.DONE,
        refusals: [],
        databaseReason: null,
        periodId: row.id,
        successorPeriodId,
      };
    });
  }

  /**
   * Open the window after a closed one, if it can be derived without guessing.
   *
   * Idempotent against the unique index on (organization, start): two closes
   * racing, or a retry, produce one successor rather than a conflict the caller
   * has to interpret.
   */
  private async openSuccessor(
    tx: Prisma.TransactionClient,
    context: { orgId: string; tenantId: string },
    row: PeriodRow,
  ): Promise<string | null> {
    const successor = deriveSuccessorWindow(row);
    if (successor.window === null) return null;

    const membership = await this.tasks.membershipWithin(tx);
    const id = `apr_${context.orgId}_${successor.window.periodStart.toISOString()}`.slice(
      0,
      190,
    );
    const written = await tx.$executeRaw`
      INSERT INTO public."accounting_periods"
        ("id","tenantId","organizationId","periodStart","periodEnd",
         "openedByMembershipId","createdAt","updatedAt")
      VALUES (${id}, ${context.tenantId}, ${context.orgId},
              ${successor.window.periodStart}, ${successor.window.periodEnd},
              ${membership}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("organizationId", "periodStart") DO NOTHING
    `;
    return written === 0 ? null : id;
  }

  /** Every period of this organization with what is standing in its way. */
  async list(user: RequestUser | undefined): Promise<readonly PeriodSummary[]> {
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const rows = await tx.$queryRaw<PeriodRow[]>`
        SELECT "id","periodStart","periodEnd","status","version"
          FROM public."accounting_periods"
         WHERE "organizationId" = ${context.orgId}
         ORDER BY "periodStart" DESC
         LIMIT 60
      `;
      const now = new Date();

      const summaries: PeriodSummary[] = [];
      for (const row of rows) {
        const outstanding = await this.outstandingWork(tx, context.orgId, row);
        const unsigned = await this.unsignedDocuments(tx, context.orgId, row);
        const undecided = await this.undecidedServiceLines(tx, context.orgId, row);
        summaries.push({
          ...toView(row),
          version: row.version,
          outstandingDerivedTasks: outstanding,
          unsignedDocuments: unsigned,
          undecidedServiceLines: undecided,
          unallocatedPaymentKopecks: await this.unallocatedPayments(
            tx,
            context.orgId,
            row,
          ),
          unansweredReconciliations: await this.unansweredReconciliations(
            tx,
            context.orgId,
            row,
          ),
          readiness: describeReadiness(
            toView(row),
            outstanding,
            unsigned,
            now,
            undecided,
          ),
        });
      }
      return summaries;
    });
  }
}
