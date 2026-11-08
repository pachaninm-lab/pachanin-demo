import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import {
  NumberResetPolicy,
  type NumberingScheme,
  type NumberingDenyReason,
  evaluateNumberAllocation,
} from './accounting-document-numbering.policy';

/**
 * Issuing an accounting document, in one transaction.
 *
 * This is the piece every other part of the accounting contour was waiting on.
 * The policies decide and the tables constrain, but nothing until now took a
 * number under a lock and wrote it, and that step is the one that cannot be a
 * pure function: gapless numbering needs a row held for the length of the
 * transaction, and a function that cannot hold a lock cannot promise one.
 *
 * The split is deliberate. `evaluateNumberAllocation` decides *what* number
 * follows and whether the document may be issued at all; this reads the counter
 * under `FOR UPDATE`, asks that question, and writes the answer. A helper that
 * quietly "got the next number" would have hidden the transactional part, which
 * is the only part that can go wrong under concurrency.
 *
 * Everything here runs inside `withTrustedContext`, so the row level policies
 * see the same organization the caller actually holds a membership in. Nothing
 * in this file re-checks tenancy: doing so would be a second, weaker copy of
 * what the database already refuses.
 */

export const IssueDocumentOutcome = {
  ISSUED: 'ISSUED',
  REFUSED: 'REFUSED',
  /** The document does not exist, or belongs to another organization. */
  NOT_FOUND: 'NOT_FOUND',
  /** No numbering sequence is configured for this type and period. */
  NO_SEQUENCE: 'NO_SEQUENCE',
} as const;

export type IssueDocumentOutcome =
  typeof IssueDocumentOutcome[keyof typeof IssueDocumentOutcome];

export type IssueDocumentResult = {
  outcome: IssueDocumentOutcome;
  documentNumber: string | null;
  reasons: readonly NumberingDenyReason[];
};

type CounterRow = {
  id: string;
  lastOrdinal: number;
  prefix: string;
  resetPolicy: string;
  padding: number;
};

type DocumentRow = {
  id: string;
  status: string;
  documentNumber: string | null;
  currentVersionNumber: number;
  documentType: string;
};

@Injectable()
export class AccountingDocumentIssuingRepository {
  constructor(private readonly transactions: RlsTransactionService) {}

  /**
   * Number and issue a document.
   *
   * The order of operations matters and is not interchangeable: the counter is
   * locked *before* the policy is consulted, because the policy's answer is
   * derived from the ordinal it reads. Asking first and locking afterwards
   * would let two issuers derive the same number from the same stale read and
   * then both try to write it — which the unique index turns into a failed
   * issue rather than a duplicate, but only after somebody has already been
   * told their document was fine.
   */
  async issue(
    user: RequestUser | undefined,
    input: {
      documentId: string;
      accountingYear: number;
      accountingPeriodClosed: boolean;
      issuedAt: Date;
    },
  ): Promise<IssueDocumentResult> {
    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const documents = await tx.$queryRaw<DocumentRow[]>`
          SELECT "id", "status", "documentNumber", "currentVersionNumber", "documentType"
          FROM public."accounting_documents"
          WHERE "id" = ${input.documentId}
            AND "organizationId" = ${context.orgId}
        `;
        const document = documents[0];
        if (document === undefined) {
          return {
            outcome: IssueDocumentOutcome.NOT_FOUND,
            documentNumber: null,
            reasons: [],
          };
        }

        // The lock comes first. Everything after it derives from what it read.
        const counters = await tx.$queryRaw<CounterRow[]>`
          SELECT "id", "lastOrdinal", "prefix", "resetPolicy", "padding"
          FROM public."accounting_number_counters"
          WHERE "organizationId" = ${context.orgId}
            AND "documentType" = ${document.documentType}
            AND "periodYear" = ${input.accountingYear}
          FOR UPDATE
        `;
        const counter = counters[0];
        if (counter === undefined) {
          // A sequence nobody configured is not the same as a sequence at
          // zero: starting one implicitly would pick a numbering scheme on the
          // organization's behalf, and the scheme is fixed once it issues.
          return {
            outcome: IssueDocumentOutcome.NO_SEQUENCE,
            documentNumber: null,
            reasons: [],
          };
        }

        const scheme: NumberingScheme = {
          prefix: counter.prefix,
          resetPolicy:
            counter.resetPolicy === NumberResetPolicy.NEVER
              ? NumberResetPolicy.NEVER
              : NumberResetPolicy.ANNUAL,
          padding: counter.padding,
        };

        const decision = evaluateNumberAllocation({
          scheme,
          status: document.status,
          currentNumber: document.documentNumber,
          currentVersionNumber: document.currentVersionNumber,
          issuedAt: input.issuedAt,
          accountingYear: input.accountingYear,
          accountingPeriodClosed: input.accountingPeriodClosed,
          lastOrdinal: counter.lastOrdinal,
          // Held above, in this transaction. Not an assumption.
          counterHeld: true,
        });

        if (
          decision.allowed === false ||
          decision.documentNumber === null ||
          decision.nextOrdinal === null
        ) {
          return {
            outcome: IssueDocumentOutcome.REFUSED,
            documentNumber: null,
            reasons: decision.reasons,
          };
        }

        await tx.$executeRaw`
          UPDATE public."accounting_documents"
             SET "documentNumber" = ${decision.documentNumber},
                 "status" = 'ISSUED',
                 "updatedAt" = now(),
                 "version" = "version" + 1
           WHERE "id" = ${document.id}
        `;

        await tx.$executeRaw`
          UPDATE public."accounting_number_counters"
             SET "lastOrdinal" = ${decision.nextOrdinal},
                 "updatedAt" = now(),
                 "version" = "version" + 1
           WHERE "id" = ${counter.id}
        `;

        return {
          outcome: IssueDocumentOutcome.ISSUED,
          documentNumber: decision.documentNumber,
          reasons: [],
        };
      },
      {
        // Read committed is enough because the counter row is the only shared
        // state and it is held under an explicit lock. Serializable would add
        // retries for a conflict this design already prevents.
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }
}
