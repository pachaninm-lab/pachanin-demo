import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  RlsTransactionService,
  type TrustedRlsContext,
} from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import {
  assertOrganizationCapabilityReplay,
  organizationCapabilityCommandFingerprint,
  organizationCapabilityDigest,
  stableOrganizationCapabilityJson,
  type OrganizationCapabilityCommand,
  type OrganizationCapabilityCommandReceipt,
  validateOrganizationCapabilityCommand,
} from './organization-capability-command.contract';
import {
  declaredOrganizationCapabilityStatus,
  ORGANIZATION_CAPABILITY_REGISTRY,
  organizationCapabilityRequiresVerification,
  type OrganizationCapabilityCode,
  type OrganizationCapabilityStatus,
} from './organization-capability.registry';

type AssignmentRow = {
  id: string;
  tenantId: string;
  organizationId: string;
  capabilityCode: OrganizationCapabilityCode;
  status: OrganizationCapabilityStatus;
  requiresVerification: boolean;
  provenance: string;
  evidenceReference: string | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  version: bigint;
  createdByMembershipId: string;
  updatedByMembershipId: string;
  createdAt: Date;
  updatedAt: Date;
};

type ReplayRow = {
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  requestFingerprint: string;
  action: OrganizationCapabilityCommand['action'];
  toStatus: OrganizationCapabilityStatus;
  aggregateVersion: bigint;
  createdAt: Date;
  capabilityCode: OrganizationCapabilityCode;
};

function deterministicId(prefix: string, material: string): string {
  return `${prefix}-${organizationCapabilityDigest(material).slice(0, 32)}`;
}

function outboxIdempotencyKey(context: TrustedRlsContext, command: OrganizationCapabilityCommand): string {
  return `org-cap:${organizationCapabilityDigest({
    tenantId: context.tenantId,
    organizationId: context.orgId,
    idempotencyKey: command.idempotencyKey,
  })}`;
}

function staleVersion(currentVersion: bigint | string): ConflictException {
  return new ConflictException({
    code: 'ORGANIZATION_CAPABILITY_STALE_VERSION',
    currentVersion: currentVersion.toString(),
    refreshRequired: true,
  });
}

function databaseCode(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return '23505';
    if (error.code === 'P2034') return '40001';
    const meta = error.meta as Record<string, unknown> | undefined;
    if (typeof meta?.code === 'string') return meta.code;
  }
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { code?: unknown; meta?: unknown };
  if (typeof candidate.code === 'string') return candidate.code;
  if (candidate.meta && typeof candidate.meta === 'object') {
    const meta = candidate.meta as Record<string, unknown>;
    if (typeof meta.code === 'string') return meta.code;
  }
  return null;
}

@Injectable()
export class OrganizationCapabilityRepository {
  constructor(private readonly rls: RlsTransactionService) {}

  async list(user: RequestUser) {
    return this.rls.withTrustedContext(user, async (tx, context) => {
      const rows = await tx.$queryRaw<AssignmentRow[]>(Prisma.sql`
        SELECT *
        FROM public."organization_capability_assignments"
        WHERE "tenantId" = ${context.tenantId}
          AND "organizationId" = ${context.orgId}
        ORDER BY "capabilityCode" ASC
      `);
      const assignments = rows.map((row) => this.assignment(row));
      return {
        organizationId: context.orgId,
        tenantId: context.tenantId,
        enforcementMode: 'SHADOW' as const,
        registry: ORGANIZATION_CAPABILITY_REGISTRY,
        assignments,
        effectiveCapabilityCodes: assignments
          .filter((row) => row.status === 'ACTIVE' && row.effectiveNow)
          .map((row) => row.capabilityCode),
      };
    });
  }

  async execute(
    user: RequestUser,
    command: OrganizationCapabilityCommand,
  ): Promise<OrganizationCapabilityCommandReceipt> {
    validateOrganizationCapabilityCommand(command);
    if (!user.membershipId?.trim() || user.isOrgAdmin !== true) {
      throw new ForbiddenException({ code: 'ORGANIZATION_ADMIN_REQUIRED' });
    }
    const requestFingerprint = organizationCapabilityCommandFingerprint(command);

    try {
      return await this.rls.withTrustedContext(
        user,
        async (tx, context) => {
          await tx.$queryRaw(Prisma.sql`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${`${context.tenantId}:${context.orgId}:${command.capabilityCode}`}, 0)
            ) IS NULL AS "locked"
          `);
          await tx.$queryRaw(Prisma.sql`
            SELECT set_config('app.current_command_id', ${command.commandId}, true)
          `);

          const replay = await this.findReplayInTransaction(tx, context, command);
          if (replay) {
            assertOrganizationCapabilityReplay(replay.requestFingerprint, command);
            return { ...replay, replayed: true };
          }

          const locked = await this.lockAssignment(tx, context, command.capabilityCode);
          const expectedVersion = BigInt(command.expectedVersion);
          if (!locked && command.action === 'REVOKE') {
            throw new NotFoundException({ code: 'ORGANIZATION_CAPABILITY_NOT_FOUND' });
          }
          if (!locked && expectedVersion !== 0n) throw staleVersion('0');
          if (locked && locked.version !== expectedVersion) throw staleVersion(locked.version);

          const clock = await tx.$queryRaw<Array<{ now: Date }>>(Prisma.sql`
            SELECT clock_timestamp() AS now
          `);
          const committedAt = clock[0]?.now ?? new Date();
          const targetStatus: OrganizationCapabilityStatus = command.action === 'REVOKE'
            ? 'REVOKED'
            : declaredOrganizationCapabilityStatus(command.capabilityCode);
          const nextVersion = (locked?.version ?? 0n) + 1n;
          const assignment = locked
            ? await this.updateAssignment(
                tx,
                context,
                user.membershipId!,
                command,
                targetStatus,
                committedAt,
                locked,
              )
            : await this.createAssignment(
                tx,
                context,
                user.membershipId!,
                command.capabilityCode,
                targetStatus,
                committedAt,
                command.commandId,
              );
          if (assignment.version !== nextVersion) throw staleVersion(assignment.version);

          return this.appendAtomicEvidence(
            tx,
            context,
            user,
            command,
            requestFingerprint,
            locked,
            assignment,
            committedAt,
          );
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxConflictRetries: 3,
          timeout: 20_000,
        },
      );
    } catch (error) {
      if (databaseCode(error) === '23505') {
        const replay = await this.rls.withTrustedContext(user, (tx, context) =>
          this.findReplayInTransaction(tx, context, command));
        if (replay) {
          assertOrganizationCapabilityReplay(replay.requestFingerprint, command);
          return { ...replay, replayed: true };
        }
      }
      if (databaseCode(error) === '40001' || databaseCode(error) === '40P01') {
        throw new ConflictException({
          code: 'ORGANIZATION_CAPABILITY_CONCURRENT_COMMAND',
          refreshRequired: true,
        });
      }
      throw error;
    }
  }

  private async lockAssignment(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    capabilityCode: OrganizationCapabilityCode,
  ): Promise<AssignmentRow | null> {
    const rows = await tx.$queryRaw<AssignmentRow[]>(Prisma.sql`
      SELECT *
      FROM public."organization_capability_assignments"
      WHERE "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
        AND "capabilityCode" = ${capabilityCode}
      FOR UPDATE
    `);
    return rows[0] ?? null;
  }

  private async createAssignment(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    membershipId: string,
    capabilityCode: OrganizationCapabilityCode,
    status: OrganizationCapabilityStatus,
    committedAt: Date,
    commandId: string,
  ): Promise<AssignmentRow> {
    const assignmentId = deterministicId(
      'ocap',
      `${context.tenantId}:${context.orgId}:${capabilityCode}`,
    );
    const effectiveFrom = status === 'ACTIVE' ? committedAt : null;
    const requiresVerification = organizationCapabilityRequiresVerification(capabilityCode);
    const rows = await tx.$queryRaw<AssignmentRow[]>(Prisma.sql`
      INSERT INTO public."organization_capability_assignments" (
        "id", "tenantId", "organizationId", "capabilityCode", "status",
        "requiresVerification", "provenance", "evidenceReference",
        "effectiveFrom", "effectiveTo", "version", "createdByMembershipId",
        "updatedByMembershipId", "createdAt", "updatedAt"
      ) VALUES (
        ${assignmentId}, ${context.tenantId}, ${context.orgId}, ${capabilityCode}, ${status},
        ${requiresVerification}, 'SELF_DECLARED', NULL,
        ${effectiveFrom}, NULL, 1, ${membershipId}, ${membershipId}, ${committedAt}, ${committedAt}
      )
      RETURNING *
    `);
    return rows[0]!;
  }

  private async updateAssignment(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    membershipId: string,
    command: OrganizationCapabilityCommand,
    status: OrganizationCapabilityStatus,
    committedAt: Date,
    locked: AssignmentRow,
  ): Promise<AssignmentRow> {
    const effectiveFrom = status === 'ACTIVE'
      ? (locked.status === 'ACTIVE' ? locked.effectiveFrom : committedAt)
      : locked.effectiveFrom;
    const effectiveTo = status === 'REVOKED' ? committedAt : null;
    const rows = await tx.$queryRaw<AssignmentRow[]>(Prisma.sql`
      UPDATE public."organization_capability_assignments"
      SET
        "status" = ${status},
        "effectiveFrom" = ${effectiveFrom},
        "effectiveTo" = ${effectiveTo},
        "version" = "version" + 1,
        "updatedByMembershipId" = ${membershipId},
        "updatedAt" = ${committedAt}
      WHERE "id" = ${locked.id}
        AND "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
        AND "version" = ${BigInt(command.expectedVersion)}
      RETURNING *
    `);
    if (rows.length !== 1) throw staleVersion(locked.version);
    return rows[0]!;
  }

  private async appendAtomicEvidence(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    user: RequestUser,
    command: OrganizationCapabilityCommand,
    requestFingerprint: string,
    before: AssignmentRow | null,
    after: AssignmentRow,
    committedAt: Date,
  ): Promise<OrganizationCapabilityCommandReceipt> {
    const identityMaterial = `${context.tenantId}:${context.orgId}:${command.commandId}`;
    const auditId = deterministicId('audit-ocap', identityMaterial);
    const outboxEntryId = deterministicId('outbox-ocap', identityMaterial);
    const eventId = deterministicId('ocap-event', identityMaterial);
    const receipt: OrganizationCapabilityCommandReceipt = {
      commandId: command.commandId,
      idempotencyKey: command.idempotencyKey,
      correlationId: command.correlationId,
      organizationId: context.orgId,
      capabilityCode: command.capabilityCode,
      action: command.action,
      status: after.status,
      version: after.version.toString(),
      replayed: false,
      requestFingerprint,
      committedAt: committedAt.toISOString(),
      enforcementMode: 'SHADOW',
    };

    const previousAudit = await tx.auditEvent.findFirst({
      where: { objectType: 'ORGANIZATION_CAPABILITY', objectId: after.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { hash: true },
    });
    const beforeState = before ? this.assignment(before) : null;
    const afterState = this.assignment(after);
    const auditMaterial = {
      id: auditId,
      action: `ORGANIZATION_CAPABILITY_${command.action}`,
      actorUserId: context.userId,
      actorRole: context.role,
      tenantId: context.tenantId,
      orgId: context.orgId,
      objectType: 'ORGANIZATION_CAPABILITY',
      objectId: after.id,
      beforeState,
      afterState,
      outcome: 'SUCCESS',
      reason: command.reason.trim(),
      correlationId: command.correlationId,
      requestFingerprint,
      prevHash: previousAudit?.hash ?? null,
    };
    await tx.auditEvent.create({
      data: {
        id: auditId,
        action: auditMaterial.action,
        actorUserId: context.userId,
        actorRole: context.role,
        tenantId: context.tenantId,
        orgId: context.orgId,
        objectType: 'ORGANIZATION_CAPABILITY',
        objectId: after.id,
        beforeState: stableOrganizationCapabilityJson(beforeState) as Prisma.InputJsonValue,
        afterState: stableOrganizationCapabilityJson(afterState) as Prisma.InputJsonValue,
        outcome: 'SUCCESS',
        reason: command.reason.trim(),
        metadata: {
          schema: 'organization-capability.audit.v1',
          commandId: command.commandId,
          idempotencyKey: command.idempotencyKey,
          membershipId: user.membershipId,
          sessionId: context.sessionId,
          requestFingerprint,
          enforcementMode: 'SHADOW',
        } as Prisma.InputJsonValue,
        correlationId: command.correlationId,
        runtimeIdempotencyKey: outboxIdempotencyKey(context, command),
        hash: organizationCapabilityDigest(auditMaterial),
        prevHash: previousAudit?.hash ?? null,
        createdAt: committedAt,
      },
    });

    const previousEvents = await tx.$queryRaw<Array<{ hash: string }>>(Prisma.sql`
      SELECT "hash"
      FROM public."organization_capability_events"
      WHERE "assignmentId" = ${after.id}
      ORDER BY "createdAt" DESC, "id" DESC
      LIMIT 1
    `);
    const previousEvent = previousEvents[0] ?? null;
    const eventMaterial = {
      id: eventId,
      tenantId: context.tenantId,
      organizationId: context.orgId,
      assignmentId: after.id,
      commandId: command.commandId,
      idempotencyKey: command.idempotencyKey,
      requestFingerprint,
      action: command.action,
      fromStatus: before?.status ?? null,
      toStatus: after.status,
      reason: command.reason.trim(),
      actorUserId: context.userId,
      actorRole: context.role,
      actorMembershipId: user.membershipId!,
      correlationId: command.correlationId,
      prevHash: previousEvent?.hash ?? null,
      auditEventId: auditId,
      outboxEntryId,
      aggregateVersion: after.version.toString(),
    };
    const eventHash = organizationCapabilityDigest(eventMaterial);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public."organization_capability_events" (
        "id", "tenantId", "organizationId", "assignmentId", "commandId",
        "idempotencyKey", "requestFingerprint", "action", "fromStatus",
        "toStatus", "reason", "actorUserId", "actorRole", "actorMembershipId",
        "correlationId", "prevHash", "hash", "auditEventId", "outboxEntryId",
        "aggregateVersion", "createdAt"
      ) VALUES (
        ${eventId}, ${context.tenantId}, ${context.orgId}, ${after.id}, ${command.commandId},
        ${command.idempotencyKey}, ${requestFingerprint}, ${command.action}, ${before?.status ?? null},
        ${after.status}, ${command.reason.trim()}, ${context.userId}, ${context.role}, ${user.membershipId!},
        ${command.correlationId}, ${previousEvent?.hash ?? null}, ${eventHash}, ${auditId}, ${outboxEntryId},
        ${after.version}, ${committedAt}
      )
    `);

    const integrationEvent = {
      type: 'organization.capability.changed.v1',
      aggregateType: 'OrganizationCapability',
      aggregateId: after.id,
      commandId: command.commandId,
      organizationId: context.orgId,
      tenantId: context.tenantId,
      capabilityCode: command.capabilityCode,
      status: after.status,
      aggregateVersion: after.version.toString(),
      action: command.action,
      correlationId: command.correlationId,
      auditId,
      occurredAt: committedAt.toISOString(),
      enforcementMode: 'SHADOW',
    };
    const outboxKey = outboxIdempotencyKey(context, command);
    const outboxPayload = {
      schema: 'organization-capability.command.v1',
      requestFingerprint,
      receipt,
      event: integrationEvent,
    };
    if (process.env.PC_CROP_ORGANIZATION_CAPABILITY_POLICY_DIAGNOSTICS === '1') {
      const diagnostics = await tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        SELECT
          current_user AS "currentUser",
          (current_user IN (
            'pc_deal_runtime', 'one_deal_app', 'app_deal', 'app_runtime', 'app_deal_api'
          )) AS "principalAllowed",
          public.app_rls_context_ready() AS "contextReady",
          (${integrationEvent.type} = 'organization.capability.changed.v1') AS "typeMatches",
          (${context.userId} = public.app_identity_user_id()) AS "actorMatches",
          (${outboxKey} ~ '^org-cap:[0-9a-f]{64}$') AS "idempotencyMatches",
          ((${JSON.stringify(outboxPayload)}::jsonb) ->> 'schema'
            = 'organization-capability.command.v1') AS "schemaMatches",
          ((${JSON.stringify(outboxPayload)}::jsonb) #>> '{event,auditId}'
            = ${auditId}) AS "auditMatches",
          EXISTS (
            SELECT 1
            FROM public."organization_capability_events" event
            WHERE event."outboxEntryId" = ${outboxEntryId}
              AND event."auditEventId" = ${auditId}
              AND event."tenantId" = ${context.tenantId}
              AND event."organizationId" = ${context.orgId}
              AND event."actorUserId" = ${context.userId}
              AND event."actorRole" = ${context.role}
              AND event."correlationId" = ${command.correlationId}
              AND event."commandId" = ${command.commandId}
              AND event."assignmentId" = ${after.id}
              AND event."requestFingerprint" = ${requestFingerprint}
              AND event."action" = ${command.action}
              AND event."toStatus" = ${after.status}
              AND event."aggregateVersion"::text = ${after.version.toString()}
          ) AS "eventMatches"
      `);
      console.log(`[organization-capability-outbox-policy] ${JSON.stringify(diagnostics[0])}`);
    }
    await tx.outboxEntry.create({
      data: {
        id: outboxEntryId,
        type: integrationEvent.type,
        payload: outboxPayload as unknown as Prisma.InputJsonValue,
        status: 'PENDING',
        triggeredByUserId: context.userId,
        idempotencyKey: outboxKey,
        correlationId: command.correlationId,
        auditId,
        runtimeIdempotencyKey: outboxKey,
        maxRetries: 5,
        nextRetryAt: committedAt,
        createdAt: committedAt,
      },
    });
    return receipt;
  }

  private async findReplayInTransaction(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    command: OrganizationCapabilityCommand,
  ): Promise<OrganizationCapabilityCommandReceipt | null> {
    const rows = await tx.$queryRaw<ReplayRow[]>(Prisma.sql`
      SELECT
        event."commandId", event."idempotencyKey", event."correlationId",
        event."requestFingerprint", event."action", event."toStatus",
        event."aggregateVersion", event."createdAt", assignment."capabilityCode"
      FROM public."organization_capability_events" event
      JOIN public."organization_capability_assignments" assignment
        ON assignment."id" = event."assignmentId"
       AND assignment."tenantId" = event."tenantId"
       AND assignment."organizationId" = event."organizationId"
      WHERE event."tenantId" = ${context.tenantId}
        AND event."organizationId" = ${context.orgId}
        AND event."idempotencyKey" = ${command.idempotencyKey}
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) return null;
    return {
      commandId: row.commandId,
      idempotencyKey: row.idempotencyKey,
      correlationId: row.correlationId,
      organizationId: context.orgId,
      capabilityCode: row.capabilityCode,
      action: row.action,
      status: row.toStatus,
      version: row.aggregateVersion.toString(),
      replayed: false,
      requestFingerprint: row.requestFingerprint,
      committedAt: row.createdAt.toISOString(),
      enforcementMode: 'SHADOW',
    };
  }

  private assignment(row: AssignmentRow) {
    const now = Date.now();
    return {
      id: row.id,
      capabilityCode: row.capabilityCode,
      status: row.status,
      requiresVerification: row.requiresVerification,
      provenance: row.provenance,
      evidenceReference: row.evidenceReference,
      effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
      effectiveTo: row.effectiveTo?.toISOString() ?? null,
      effectiveNow: row.status === 'ACTIVE'
        && row.effectiveFrom !== null
        && row.effectiveFrom.getTime() <= now
        && (row.effectiveTo === null || now < row.effectiveTo.getTime()),
      version: row.version.toString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
