import { Injectable } from '@nestjs/common';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import { WorkTaskRepository } from './work-task.repository';

/**
 * Turning conditions into tasks.
 *
 * One deriver for now, for the one condition the database can also verify: a
 * document that has versions but none of them signed. Deriving conditions the
 * database cannot check would produce tasks that can only be closed by an
 * external event, and until the integration contours land there is nothing to
 * send that event — the tasks would pile up unresolvable. So this raises what
 * it can honestly close.
 *
 * It is deliberately a read followed by idempotent raises rather than a
 * transaction that also writes what it found. Two passes running at once must
 * converge on one task per condition, and the unique index on the open
 * condition is what makes that true regardless of ordering.
 */

export interface DerivationRun {
  readonly examined: number;
  readonly raised: number;
  readonly alreadyOpen: number;
}

interface UnsignedRow {
  id: string;
  documentType: string;
  documentNumber: string | null;
  dealId: string | null;
}

@Injectable()
export class WorkTaskDeriver {
  constructor(
    private readonly transactions: RlsTransactionService,
    private readonly tasks: WorkTaskRepository,
  ) {}

  /**
   * Raise a task for every document of this organization awaiting a signature.
   *
   * The wording is what a farmer reads on their phone, so it names the document
   * and the deal and says nothing about tables, providers or XSD.
   */
  async deriveUnsignedDocuments(user: RequestUser | undefined): Promise<DerivationRun> {
    const unsigned = await this.transactions.withTrustedContext(
      user,
      async (tx, context) =>
        tx.$queryRaw<UnsignedRow[]>`
          SELECT d."id", d."documentType", d."documentNumber", d."dealId"
            FROM public."accounting_documents" d
           WHERE d."organizationId" = ${context.orgId}
             AND d."status" <> 'CANCELLED'
             -- Has at least one rendering: a document with no version has
             -- nothing to sign yet, and asking somebody to sign it would be
             -- asking them to sign an empty page.
             AND EXISTS (
               SELECT 1 FROM public."accounting_document_versions" v
                WHERE v."documentId" = d."id"
             )
             AND NOT EXISTS (
               SELECT 1 FROM public."accounting_document_versions" v
                WHERE v."documentId" = d."id" AND v."signedAt" IS NOT NULL
             )
        `,
    );

    let raised = 0;
    let alreadyOpen = 0;

    for (const document of unsigned) {
      const named = document.documentNumber ?? 'без номера';
      const result = await this.tasks.raiseDerived(user, {
        taskType: 'DOCUMENT_NOT_SIGNED',
        derivationKey: `document:${document.id}:unsigned`,
        title: 'Нужна ваша подпись',
        humanDescription: `${document.documentType} ${named} ещё не подписан.`,
        documentId: document.id,
        dealId: document.dealId,
      });
      if (result.outcome === 'RAISED') raised += 1;
      if (result.outcome === 'ALREADY_OPEN') alreadyOpen += 1;
    }

    return { examined: unsigned.length, raised, alreadyOpen };
  }

  /**
   * Raise a task for every period that has ended with nothing left standing in
   * the way of closing it.
   *
   * The condition here is "ready", not "closed", and the two must not be
   * confused: the task exists precisely to tell somebody the last step is
   * theirs to take. It clears when the period is actually closed, which the
   * period's own guard refuses while work is outstanding — so a task raised by
   * this pass cannot be closed by anything other than the close itself.
   */
  async derivePeriodsReadyToClose(
    user: RequestUser | undefined,
  ): Promise<DerivationRun> {
    const ready = await this.transactions.withTrustedContext(
      user,
      async (tx, context) =>
        tx.$queryRaw<{ id: string; periodStart: Date; periodEnd: Date }[]>`
          SELECT p."id", p."periodStart", p."periodEnd"
            FROM public."accounting_periods" p
           WHERE p."organizationId" = ${context.orgId}
             AND p."status" <> 'CLOSED'
             AND p."periodEnd" <= CURRENT_TIMESTAMP
             AND NOT EXISTS (
               SELECT 1
                 FROM public."accounting_work_tasks" t
                 JOIN public."accounting_documents" d ON d."id" = t."documentId"
                WHERE t."organizationId" = p."organizationId"
                  AND t."origin" = 'DERIVED'
                  AND t."status" NOT IN ('RESOLVED', 'CANCELLED')
                  AND d."createdAt" >= p."periodStart"
                  AND d."createdAt" < p."periodEnd"
             )
             AND NOT EXISTS (
               SELECT 1
                 FROM public."accounting_documents" d
                WHERE d."organizationId" = p."organizationId"
                  AND d."status" <> 'CANCELLED'
                  AND d."createdAt" >= p."periodStart"
                  AND d."createdAt" < p."periodEnd"
                  AND EXISTS (
                    SELECT 1 FROM public."accounting_document_versions" v
                     WHERE v."documentId" = d."id"
                  )
                  AND NOT EXISTS (
                    SELECT 1 FROM public."accounting_document_versions" v
                     WHERE v."documentId" = d."id" AND v."signedAt" IS NOT NULL
                  )
             )
        `,
    );

    let raised = 0;
    let alreadyOpen = 0;

    for (const period of ready) {
      const month = period.periodStart.toISOString().slice(0, 7);
      const result = await this.tasks.raiseDerived(user, {
        taskType: 'PERIOD_READY_TO_CLOSE',
        derivationKey: `period:${period.id}:ready`,
        title: 'Месяц готов к закрытию',
        humanDescription: `За ${month} все документы подписаны и задач не осталось.`,
        periodId: period.id,
      });
      if (result.outcome === 'RAISED') raised += 1;
      if (result.outcome === 'ALREADY_OPEN') alreadyOpen += 1;
    }

    return { examined: ready.length, raised, alreadyOpen };
  }
}
