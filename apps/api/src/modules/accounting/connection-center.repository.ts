import { Injectable } from '@nestjs/common';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import {
  type ConnectionEvidence,
  ConnectionKind,
  type ConnectionState,
  KNOWN_CONNECTION_KINDS,
  describeConnection,
} from './connection-center.policy';

/**
 * What this organization's connections to other people's systems actually are.
 *
 * A read. Nothing here writes, declares or configures anything, and that is the
 * design rather than a stage: a Connection Centre whose green ticks can be set
 * by the person looking at them is a decoration. Every level it reports is
 * derived from rows written by the contour that did the work.
 *
 * Where a kind has no adapter at all — 1С today — that is reported as such,
 * with the prerequisites named. Saying "not implemented" is more useful than an
 * empty screen and considerably more useful than a hopeful one.
 */

@Injectable()
export class ConnectionCenterRepository {
  constructor(private readonly transactions: RlsTransactionService) {}

  async describe(
    user: RequestUser | undefined,
  ): Promise<readonly ConnectionState[]> {
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      // The far side answered, and said so with its own identifier. Anything
      // weaker than an identifier is a request that did not error, which is not
      // the same fact.
      const receipts = await tx.$queryRaw<
        { transportCode: string | null; externalReceiptId: string | null }[]
      >`
        SELECT v."transportCode", v."externalReceiptId"
          FROM public."accounting_document_versions" v
         WHERE v."organizationId" = ${context.orgId}
           AND v."externalReceiptId" IS NOT NULL
           AND v."sentAt" IS NOT NULL
         ORDER BY v."sentAt" DESC
         LIMIT 50
      `;

      const evidence = KNOWN_CONNECTION_KINDS.map((kind) =>
        this.evidenceFor(kind, receipts),
      );
      return evidence.map(describeConnection);
    });
  }

  /**
   * The evidence for one kind.
   *
   * Deliberately explicit per kind rather than table-driven: each of these is a
   * different claim about a different external system, and a loop over a
   * mapping would make it easy to add a kind that reports a level nobody
   * checked.
   */
  private evidenceFor(
    kind: ConnectionKind,
    receipts: readonly { transportCode: string | null; externalReceiptId: string | null }[],
  ): ConnectionEvidence {
    if (kind === ConnectionKind.EDO) {
      const receipt = receipts.find(
        (each) => each.externalReceiptId !== null && each.transportCode !== null,
      );
      return {
        kind,
        // The transport port and its contract exist, and a fake satisfies them.
        adapterImplemented: true,
        // No operator endpoint is configured for this organization anywhere in
        // the platform yet: there is no table that would hold one.
        endpointConfigured: false,
        credentialIssued: false,
        contractAttested: true,
        testExchangeRecorded: false,
        liveReceiptExternalId: receipt?.externalReceiptId ?? null,
      };
    }

    if (kind === ConnectionKind.ONE_C) {
      // Nothing exists for 1С beyond the capability names. Reporting it at all,
      // as NOT_ATTESTED with its prerequisites, is what stops it being quietly
      // assumed to work because the words appear in a menu.
      return {
        kind,
        adapterImplemented: false,
        endpointConfigured: false,
        credentialIssued: false,
        contractAttested: false,
        testExchangeRecorded: false,
        liveReceiptExternalId: null,
      };
    }

    if (kind === ConnectionKind.BANK_STATEMENT) {
      // An importer exists and is routed (modules/bank-reconciliation), so this
      // is not "not implemented". But it reads a statement somebody uploaded:
      // no bank endpoint is configured anywhere, no bank has issued this
      // platform credentials, and the parser has no attestation of its own in
      // the repository. ADAPTER_READY would claim an attestation that does not
      // exist, so the ladder correctly stops below it.
      return {
        kind,
        adapterImplemented: true,
        endpointConfigured: false,
        credentialIssued: false,
        contractAttested: false,
        testExchangeRecorded: false,
        liveReceiptExternalId: null,
      };
    }

    // Exhaustive: a kind added to the enum without evidence written for it here
    // fails to compile rather than being reported as anything at all.
    const unreachable: never = kind;
    throw new Error(`no connection evidence is defined for ${String(unreachable)}`);
  }
}
