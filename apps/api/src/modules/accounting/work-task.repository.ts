import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import { Role } from '../../common/types/request-user';
import { resolveMembershipCapabilities } from '../auth/membership-capability.resolver';
import {
  DerivationRefusal,
  TransitionRefusal,
  WorkTaskOrigin,
  WorkTaskResolutionMode,
  WorkTaskStatus,
  WorkTaskView,
  evaluateDerivation,
  evaluateStatusTransition,
} from './work-task.policy';

/**
 * Raising and working tasks.
 *
 * Two things happen here that could not be left to a caller.
 *
 * Raising is idempotent against the open condition rather than against a
 * request id. The deriver runs repeatedly over the same sources and must not
 * grow a new row each pass; the unique index on the open condition is what
 * makes a second raise a no-op instead of a duplicate somebody has to close
 * twice.
 *
 * Closing consults the policy and then lets the database check the world. The
 * policy answers the caller quickly and completely; the guard answers everyone.
 * If the two ever disagree the guard wins, which is the direction that fails
 * safe.
 */

export const RaiseOutcome = {
  RAISED: 'RAISED',
  ALREADY_OPEN: 'ALREADY_OPEN',
  REFUSED: 'REFUSED',
} as const;
export type RaiseOutcome = (typeof RaiseOutcome)[keyof typeof RaiseOutcome];

export interface RaiseResult {
  readonly outcome: RaiseOutcome;
  readonly taskId: string | null;
  readonly refusals: readonly DerivationRefusal[];
}

export const TransitionOutcome = {
  MOVED: 'MOVED',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  REFUSED_BY_POLICY: 'REFUSED_BY_POLICY',
  REFUSED_BY_DATABASE: 'REFUSED_BY_DATABASE',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
} as const;
export type TransitionOutcome =
  (typeof TransitionOutcome)[keyof typeof TransitionOutcome];

export interface TransitionResult {
  readonly outcome: TransitionOutcome;
  readonly refusals: readonly TransitionRefusal[];
  /** What the database said, when it is the database that refused. */
  readonly databaseReason: string | null;
}

interface TaskRow {
  id: string;
  taskType: string;
  origin: string;
  resolutionMode: string;
  status: string;
  responsibleCapability: string;
  assignedMembershipId: string | null;
  deadlineAt: Date | null;
  sourceEventId: string | null;
  documentId: string | null;
  periodId: string | null;
  version: bigint;
}

function toView(row: TaskRow): WorkTaskView {
  return {
    id: row.id,
    taskType: row.taskType,
    origin: row.origin as WorkTaskOrigin,
    resolutionMode: row.resolutionMode as WorkTaskResolutionMode,
    status: row.status as WorkTaskStatus,
    responsibleCapability: row.responsibleCapability,
    assignedMembershipId: row.assignedMembershipId,
    deadlineAt: row.deadlineAt,
    documentId: row.documentId,
    periodId: row.periodId,
    sourceEventId: row.sourceEventId,
  };
}

@Injectable()
export class WorkTaskRepository {
  constructor(private readonly transactions: RlsTransactionService) {}

  /**
   * What this actor may do, resolved from what the database knows.
   *
   * Never taken from the request. A caller that could state its own capability
   * set could state ACCOUNTING_TASK_MANAGE, and every check downstream of that
   * would be answering a question the caller had already decided.
   */
  /**
   * The same resolution, for another repository working inside one transaction.
   * Exposed rather than copied: two readings of "what may this actor do" is one
   * reading too many.
   */
  async capabilitiesWithin(
    tx: Prisma.TransactionClient,
    now: Date = new Date(),
  ): Promise<readonly string[]> {
    return this.resolveCapabilities(tx, now);
  }

  /** The acting membership, as the database resolves it. */
  async membershipWithin(tx: Prisma.TransactionClient): Promise<string | null> {
    const rows = await tx.$queryRaw<{ membership: string | null }[]>`
      SELECT public.app_pc_crop_membership_id() AS membership
    `;
    return rows[0]?.membership ?? null;
  }

  private async resolveCapabilities(
    tx: Prisma.TransactionClient,
    now: Date,
  ): Promise<readonly string[]> {
    const rows = await tx.$queryRaw<
      {
        role: string;
        jobProfile: string | null;
        membershipStatus: string;
        userStatus: string;
        membershipId: string;
      }[]
    >`
      SELECT m."role" AS role,
             m."job_profile" AS "jobProfile",
             m."status" AS "membershipStatus",
             u."status" AS "userStatus",
             m."id" AS "membershipId"
        FROM public."user_orgs" m
        JOIN public."users" u ON u."id" = m."userId"
       WHERE m."id" = public.app_pc_crop_membership_id()
    `;
    const row = rows[0];
    if (row === undefined) return [];

    const delegations = await tx.$queryRaw<
      { capabilities: string[] | null; startsAt: Date; endsAt: Date; status: string }[]
    >`
      SELECT "capabilities", "startsAt", "endsAt", "status"
        FROM public."membership_delegations"
       WHERE "toMembershipId" = ${row.membershipId}
    `;

    const resolved = resolveMembershipCapabilities({
      role: row.role as Role,
      jobProfile: row.jobProfile,
      membershipStatus: row.membershipStatus,
      userStatus: row.userStatus,
      delegations: delegations.map((d) => ({
        capabilities: d.capabilities ?? [],
        startsAt: d.startsAt,
        endsAt: d.endsAt,
        status: d.status,
      })),
      now,
    });
    return [...resolved];
  }

  /**
   * Read whether a verified condition is still true.
   *
   * A type with no reader here answers true — still holding — so an
   * unimplemented check keeps the task open rather than closing it. The guard
   * says the same thing from the other side and refuses the write outright;
   * both directions have to fail closed or neither is worth having.
   */
  private async conditionHolds(
    tx: Prisma.TransactionClient,
    row: TaskRow,
  ): Promise<boolean> {
    if (row.taskType === 'DOCUMENT_NOT_SIGNED') {
      if (row.documentId === null) return true;
      const signed = await tx.$queryRaw<{ signed: bigint }[]>`
        SELECT count(*) AS signed
          FROM public."accounting_document_versions"
         WHERE "documentId" = ${row.documentId}
           AND "signedAt" IS NOT NULL
      `;
      return Number(signed[0]?.signed ?? 0n) === 0;
    }

    if (row.taskType === 'PERIOD_READY_TO_CLOSE') {
      if (row.periodId === null) return true;
      const closed = await tx.$queryRaw<{ closed: bigint }[]>`
        SELECT count(*) AS closed
          FROM public."accounting_periods"
         WHERE "id" = ${row.periodId}
           AND "status" = 'CLOSED'
      `;
      return Number(closed[0]?.closed ?? 0n) === 0;
    }

    return true;
  }

  /**
   * Raise a derived task, or notice that it is already raised.
   *
   * The resolution mode and the responsible capability come from the registry
   * in the policy, never from the caller. A caller that could choose them could
   * raise a task about its own failure and mark it closable by anyone.
   */
  async raiseDerived(
    user: RequestUser | undefined,
    input: {
      taskType: string;
      derivationKey: string;
      title: string;
      humanDescription: string;
      dealId?: string | null;
      documentId?: string | null;
      periodId?: string | null;
      shipmentId?: string | null;
      sourceEventId?: string | null;
      deadlineAt?: Date | null;
    },
  ): Promise<RaiseResult> {
    const decision = evaluateDerivation({
      taskType: input.taskType,
      derivationKey: input.derivationKey,
    });
    if (decision.permitted === false || decision.contract === null) {
      return { outcome: RaiseOutcome.REFUSED, taskId: null, refusals: decision.refusals };
    }
    const contract = decision.contract;

    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const id = `awt_${context.orgId}_${input.derivationKey}`.slice(0, 190);

      // ON CONFLICT against the open condition, not against the id: the same
      // condition raised twice is one task, and the second pass must be silent
      // rather than an error the deriver has to catch on every run.
      const written = await tx.$executeRaw`
        INSERT INTO public."accounting_work_tasks"
          ("id","tenantId","organizationId","taskType","origin","resolutionMode",
           "derivationKey","openDerivationKey","priority","title","humanDescription",
           "responsibleCapability","dealId","documentId","periodId","shipmentId",
           "sourceEventId","deadlineAt","createdAt","updatedAt")
        VALUES (
          ${id}, ${context.tenantId}, ${context.orgId}, ${input.taskType},
          'DERIVED', ${contract.resolutionMode}, ${input.derivationKey},
          ${input.derivationKey}, ${contract.priority}, ${input.title},
          ${input.humanDescription}, ${contract.responsibleCapability},
          ${input.dealId ?? null}, ${input.documentId ?? null},
          ${input.periodId ?? null},
          ${input.shipmentId ?? null}, ${input.sourceEventId ?? null},
          ${input.deadlineAt ?? null}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("organizationId", "openDerivationKey") DO NOTHING
      `;

      return written === 0
        ? { outcome: RaiseOutcome.ALREADY_OPEN, taskId: null, refusals: [] }
        : { outcome: RaiseOutcome.RAISED, taskId: id, refusals: [] };
    });
  }

  /**
   * A person's own note to themselves.
   *
   * Manual only, and the database agrees: the insert policy admits nothing else
   * from this principal, so a caller cannot dress a claim about the world up as
   * one. Whoever raised it is resolved by the database, not named in the call.
   */
  async raiseManual(
    user: RequestUser | undefined,
    input: {
      title: string;
      humanDescription: string;
      dealId?: string | null;
      documentId?: string | null;
      deadlineAt?: Date | null;
    },
  ): Promise<RaiseResult> {
    if (input.title.trim() === '' || input.humanDescription.trim() === '') {
      // A task nobody can read is not a task. The CHECK constraint says the
      // same thing; this says it before a round trip.
      return {
        outcome: RaiseOutcome.REFUSED,
        taskId: null,
        refusals: [DerivationRefusal.BLANK_DERIVATION_KEY],
      };
    }

    return this.transactions.withOrganizationMemberContext(user, async (tx, context) => {
      const capabilities = await this.resolveCapabilities(tx, new Date());
      if (!capabilities.includes('accounting.task.manage')) {
        return { outcome: RaiseOutcome.REFUSED, taskId: null, refusals: [] };
      }

      const membership = await this.membershipWithin(tx);
      const id = `awt_manual_${context.orgId}_${Date.now()}_${Math.random()
        .toString(16)
        .slice(2, 10)}`.slice(0, 190);

      await tx.$executeRaw`
        INSERT INTO public."accounting_work_tasks"
          ("id","tenantId","organizationId","taskType","origin","resolutionMode",
           "priority","title","humanDescription","responsibleCapability",
           "dealId","documentId","deadlineAt","createdByMembershipId",
           "createdAt","updatedAt")
        VALUES (
          ${id}, ${context.tenantId}, ${context.orgId}, 'MANUAL_NOTE',
          'MANUAL', 'HUMAN_JUDGEMENT', 100, ${input.title},
          ${input.humanDescription}, 'accounting.task.manage',
          ${input.dealId ?? null}, ${input.documentId ?? null},
          ${input.deadlineAt ?? null}, ${membership},
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;

      return { outcome: RaiseOutcome.RAISED, taskId: id, refusals: [] };
    });
  }

  /**
   * The organization's open tasks, most urgent first.
   *
   * No status filter parameter. The dashboard asks "what is outstanding", and a
   * caller that could ask for resolved tasks in the same call would sooner or
   * later render them in the same list as the open ones.
   */
  async listOpen(
    user: RequestUser | undefined,
    limit = 200,
  ): Promise<readonly (WorkTaskView & { version: bigint; title: string; humanDescription: string })[]> {
    const bounded = Math.min(Math.max(Math.trunc(limit), 1), 500);
    return this.transactions.withOrganizationMemberContext(user, async (tx, context) => {
      const capabilities = await this.resolveCapabilities(tx, new Date());
      if (!capabilities.includes('accounting.dashboard.read')) return [];

      const rows = await tx.$queryRaw<(TaskRow & { title: string; humanDescription: string })[]>`
        SELECT "id","taskType","origin","resolutionMode","status",
               "responsibleCapability","assignedMembershipId","deadlineAt",
               "sourceEventId","documentId","periodId","version","title","humanDescription"
          FROM public."accounting_work_tasks"
         WHERE "organizationId" = ${context.orgId}
           AND "status" NOT IN ('RESOLVED', 'CANCELLED')
         ORDER BY "priority" ASC, "deadlineAt" ASC NULLS LAST, "createdAt" ASC
         LIMIT ${bounded}
      `;
      return rows.map((row) => ({
        ...toView(row),
        version: row.version,
        title: row.title,
        humanDescription: row.humanDescription,
      }));
    });
  }

  /**
   * Who is looking, as the projection needs them: their membership and what
   * they may do, both resolved by the database.
   */
  async describeViewer(
    user: RequestUser | undefined,
  ): Promise<{ membershipId: string; capabilities: readonly string[]; now: Date }> {
    return this.transactions.withOrganizationMemberContext(user, async (tx) => {
      const now = new Date();
      const rows = await tx.$queryRaw<{ membership: string | null }[]>`
        SELECT public.app_pc_crop_membership_id() AS membership
      `;
      return {
        membershipId: rows[0]?.membership ?? '',
        capabilities: await this.resolveCapabilities(tx, now),
        now,
      };
    });
  }

  /**
   * Move a task, with the caller's expected version.
   *
   * The version is required rather than optional. Two people working the same
   * task from two screens is the ordinary case in an accounting department, and
   * a last-write-wins update there silently discards somebody's decision.
   */
  async transition(
    user: RequestUser | undefined,
    input: {
      taskId: string;
      to: WorkTaskStatus;
      expectedVersion: bigint;
      resolutionEventId?: string | null;
      assignedMembershipId?: string | null;
    },
  ): Promise<TransitionResult> {
    return this.transactions.withOrganizationMemberContext(user, async (tx, context) => {
      const rows = await tx.$queryRaw<TaskRow[]>`
        SELECT "id","taskType","origin","resolutionMode","status",
               "responsibleCapability","assignedMembershipId","deadlineAt",
               "sourceEventId","documentId","periodId","version"
          FROM public."accounting_work_tasks"
         WHERE "id" = ${input.taskId}
           AND "organizationId" = ${context.orgId}
         FOR UPDATE
      `;
      const row = rows[0];
      if (row === undefined) {
        return {
          outcome: TransitionOutcome.TASK_NOT_FOUND,
          refusals: [],
          databaseReason: null,
        };
      }
      if (row.version !== input.expectedVersion) {
        return {
          outcome: TransitionOutcome.VERSION_CONFLICT,
          refusals: [],
          databaseReason: null,
        };
      }

      // Who is acting is resolved by the database out of user_orgs, not taken
      // from the caller and not read off a request setting the caller can
      // write. Same rule as the rest of this contour.
      const resolved = await tx.$queryRaw<{ membership: string | null }[]>`
        SELECT public.app_pc_crop_membership_id() AS membership
      `;
      const actorMembershipId = resolved[0]?.membership ?? '';

      // Whether the condition still holds is a fact about the world, so the
      // server goes and reads it inside this transaction. It is deliberately
      // not a parameter: a caller who could assert it would be closing tasks by
      // agreeing with them, which is the one thing this table exists to stop.
      const conditionStillHolds =
        row.resolutionMode === WorkTaskResolutionMode.SYSTEM_VERIFIED &&
        input.to === WorkTaskStatus.RESOLVED
          ? await this.conditionHolds(tx, row)
          : undefined;

      const decision = evaluateStatusTransition({
        task: toView(row),
        to: input.to,
        actorMembershipId,
        actorCapabilities: await this.resolveCapabilities(tx, new Date()),
        resolutionEventId: input.resolutionEventId ?? null,
        conditionStillHolds,
      });
      if (decision.permitted === false) {
        return {
          outcome: TransitionOutcome.REFUSED_BY_POLICY,
          refusals: decision.refusals,
          databaseReason: null,
        };
      }

      // Who closed it is the caller, resolved by the database from user_orgs
      // rather than accepted as a parameter. A caller that names the closer can
      // name somebody else.
      const closer =
        input.to === WorkTaskStatus.RESOLVED || input.to === WorkTaskStatus.CANCELLED
          ? actorMembershipId
          : null;

      try {
        await tx.$executeRaw`
          UPDATE public."accounting_work_tasks"
             SET "status" = ${input.to},
                 "assignedMembershipId" = COALESCE(
                   ${input.assignedMembershipId ?? null}, "assignedMembershipId"),
                 "resolvedByMembershipId" = COALESCE(
                   ${closer}, "resolvedByMembershipId"),
                 "resolutionEventId" = COALESCE(
                   ${input.resolutionEventId ?? null}, "resolutionEventId"),
                 "version" = "version" + 1,
                 "updatedAt" = CURRENT_TIMESTAMP
           WHERE "id" = ${row.id}
             AND "version" = ${input.expectedVersion}
        `;
      } catch (error) {
        // The guard refused. It knows things the policy cannot: whether the
        // document is signed right now, in this transaction.
        return {
          outcome: TransitionOutcome.REFUSED_BY_DATABASE,
          refusals: [],
          databaseReason: error instanceof Error ? error.message : String(error),
        };
      }

      return { outcome: TransitionOutcome.MOVED, refusals: [], databaseReason: null };
    });
  }
}
