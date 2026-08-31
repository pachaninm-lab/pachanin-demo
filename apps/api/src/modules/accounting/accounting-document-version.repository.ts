import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import {
  type PayloadDenyReason,
  buildDocumentPayload,
} from '../auth/accounting-document-payload.builder';
import {
  type SnapshotFailure,
  AccountingSourceSnapshotRepository,
} from './accounting-source-snapshot.repository';

/**
 * Creating a document version: the act that ties the contour together.
 *
 * Everything else decided something. This writes one immutable row that the
 * signature will later cover, and it must do so in a single transaction for a
 * reason the components cannot enforce individually: the snapshot, the payload
 * and the row have to agree. Assembling the snapshot in one transaction and
 * writing the row in another would leave a window where a source moves between
 * them, and the stored revisions would then describe a read the payload did
 * not come from — silently defeating the staleness mechanism that the whole
 * contour rests on.
 *
 * So the snapshot repository's transaction is reused rather than nested. Both
 * run under one REPEATABLE READ transaction: the nine reads see one state, the
 * payload is built from exactly those values, and the row is written before
 * anything can move.
 *
 * The version number is taken under the document's own row lock. Two writers
 * racing to add a version to one document would otherwise derive the same
 * number from the same stale read, and the unique index would turn that into a
 * failed write after one of them had been told it succeeded.
 */

export const CreateVersionOutcome = {
  CREATED: 'CREATED',
  DOCUMENT_NOT_FOUND: 'DOCUMENT_NOT_FOUND',
  DOCUMENT_NOT_DRAFT: 'DOCUMENT_NOT_DRAFT',
  SOURCES_INCOMPLETE: 'SOURCES_INCOMPLETE',
  PAYLOAD_REFUSED: 'PAYLOAD_REFUSED',
} as const;

export type CreateVersionOutcome =
  typeof CreateVersionOutcome[keyof typeof CreateVersionOutcome];

export type CreateVersionResult = {
  outcome: CreateVersionOutcome;
  versionNumber: number | null;
  payloadHash: string | null;
  missingSources: readonly SnapshotFailure[];
  payloadReasons: readonly PayloadDenyReason[];
};

function empty(outcome: CreateVersionOutcome): CreateVersionResult {
  return {
    outcome,
    versionNumber: null,
    payloadHash: null,
    missingSources: [],
    payloadReasons: [],
  };
}

@Injectable()
export class AccountingDocumentVersionRepository {
  constructor(
    private readonly transactions: RlsTransactionService,
    private readonly snapshots: AccountingSourceSnapshotRepository,
  ) {}

  /**
   * Render a new version of a draft document from the sources as they stand.
   *
   * A document that has already been issued is refused rather than re-rendered:
   * its number is on somebody's paper, and adding content under it after the
   * fact is what a superseding document exists to avoid.
   */
  async create(
    user: RequestUser | undefined,
    input: { documentId: string; at: Date },
  ): Promise<CreateVersionResult> {
    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const documents = await tx.$queryRaw<
          { id: string; status: string; dealId: string | null; documentType: string;
            currentVersionNumber: number }[]
        >`
          SELECT "id", "status", "dealId", "documentType", "currentVersionNumber"
            FROM public."accounting_documents"
           WHERE "id" = ${input.documentId}
             AND "organizationId" = ${context.orgId}
           FOR UPDATE
        `;
        const document = documents[0];
        if (document === undefined || document.dealId === null) {
          return empty(CreateVersionOutcome.DOCUMENT_NOT_FOUND);
        }
        if (document.status !== 'DRAFT') {
          return empty(CreateVersionOutcome.DOCUMENT_NOT_DRAFT);
        }

        const assembled = await this.snapshots.assembleWithin(tx, context, {
          dealId: document.dealId,
          at: input.at,
        });
        if (assembled.assembled === false) {
          return {
            ...empty(CreateVersionOutcome.SOURCES_INCOMPLETE),
            missingSources: assembled.missing,
          };
        }

        const built = buildDocumentPayload({
          documentType: document.documentType,
          snapshot: assembled.snapshot,
        });
        if (built.built === false) {
          return {
            ...empty(CreateVersionOutcome.PAYLOAD_REFUSED),
            payloadReasons: built.reasons,
          };
        }

        // Derived under the lock taken above, so two writers cannot reach the
        // same number from the same stale read.
        const versionNumber = document.currentVersionNumber + 1;

        await tx.$executeRaw`
          INSERT INTO public."accounting_document_versions"
            ("id","tenantId","organizationId","documentId","versionNumber",
             "payloadHash","recordedRevisions","totalKopecks",
             "createdByMembershipId","createdAt")
          VALUES (
            ${`acv_${document.id}_${versionNumber}`},
            ${context.tenantId}, ${context.orgId}, ${document.id},
            ${versionNumber}, ${built.result.payloadHash},
            ${JSON.stringify(built.result.recordedRevisions)}::jsonb,
            ${built.result.totalKopecks},
            -- The membership is resolved by the database from an ACTIVE row in
            -- user_orgs, not passed in. A value the caller supplies is a claim;
            -- this is the same principle the read policies rest on.
            public.app_pc_crop_membership_id(), now())
        `;
        await tx.$executeRaw`
          UPDATE public."accounting_documents"
             SET "currentVersionNumber" = ${versionNumber},
                 "updatedAt" = now(),
                 "version" = "version" + 1
           WHERE "id" = ${document.id}
        `;

        return {
          outcome: CreateVersionOutcome.CREATED,
          versionNumber,
          payloadHash: built.result.payloadHash,
          missingSources: [],
          payloadReasons: [],
        };
      },
      {
        // The snapshot's isolation requirement governs the whole act: one
        // state of the database for the reads, the payload and the write.
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  }
}
