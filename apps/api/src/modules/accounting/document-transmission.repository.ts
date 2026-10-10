import { Injectable } from '@nestjs/common';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import {
  DocumentFreshness,
  type FreshnessAssessment,
} from '../auth/accounting-document-staleness.policy';
import {
  AdapterMaturity,
  TransmissionRefusal,
  evaluateTransmission,
} from './document-transmission.policy';
import {
  type AccountingDocumentTransport,
  TransportOutcome,
  type TransportReceipt,
  receiptIsCoherent,
} from './document-transport.port';

/**
 * Sending a version, and recording what came back.
 *
 * The network call happens outside any database transaction, deliberately.
 * Holding row locks across a call to somebody else's system means an operator
 * having a slow morning becomes a stalled database here, and the fix — a
 * timeout — turns their slow morning into our lost receipt.
 *
 * What makes that safe is the transport contract: sending is idempotent on the
 * version, so a crash between the send and the record is recoverable by sending
 * again. The far side returns the receipt it already issued rather than
 * delivering twice. That property is why the contract has it.
 */

export const SendOutcome = {
  SENT: 'SENT',
  ALREADY_SENT: 'ALREADY_SENT',
  VERSION_NOT_FOUND: 'VERSION_NOT_FOUND',
  REFUSED_BY_POLICY: 'REFUSED_BY_POLICY',
  REJECTED_BY_COUNTERPARTY: 'REJECTED_BY_COUNTERPARTY',
  TRANSPORT_UNAVAILABLE: 'TRANSPORT_UNAVAILABLE',
  AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION',
  /** The adapter answered with something that does not hold together. */
  INCOHERENT_RECEIPT: 'INCOHERENT_RECEIPT',
} as const;
export type SendOutcome = (typeof SendOutcome)[keyof typeof SendOutcome];

export interface SendResult {
  readonly outcome: SendOutcome;
  readonly refusals: readonly TransmissionRefusal[];
  readonly rejectionReasons: readonly string[];
  readonly externalReceiptId: string | null;
}

interface VersionRow {
  id: string;
  documentType: string;
  documentNumber: string | null;
  payloadHash: string;
  signedAt: Date | null;
  sentAt: Date | null;
  externalReceiptId: string | null;
  counterpartyOrgId: string | null;
}

function result(
  outcome: SendOutcome,
  extra: Partial<SendResult> = {},
): SendResult {
  return {
    outcome,
    refusals: [],
    rejectionReasons: [],
    externalReceiptId: null,
    ...extra,
  };
}

@Injectable()
export class DocumentTransmissionRepository {
  constructor(private readonly transactions: RlsTransactionService) {}

  /**
   * What would happen if this version were sent right now, and why not.
   *
   * A read, and the only transmission surface that exists yet. There is no send
   * route, because sending needs an attested adapter and none exists: exposing
   * one that always refuses, or one wired to the fake, would be the fictitious
   * «Подключено» the contract forbids. Answering "not yet, and here is the
   * list" is the true thing the screen can show today.
   */
  async describeReadiness(
    user: RequestUser | undefined,
    input: {
      versionId: string;
      freshness: FreshnessAssessment;
      formatAllowed: boolean;
      formatReasons: readonly string[];
      adapterMaturity: AdapterMaturity;
    },
  ): Promise<{
    found: boolean;
    sendable: boolean;
    refusals: readonly TransmissionRefusal[];
    sentAt: Date | null;
    externalReceiptId: string | null;
  }> {
    const version = await this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const rows = await tx.$queryRaw<VersionRow[]>`
          SELECT v."id", d."documentType", d."documentNumber", v."payloadHash",
                 v."signedAt", v."sentAt", v."externalReceiptId",
                 d."counterpartyOrgId"
            FROM public."accounting_document_versions" v
            JOIN public."accounting_documents" d ON d."id" = v."documentId"
           WHERE v."id" = ${input.versionId}
             AND v."organizationId" = ${context.orgId}
        `;
        return rows[0];
      },
    );

    if (version === undefined) {
      return {
        found: false,
        sendable: false,
        refusals: [],
        sentAt: null,
        externalReceiptId: null,
      };
    }

    const decision = evaluateTransmission({
      signedAt: version.signedAt,
      freshness: input.freshness,
      formatAllowed: input.formatAllowed,
      formatReasons: input.formatReasons as never,
      adapterMaturity: input.adapterMaturity,
      acceptedExternalId: version.externalReceiptId,
    });

    return {
      found: true,
      sendable: decision.permitted,
      refusals: decision.refusals,
      sentAt: version.sentAt,
      externalReceiptId: version.externalReceiptId,
    };
  }

  /**
   * Hand a signed version to an adapter.
   *
   * The freshness assessment and the format verdict are passed in because they
   * are decided by policies this repository does not own. The adapter's
   * maturity is passed in for the same reason, and until the attestation
   * contour is generalised there is nowhere else it could come from — which is
   * recorded rather than papered over.
   */
  async send(
    user: RequestUser | undefined,
    transport: AccountingDocumentTransport,
    input: {
      versionId: string;
      payload: string;
      freshness: FreshnessAssessment;
      formatAllowed: boolean;
      formatReasons: readonly string[];
      adapterMaturity: AdapterMaturity;
      counterpartyInn: string;
      formatRevision: string;
    },
  ): Promise<SendResult> {
    const version = await this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const rows = await tx.$queryRaw<VersionRow[]>`
          SELECT v."id", d."documentType", d."documentNumber", v."payloadHash",
                 v."signedAt", v."sentAt", v."externalReceiptId",
                 d."counterpartyOrgId"
            FROM public."accounting_document_versions" v
            JOIN public."accounting_documents" d ON d."id" = v."documentId"
           WHERE v."id" = ${input.versionId}
             AND v."organizationId" = ${context.orgId}
        `;
        return rows[0];
      },
    );

    if (version === undefined) return result(SendOutcome.VERSION_NOT_FOUND);

    const decision = evaluateTransmission({
      signedAt: version.signedAt,
      freshness: input.freshness,
      formatAllowed: input.formatAllowed,
      formatReasons: input.formatReasons as never,
      adapterMaturity: input.adapterMaturity,
      acceptedExternalId: version.externalReceiptId,
    });

    if (decision.permitted === false) {
      if (decision.refusals.includes(TransmissionRefusal.ALREADY_ACCEPTED)) {
        return result(SendOutcome.ALREADY_SENT, {
          externalReceiptId: version.externalReceiptId,
        });
      }
      return result(SendOutcome.REFUSED_BY_POLICY, { refusals: decision.refusals });
    }

    // Outside the transaction. See the note at the top: the contract's
    // idempotency is what makes this recoverable rather than this lock.
    const receipt: TransportReceipt = await transport.send({
      versionId: version.id,
      documentType: version.documentType,
      documentNumber: version.documentNumber ?? '',
      payload: input.payload,
      payloadHash: version.payloadHash,
      counterpartyInn: input.counterpartyInn,
      formatRevision: input.formatRevision,
    });

    if (receiptIsCoherent(receipt) === false) {
      // An adapter that answers with something that does not hold together is
      // not evidence of anything, and recording it would make it evidence.
      return result(SendOutcome.INCOHERENT_RECEIPT);
    }

    if (receipt.outcome === TransportOutcome.REJECTED) {
      return result(SendOutcome.REJECTED_BY_COUNTERPARTY, {
        rejectionReasons: receipt.rejectionReasons,
      });
    }
    if (receipt.outcome === TransportOutcome.UNAVAILABLE) {
      return result(SendOutcome.TRANSPORT_UNAVAILABLE);
    }
    if (receipt.outcome === TransportOutcome.DEFERRED) {
      // Nothing is recorded: taken for processing is not delivered, and a row
      // that says sent would make the difference invisible.
      return result(SendOutcome.AWAITING_CONFIRMATION);
    }

    await this.transactions.withTrustedContext(user, async (tx, context) => {
      await tx.$executeRaw`
        UPDATE public."accounting_document_versions"
           SET "sentAt" = CURRENT_TIMESTAMP,
               "transportCode" = ${transport.code},
               "externalReceiptId" = ${receipt.externalReceiptId},
               "externalReceiptIssuer" = ${receipt.externalReceiptIssuer}
         WHERE "id" = ${version.id}
           AND "organizationId" = ${context.orgId}
           AND "sentAt" IS NULL
      `;
    });

    return result(SendOutcome.SENT, {
      externalReceiptId: receipt.externalReceiptId,
    });
  }
}

/** Convenience for callers with nothing to say about freshness yet. */
export function currentFreshness(): FreshnessAssessment {
  return {
    freshness: DocumentFreshness.CURRENT,
    staleSources: [],
    unverifiableSources: [],
  };
}
