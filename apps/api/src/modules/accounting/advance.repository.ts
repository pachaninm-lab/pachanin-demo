import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import {
  AdvanceRefusal,
  type EvidenceFacts,
  OffsetRefusal,
  evaluateApplyOffset,
  evaluateRecordAdvance,
  remainingKopecks,
} from './advance.policy';
import { monthIsClosed } from './period-window';
import { WorkTaskRepository } from './work-task.repository';

/**
 * Recording advances and applying them.
 *
 * Every number a decision depends on is read here, inside the transaction, from
 * the row policies' own view. Nothing is taken from the request body except the
 * intent: an offset command that could state its own remaining balance would be
 * a command that can spend an advance twice by lying.
 *
 * The database refuses the same things again. That is not redundancy to be
 * tidied away — this layer says why in words, and the guards make the rule hold
 * for anything that never comes through this layer at all.
 */

export const AdvanceOutcome = {
  RECORDED: 'RECORDED',
  APPLIED: 'APPLIED',
  /** A retry of a command already applied. Not an error. */
  ALREADY_APPLIED: 'ALREADY_APPLIED',
  REFUSED_BY_POLICY: 'REFUSED_BY_POLICY',
  REFUSED_BY_DATABASE: 'REFUSED_BY_DATABASE',
} as const;
export type AdvanceOutcome = (typeof AdvanceOutcome)[keyof typeof AdvanceOutcome];

export interface AdvanceResult {
  readonly outcome: AdvanceOutcome;
  readonly refusals: readonly (AdvanceRefusal | OffsetRefusal)[];
  readonly databaseReason: string | null;
  readonly advanceId: string | null;
  readonly offsetId: string | null;
}

export interface AdvanceView {
  readonly id: string;
  readonly dealId: string;
  readonly counterpartyOrgId: string;
  readonly amountKopecks: bigint;
  readonly appliedKopecks: bigint;
  readonly remainingKopecks: bigint;
  readonly currency: string;
  readonly receivedAt: Date;
  readonly bankOperationId: string;
  readonly version: bigint;
}

// Existing vocabulary, deliberately. Recording an advance is matching arrived
// money to a deal, and applying one is reconciliation — both already have a
// capability that means exactly that. Minting `advances.record` would widen a
// shared catalogue whose spec enumerates it, for a distinction the domain does
// not actually make.
const RECORD_CAPABILITY = 'payments.match';
const OFFSET_CAPABILITY = 'payments.reconcile';

function result(
  outcome: AdvanceOutcome,
  extra: Partial<AdvanceResult> = {},
): AdvanceResult {
  return {
    outcome,
    refusals: [],
    databaseReason: null,
    advanceId: null,
    offsetId: null,
    ...extra,
  };
}

function identifier(prefix: string, orgId: string): string {
  return `${prefix}_${orgId}_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2, 10)}`.slice(0, 190);
}

@Injectable()
export class AdvanceRepository {
  constructor(
    private readonly transactions: RlsTransactionService,
    private readonly tasks: WorkTaskRepository,
  ) {}

  /**
   * The advances on a deal, each with what is left of it.
   *
   * `remaining` is computed from the offsets on every read. There is no stored
   * balance to fall out of step with them.
   */
  async listForDeal(
    user: RequestUser | undefined,
    dealId: string,
  ): Promise<readonly AdvanceView[]> {
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const rows = await tx.$queryRaw<
        {
          id: string;
          dealId: string;
          counterpartyOrgId: string;
          amountKopecks: bigint;
          appliedKopecks: bigint | null;
          currency: string;
          receivedAt: Date;
          bankOperationId: string;
          version: bigint;
        }[]
      >`
        SELECT a."id", a."dealId", a."counterpartyOrgId", a."amountKopecks",
               COALESCE(o."applied", 0) AS "appliedKopecks",
               a."currency", a."receivedAt", a."bankOperationId", a."version"
          FROM public."accounting_advances" a
          LEFT JOIN (
            SELECT "advanceId", sum("amountKopecks") AS applied
              FROM public."accounting_advance_offsets"
             GROUP BY "advanceId"
          ) o ON o."advanceId" = a."id"
         WHERE a."organizationId" = ${context.orgId}
           AND a."dealId" = ${dealId}
         ORDER BY a."receivedAt" ASC, a."id" ASC
      `;

      return rows.map((row) => {
        const applied = BigInt(row.appliedKopecks ?? 0);
        return {
          id: row.id,
          dealId: row.dealId,
          counterpartyOrgId: row.counterpartyOrgId,
          amountKopecks: row.amountKopecks,
          appliedKopecks: applied,
          remainingKopecks: remainingKopecks(row.amountKopecks, applied),
          currency: row.currency,
          receivedAt: row.receivedAt,
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
      amountKopecks: bigint;
      currency: string;
      bankOperationId: string;
      receivedAt: Date;
    },
  ): Promise<AdvanceResult> {
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const capabilities = await this.tasks.capabilitiesWithin(tx);
      const membership = await this.tasks.membershipWithin(tx);
      const evidence = await this.readEvidence(tx, input.bankOperationId);
      const arrivalMonthIsClosed = await monthIsClosed(tx, context.orgId, input.receivedAt);

      const decision = evaluateRecordAdvance({
        mayRecord:
          membership !== null && capabilities.includes(RECORD_CAPABILITY),
        organizationId: context.orgId,
        counterpartyOrgId: input.counterpartyOrgId,
        dealId: input.dealId,
        amountKopecks: input.amountKopecks,
        currency: input.currency,
        bankOperationId: input.bankOperationId,
        evidence,
        arrivalMonthIsClosed,
      });

      if (decision.permitted === false) {
        return result(AdvanceOutcome.REFUSED_BY_POLICY, {
          refusals: decision.refusals,
        });
      }

      const id = identifier('adv', context.orgId);
      try {
        await tx.$executeRaw`
          INSERT INTO public."accounting_advances"
            ("id","tenantId","organizationId","dealId","counterpartyOrgId",
             "amountKopecks","currency","receivedAt","bankOperationId",
             "recordedByMembershipId","createdAt","updatedAt")
          VALUES (${id}, ${context.tenantId}, ${context.orgId}, ${input.dealId},
                  ${input.counterpartyOrgId}, ${input.amountKopecks},
                  ${input.currency}, ${input.receivedAt},
                  ${input.bankOperationId}, ${membership}, now(), now())
        `;
      } catch (error) {
        return result(AdvanceOutcome.REFUSED_BY_DATABASE, {
          databaseReason: error instanceof Error ? error.message : String(error),
        });
      }

      return result(AdvanceOutcome.RECORDED, { advanceId: id });
    });
  }

  /**
   * Apply part or all of an advance.
   *
   * The remaining balance is read under the same lock the database guard takes,
   * so the answer this layer gives and the answer the guard gives cannot come
   * from different moments.
   */
  async applyOffset(
    user: RequestUser | undefined,
    input: {
      advanceId: string;
      amountKopecks: bigint;
      appliedAt: Date;
      reason: string;
      idempotencyKey: string;
      documentVersionId?: string | null;
    },
  ): Promise<AdvanceResult> {
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const capabilities = await this.tasks.capabilitiesWithin(tx);
      const membership = await this.tasks.membershipWithin(tx);

      const replayed = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM public."accounting_advance_offsets"
         WHERE "idempotencyKey" = ${input.idempotencyKey}
      `;
      if (replayed.length > 0) {
        // The same command arriving twice is a retry, not a second offset.
        return result(AdvanceOutcome.ALREADY_APPLIED, {
          advanceId: input.advanceId,
          offsetId: replayed[0].id,
        });
      }

      const advances = await tx.$queryRaw<
        { amountKopecks: bigint; applied: bigint | null }[]
      >`
        SELECT a."amountKopecks",
               (SELECT COALESCE(sum(o."amountKopecks"), 0)
                  FROM public."accounting_advance_offsets" o
                 WHERE o."advanceId" = a."id") AS applied
          FROM public."accounting_advances" a
         WHERE a."id" = ${input.advanceId}
           AND a."organizationId" = ${context.orgId}
           FOR UPDATE OF a
      `;
      const advance = advances[0];

      const decision = evaluateApplyOffset({
        mayApply: membership !== null && capabilities.includes(OFFSET_CAPABILITY),
        advanceFound: advance !== undefined,
        amountKopecks: input.amountKopecks,
        advanceAmountKopecks: advance?.amountKopecks ?? 0n,
        alreadyAppliedKopecks: BigInt(advance?.applied ?? 0),
        applicationMonthIsClosed: await monthIsClosed(tx, context.orgId, input.appliedAt),
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
      });

      if (decision.permitted === false) {
        return result(AdvanceOutcome.REFUSED_BY_POLICY, {
          refusals: decision.refusals,
          advanceId: advance === undefined ? null : input.advanceId,
        });
      }

      const id = identifier('advoff', context.orgId);
      try {
        await tx.$executeRaw`
          INSERT INTO public."accounting_advance_offsets"
            ("id","tenantId","organizationId","advanceId","amountKopecks",
             "appliedAt","documentVersionId","reason","idempotencyKey",
             "appliedByMembershipId","createdAt")
          VALUES (${id}, ${context.tenantId}, ${context.orgId},
                  ${input.advanceId}, ${input.amountKopecks}, ${input.appliedAt},
                  ${input.documentVersionId ?? null}, ${input.reason},
                  ${input.idempotencyKey}, ${membership}, now())
        `;
      } catch (error) {
        return result(AdvanceOutcome.REFUSED_BY_DATABASE, {
          databaseReason: error instanceof Error ? error.message : String(error),
          advanceId: input.advanceId,
        });
      }

      return result(AdvanceOutcome.APPLIED, {
        advanceId: input.advanceId,
        offsetId: id,
      });
    });
  }

  private async readEvidence(
    tx: Prisma.TransactionClient,
    bankOperationId: string,
  ): Promise<EvidenceFacts> {
    if (bankOperationId.trim() === '') {
      return {
        found: false,
        confirmed: false,
        dealId: null,
        amountKopecks: null,
        currency: null,
      };
    }
    // The same definer function the database guard uses. Reading the table
    // directly here would be a second way to answer the same question, and the
    // two only have to disagree once for this layer to permit what the guard
    // then refuses — or worse, the other way round.
    const rows = await tx.$queryRaw<
      { dealId: string; status: string; amountKopecks: bigint; currency: string }[]
    >`
      SELECT "dealId", "status", "amountKopecks", "currency"
        FROM public.app_pc_crop_advance_evidence(${bankOperationId})
    `;
    const operation = rows[0];
    if (operation === undefined) {
      return {
        found: false,
        confirmed: false,
        dealId: null,
        amountKopecks: null,
        currency: null,
      };
    }
    return {
      found: true,
      confirmed: operation.status === 'CONFIRMED',
      dealId: operation.dealId,
      amountKopecks: operation.amountKopecks,
      currency: operation.currency,
    };
  }
}
