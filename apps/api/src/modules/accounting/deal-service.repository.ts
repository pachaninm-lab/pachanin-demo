import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import {
  DecisionRefusal,
  ReversalRefusal,
  ServiceRefusal,
  ServiceStatus,
  UNIT_FOR_KIND,
  amountKopecks,
  evaluateDecideService,
  evaluateRecordService,
  evaluateReverseService,
  isServiceKind,
  netKopecks,
  type ServiceKind,
  type ServiceUnit,
} from './deal-service.policy';
import { monthIsClosed } from './period-window';
import { WorkTaskRepository } from './work-task.repository';

/**
 * Recording services rendered on a deal, approving them, and reversing them.
 *
 * Every number a decision rests on is read here, inside the transaction, from
 * the row policies' own view. The amount is not read from the request at all: it
 * is computed from the quantity and the rate, and the database recomputes it
 * again in a CHECK. A command that could state its own total is a command that
 * can charge whatever it likes for one ton.
 *
 * A correction is a reversal line, never an edit. The repository copies the
 * original's terms from the row it read under lock rather than from the command,
 * so a reversal cannot cancel a large charge with a small one.
 */

export const ServiceOutcome = {
  RECORDED: 'RECORDED',
  /** A retry of a command already recorded. Not an error. */
  ALREADY_RECORDED: 'ALREADY_RECORDED',
  DECIDED: 'DECIDED',
  REVERSED: 'REVERSED',
  REFUSED_BY_POLICY: 'REFUSED_BY_POLICY',
  REFUSED_BY_DATABASE: 'REFUSED_BY_DATABASE',
} as const;
export type ServiceOutcome = (typeof ServiceOutcome)[keyof typeof ServiceOutcome];

export interface ServiceResult {
  readonly outcome: ServiceOutcome;
  readonly refusals: readonly (ServiceRefusal | DecisionRefusal | ReversalRefusal)[];
  readonly databaseReason: string | null;
  readonly serviceId: string | null;
  readonly status: ServiceStatus | null;
}

export interface ServiceView {
  readonly id: string;
  readonly dealId: string;
  readonly counterpartyOrgId: string;
  readonly kind: ServiceKind;
  readonly unit: ServiceUnit;
  readonly quantityMilliUnits: bigint;
  readonly tonnageMilliTons: bigint | null;
  readonly periodFrom: Date | null;
  readonly periodTo: Date | null;
  readonly rateKopecks: bigint;
  readonly amountKopecks: bigint;
  readonly currency: string;
  readonly renderedAt: Date;
  readonly status: ServiceStatus;
  readonly recordedByMembershipId: string;
  readonly approvedAt: Date | null;
  readonly approvedByMembershipId: string | null;
  readonly documentVersionId: string | null;
  readonly reversesServiceId: string | null;
  readonly reversedByServiceId: string | null;
  readonly version: bigint;
}

export interface DealServices {
  readonly lines: readonly ServiceView[];
  /** Approved lines less approved reversals. Derived, never stored. */
  readonly netKopecks: bigint;
}

// Existing vocabulary, deliberately. Rendering a service is preparing an
// accounting fact for the package, agreeing it is owed is validating a document
// figure, and reversing it is a correction — all three already name themselves
// in the capability catalogue. Minting `services.record` would widen a shared
// vocabulary whose spec enumerates it, for distinctions the contour already
// makes.
const RECORD_CAPABILITY = 'accounting.package.prepare';
const DECIDE_CAPABILITY = 'documents.validate';
const REVERSE_CAPABILITY = 'documents.correct';

interface ServiceRow {
  id: string;
  dealId: string;
  counterpartyOrgId: string;
  kind: string;
  unit: string;
  quantityMilliUnits: bigint;
  tonnageMilliTons: bigint | null;
  periodFrom: Date | null;
  periodTo: Date | null;
  rateKopecks: bigint;
  amountKopecks: bigint;
  currency: string;
  renderedAt: Date;
  status: string;
  recordedByMembershipId: string;
  approvedAt: Date | null;
  approvedByMembershipId: string | null;
  documentVersionId: string | null;
  reversesServiceId: string | null;
  version: bigint;
}

function result(
  outcome: ServiceOutcome,
  extra: Partial<ServiceResult> = {},
): ServiceResult {
  return {
    outcome,
    refusals: [],
    databaseReason: null,
    serviceId: null,
    status: null,
    ...extra,
  };
}

function identifier(prefix: string, orgId: string): string {
  return `${prefix}_${orgId}_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2, 10)}`.slice(0, 190);
}

/**
 * The status as the policy names it.
 *
 * The column is text and the database constrains it to three values, so a row
 * outside them cannot exist — but this layer is not the place to assume that. An
 * unrecognised status is reported as such rather than cast, because a line that
 * silently reads as RENDERED could then be approved twice.
 */
function statusOf(value: string): ServiceStatus | null {
  return value === ServiceStatus.RENDERED
    || value === ServiceStatus.APPROVED
    || value === ServiceStatus.REJECTED
    ? value
    : null;
}

@Injectable()
export class DealServiceRepository {
  constructor(
    private readonly transactions: RlsTransactionService,
    private readonly tasks: WorkTaskRepository,
  ) {}

  /**
   * The service lines on a deal, and what they come to.
   *
   * `reversedByServiceId` is resolved here rather than left to the caller: a
   * client that has to join the lines itself to see which of them were reversed
   * is a client that will render a reversed charge as owed.
   */
  async listForDeal(
    user: RequestUser | undefined,
    dealId: string,
  ): Promise<DealServices> {
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const rows = await tx.$queryRaw<(ServiceRow & { reversedByServiceId: string | null })[]>`
        SELECT s."id", s."dealId", s."counterpartyOrgId", s."kind", s."unit",
               s."quantityMilliUnits", s."tonnageMilliTons", s."periodFrom",
               s."periodTo", s."rateKopecks", s."amountKopecks", s."currency",
               s."renderedAt", s."status", s."recordedByMembershipId",
               s."approvedAt", s."approvedByMembershipId", s."documentVersionId",
               s."reversesServiceId", s."version",
               reversal."id" AS "reversedByServiceId"
          FROM public."accounting_deal_services" s
          LEFT JOIN public."accounting_deal_services" reversal
            ON reversal."reversesServiceId" = s."id"
         -- Both halves are load-bearing, and the organization one is not
         -- redundant with the row policy: a superuser connection bypasses row
         -- level security even where it is FORCEd, and removing this predicate
         -- was measured to leak another organization's lines in exactly that
         -- case. The policy carries it for every non-superuser principal.
         WHERE s."organizationId" = ${context.orgId}
           AND s."dealId" = ${dealId}
         ORDER BY s."renderedAt" ASC, s."id" ASC
      `;

      const lines = rows.flatMap((row) => {
        const kind = row.kind;
        const status = statusOf(row.status);
        if (isServiceKind(kind) === false || status === null) return [];
        return [
          {
            id: row.id,
            dealId: row.dealId,
            counterpartyOrgId: row.counterpartyOrgId,
            kind,
            unit: UNIT_FOR_KIND[kind],
            quantityMilliUnits: row.quantityMilliUnits,
            tonnageMilliTons: row.tonnageMilliTons,
            periodFrom: row.periodFrom,
            periodTo: row.periodTo,
            rateKopecks: row.rateKopecks,
            amountKopecks: row.amountKopecks,
            currency: row.currency,
            renderedAt: row.renderedAt,
            status,
            recordedByMembershipId: row.recordedByMembershipId,
            approvedAt: row.approvedAt,
            approvedByMembershipId: row.approvedByMembershipId,
            documentVersionId: row.documentVersionId,
            reversesServiceId: row.reversesServiceId,
            reversedByServiceId: row.reversedByServiceId,
            version: row.version,
          },
        ];
      });

      return {
        lines,
        netKopecks: netKopecks(
          lines.map((line) => ({
            status: line.status,
            amountKopecks: line.amountKopecks,
            isReversal: line.reversesServiceId !== null,
          })),
        ),
      };
    });
  }

  async record(
    user: RequestUser | undefined,
    input: {
      dealId: string;
      counterpartyOrgId: string;
      kind: string;
      quantityMilliUnits: bigint;
      tonnageMilliTons: bigint | null;
      periodFrom: Date | null;
      periodTo: Date | null;
      rateKopecks: bigint;
      currency: string;
      renderedAt: Date;
      idempotencyKey: string;
    },
  ): Promise<ServiceResult> {
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const replayed = await this.byIdempotencyKey(tx, input.idempotencyKey);
      if (replayed !== undefined) {
        return result(ServiceOutcome.ALREADY_RECORDED, {
          serviceId: replayed.id,
          status: statusOf(replayed.status),
        });
      }

      const capabilities = await this.tasks.capabilitiesWithin(tx);
      const membership = await this.tasks.membershipWithin(tx);

      const decision = evaluateRecordService({
        mayRecord:
          membership !== null && capabilities.includes(RECORD_CAPABILITY),
        organizationId: context.orgId,
        counterpartyOrgId: input.counterpartyOrgId,
        kind: input.kind,
        quantityMilliUnits: input.quantityMilliUnits,
        tonnageMilliTons: input.tonnageMilliTons,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        rateKopecks: input.rateKopecks,
        currency: input.currency,
        idempotencyKey: input.idempotencyKey,
        renderedMonthIsClosed: await monthIsClosed(
          tx,
          context.orgId,
          input.renderedAt,
        ),
      });

      if (decision.permitted === false) {
        return result(ServiceOutcome.REFUSED_BY_POLICY, {
          refusals: decision.refusals,
        });
      }

      // The kind is known: the policy refuses an unknown one before reaching
      // here, and the unit follows from it rather than from the command.
      const kind = input.kind as ServiceKind;
      const id = identifier('dsvc', context.orgId);
      const amount = amountKopecks(input.quantityMilliUnits, input.rateKopecks);

      try {
        await tx.$executeRaw`
          INSERT INTO public."accounting_deal_services"
            ("id","tenantId","organizationId","dealId","counterpartyOrgId",
             "kind","unit","quantityMilliUnits","tonnageMilliTons","periodFrom",
             "periodTo","rateKopecks","amountKopecks","currency","renderedAt",
             "status","recordedByMembershipId","idempotencyKey","createdAt",
             "updatedAt")
          VALUES (${id}, ${context.tenantId}, ${context.orgId}, ${input.dealId},
                  ${input.counterpartyOrgId}, ${kind}, ${UNIT_FOR_KIND[kind]},
                  ${input.quantityMilliUnits}, ${input.tonnageMilliTons},
                  ${input.periodFrom}, ${input.periodTo}, ${input.rateKopecks},
                  ${amount}, ${input.currency}, ${input.renderedAt},
                  ${ServiceStatus.RENDERED}, ${membership},
                  ${input.idempotencyKey}, now(), now())
        `;
      } catch (error) {
        return result(ServiceOutcome.REFUSED_BY_DATABASE, {
          databaseReason: error instanceof Error ? error.message : String(error),
        });
      }

      return result(ServiceOutcome.RECORDED, {
        serviceId: id,
        status: ServiceStatus.RENDERED,
      });
    });
  }

  /**
   * Approve or reject a rendered line.
   *
   * The approving membership is not accepted from the caller. It is read from
   * the session inside this transaction and the database compares it against
   * the identity of the session again, so an approval cannot be attributed to
   * a colleague who never saw the line.
   */
  async decide(
    user: RequestUser | undefined,
    input: {
      serviceId: string;
      intended: typeof ServiceStatus.APPROVED | typeof ServiceStatus.REJECTED;
    },
  ): Promise<ServiceResult> {
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const capabilities = await this.tasks.capabilitiesWithin(tx);
      const membership = await this.tasks.membershipWithin(tx);

      const rows = await tx.$queryRaw<ServiceRow[]>`
        SELECT "id", "dealId", "counterpartyOrgId", "kind", "unit",
               "quantityMilliUnits", "tonnageMilliTons", "periodFrom", "periodTo",
               "rateKopecks", "amountKopecks", "currency", "renderedAt", "status",
               "recordedByMembershipId", "approvedAt", "approvedByMembershipId",
               "documentVersionId", "reversesServiceId", "version"
          FROM public."accounting_deal_services"
         WHERE "id" = ${input.serviceId}
           AND "organizationId" = ${context.orgId}
           FOR UPDATE
      `;
      const service = rows[0];

      const decision = evaluateDecideService({
        mayDecide:
          membership !== null && capabilities.includes(DECIDE_CAPABILITY),
        serviceFound: service !== undefined,
        intended: input.intended,
        currentStatus: service === undefined ? null : statusOf(service.status),
        recordedByMembershipId: service?.recordedByMembershipId ?? null,
        decidingMembershipId: membership,
        renderedMonthIsClosed:
          service === undefined
            ? false
            : await monthIsClosed(tx, context.orgId, service.renderedAt),
      });

      if (decision.permitted === false) {
        return result(ServiceOutcome.REFUSED_BY_POLICY, {
          refusals: decision.refusals,
          serviceId: service === undefined ? null : input.serviceId,
          status: service === undefined ? null : statusOf(service.status),
        });
      }

      const approver =
        input.intended === ServiceStatus.APPROVED ? membership : null;
      try {
        await tx.$executeRaw`
          UPDATE public."accounting_deal_services"
             SET "status" = ${input.intended},
                 "approvedByMembershipId" = ${approver},
                 "version" = "version" + 1,
                 "updatedAt" = now()
           WHERE "id" = ${input.serviceId}
        `;
      } catch (error) {
        return result(ServiceOutcome.REFUSED_BY_DATABASE, {
          databaseReason: error instanceof Error ? error.message : String(error),
          serviceId: input.serviceId,
        });
      }

      return result(ServiceOutcome.DECIDED, {
        serviceId: input.serviceId,
        status: input.intended,
      });
    });
  }

  /**
   * Reverse an approved line.
   *
   * The reversal is a line of its own, in RENDERED, needing its own approval by
   * a second person. A correction that took effect the moment one person asked
   * for it would be a way around the rule that put two names on the charge in
   * the first place.
   */
  async reverse(
    user: RequestUser | undefined,
    input: { serviceId: string; renderedAt: Date; idempotencyKey: string },
  ): Promise<ServiceResult> {
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const replayed = await this.byIdempotencyKey(tx, input.idempotencyKey);
      if (replayed !== undefined) {
        return result(ServiceOutcome.ALREADY_RECORDED, {
          serviceId: replayed.id,
          status: statusOf(replayed.status),
        });
      }

      const capabilities = await this.tasks.capabilitiesWithin(tx);
      const membership = await this.tasks.membershipWithin(tx);

      // Locked, and read here rather than trusted from the command: the terms
      // below are copied from this row, and the guard refuses a reversal whose
      // terms differ from the original's.
      const rows = await tx.$queryRaw<(ServiceRow & { reversedBy: string | null })[]>`
        SELECT s."id", s."dealId", s."counterpartyOrgId", s."kind", s."unit",
               s."quantityMilliUnits", s."tonnageMilliTons", s."periodFrom",
               s."periodTo", s."rateKopecks", s."amountKopecks", s."currency",
               s."renderedAt", s."status", s."recordedByMembershipId",
               s."approvedAt", s."approvedByMembershipId", s."documentVersionId",
               s."reversesServiceId", s."version",
               (SELECT r."id" FROM public."accounting_deal_services" r
                 WHERE r."reversesServiceId" = s."id") AS "reversedBy"
          FROM public."accounting_deal_services" s
         WHERE s."id" = ${input.serviceId}
           AND s."organizationId" = ${context.orgId}
           FOR UPDATE OF s
      `;
      const original = rows[0];

      const decision = evaluateReverseService({
        mayReverse:
          membership !== null && capabilities.includes(REVERSE_CAPABILITY),
        originalFound: original !== undefined,
        originalStatus: original === undefined ? null : statusOf(original.status),
        originalIsReversal: original?.reversesServiceId !== null
          && original?.reversesServiceId !== undefined,
        originalAlreadyReversed: original?.reversedBy !== null
          && original?.reversedBy !== undefined,
        reversalMonthIsClosed:
          original === undefined
            ? false
            : await monthIsClosed(tx, context.orgId, input.renderedAt),
        idempotencyKey: input.idempotencyKey,
      });

      if (decision.permitted === false) {
        return result(ServiceOutcome.REFUSED_BY_POLICY, {
          refusals: decision.refusals,
          serviceId: original === undefined ? null : input.serviceId,
        });
      }

      const settled = original as ServiceRow;
      const id = identifier('dsvcrev', context.orgId);
      try {
        await tx.$executeRaw`
          INSERT INTO public."accounting_deal_services"
            ("id","tenantId","organizationId","dealId","counterpartyOrgId",
             "kind","unit","quantityMilliUnits","tonnageMilliTons","periodFrom",
             "periodTo","rateKopecks","amountKopecks","currency","renderedAt",
             "status","recordedByMembershipId","reversesServiceId",
             "idempotencyKey","createdAt","updatedAt")
          VALUES (${id}, ${context.tenantId}, ${context.orgId},
                  ${settled.dealId}, ${settled.counterpartyOrgId},
                  ${settled.kind}, ${settled.unit},
                  ${settled.quantityMilliUnits}, ${settled.tonnageMilliTons},
                  ${settled.periodFrom}, ${settled.periodTo},
                  ${settled.rateKopecks}, ${settled.amountKopecks},
                  ${settled.currency}, ${input.renderedAt},
                  ${ServiceStatus.RENDERED}, ${membership}, ${settled.id},
                  ${input.idempotencyKey}, now(), now())
        `;
      } catch (error) {
        return result(ServiceOutcome.REFUSED_BY_DATABASE, {
          databaseReason: error instanceof Error ? error.message : String(error),
          serviceId: input.serviceId,
        });
      }

      return result(ServiceOutcome.REVERSED, {
        serviceId: id,
        status: ServiceStatus.RENDERED,
      });
    });
  }

  private async byIdempotencyKey(
    tx: Prisma.TransactionClient,
    idempotencyKey: string,
  ): Promise<{ id: string; status: string } | undefined> {
    if (idempotencyKey.trim() === '') return undefined;
    const rows = await tx.$queryRaw<{ id: string; status: string }[]>`
      SELECT "id", "status" FROM public."accounting_deal_services"
       WHERE "idempotencyKey" = ${idempotencyKey}
    `;
    return rows[0];
  }
}
