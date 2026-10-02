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
import { describeAttestation } from './connection-attestation.policy';
import { ConnectionAttestationRepository } from './connection-attestation.repository';
import { WorkTaskRepository } from './work-task.repository';

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
  constructor(
    private readonly transactions: RlsTransactionService,
    private readonly attestations: ConnectionAttestationRepository,
    private readonly tasks: WorkTaskRepository,
  ) {}

  async describe(
    user: RequestUser | undefined,
  ): Promise<readonly ConnectionState[]> {
    return this.transactions.withOrganizationMemberContext(user, async (tx, context) => {
      // GUEST is only a compatibility market-role label for an organization
      // bookkeeper. It grants nothing. The durable job_profile/delegation set is
      // resolved from PostgreSQL inside this transaction and must explicitly
      // carry integrations.read before connection metadata is returned.
      const capabilities = await this.tasks.capabilitiesWithin(tx);
      if (!capabilities.includes('integrations.read')) return [];

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

      // Which kinds somebody has actually put in front of the four gates, and
      // what those gates answered. Before this existed the contour asserted its
      // own attestation in code; an attestation a contour writes about itself is
      // not one.
      const subjects = await tx.$queryRaw<{ id: string; connectionKind: string }[]>`
        SELECT s."id", s."connectionKind"
          FROM public."connection_attestation_subjects" s
         WHERE s."organizationId" = ${context.orgId}
      `;

      const attested = new Set<string>();
      for (const subject of subjects) {
        const state = describeAttestation(
          await this.attestations.answers(tx, subject.id),
        );
        if (state.attested) {
          attested.add(subject.connectionKind);
        }
      }

      const evidence = KNOWN_CONNECTION_KINDS.map((kind) =>
        this.evidenceFor(kind, receipts, attested),
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
    attested: ReadonlySet<string>,
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
        // Four gates, four different people, still live and still bound to the
        // version of the subject that is current. Not a constant in this file.
        contractAttested: attested.has(kind),
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
        contractAttested: attested.has(kind),
        testExchangeRecorded: false,
        liveReceiptExternalId: null,
      };
    }

    if (kind === ConnectionKind.BANK_STATEMENT) {
      // An importer exists and is routed (modules/bank-reconciliation), so this
      // is not "not implemented". But it reads a statement somebody uploaded:
      // no bank endpoint is configured anywhere and no bank has issued this
      // platform credentials. Whether its contract has been attested is a
      // question for the four gates, like everything else here.
      return {
        kind,
        adapterImplemented: true,
        endpointConfigured: false,
        credentialIssued: false,
        contractAttested: attested.has(kind),
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
