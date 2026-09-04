import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  assessIntegrationCapability,
  isIntegrationCapabilityMaturity,
  type IntegrationBindingStatus,
  type IntegrationBindingType,
  type IntegrationCapabilityEvidenceFact,
  type IntegrationCapabilityMaturity,
} from '../../../../../packages/domain-core/src';
import {
  RlsTransactionService,
  type TrustedRlsContext,
} from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import {
  assertIntegrationBindingReplay,
  integrationBindingCommandFingerprint,
  integrationBindingDigest,
  stableIntegrationBindingJson,
  type IntegrationBindingCommand,
  type IntegrationBindingCommandReceipt,
  validateIntegrationBindingCommand,
} from './integration-binding.contract';

type BindingRow = {
  id: string;
  tenantId: string;
  organizationId: string;
  providerId: string;
  providerCapabilityId: string;
  bindingKey: string;
  capabilityCode: string;
  transportType: IntegrationBindingType;
  environment: string;
  endpointReference: string | null;
  credentialReference: string | null;
  status: IntegrationBindingStatus;
  version: bigint;
  createdByMembershipId: string;
  updatedByMembershipId: string;
  createdAt: Date;
  updatedAt: Date;
};

type EvidenceRow = {
  id: string;
  integrationBindingId: string;
  maturity: string;
  evidenceReference: string;
  evidenceIssuer: string;
  externalReceiptId: string | null;
  checkedAt: Date;
  expiresAt: Date | null;
  version: bigint;
  recordedByAuthority: string;
};

type ReplayRow = {
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  integrationBindingId: string;
  action: IntegrationBindingCommand['action'];
  resultStatus: string;
  aggregateVersion: bigint;
  requestFingerprint: string;
  createdAt: Date;
};

function deterministicId(prefix: string, material: string): string {
  return `${prefix}-${integrationBindingDigest(material).slice(0, 32)}`;
}

function staleVersion(currentVersion: bigint | string): ConflictException {
  return new ConflictException({
    code: 'INTEGRATION_BINDING_STALE_VERSION',
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
export class IntegrationBindingRepository {
  constructor(private readonly rls: RlsTransactionService) {}

  async listOwn(user: RequestUser) {
    return this.rls.withTrustedContext(user, async (tx, context) => {
      const [bindings, evidence] = await Promise.all([
        tx.$queryRaw<BindingRow[]>(Prisma.sql`
          SELECT * FROM public."integration_bindings"
          WHERE "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
          ORDER BY "bindingKey" ASC
        `),
        tx.$queryRaw<EvidenceRow[]>(Prisma.sql`
          SELECT
            "id", "integrationBindingId", "maturity", "evidenceReference",
            "evidenceIssuer", "externalReceiptId", "checkedAt", "expiresAt",
            "version", "recordedByAuthority"
          FROM public."integration_capability_evidence"
          WHERE "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
          ORDER BY "integrationBindingId", "checkedAt" ASC, "id" ASC
        `),
      ]);
      const evidenceByBinding = new Map<string, EvidenceRow[]>();
      for (const fact of evidence) {
        const facts = evidenceByBinding.get(fact.integrationBindingId) ?? [];
        facts.push(fact);
        evidenceByBinding.set(fact.integrationBindingId, facts);
      }
      return {
        tenantId: context.tenantId,
        organizationId: context.orgId,
        authority: 'POSTGRESQL' as const,
        maturityAuthority: 'SERVER_HELD_EVIDENCE' as const,
        items: bindings.map((binding) => {
          const facts = (evidenceByBinding.get(binding.id) ?? [])
            .filter((fact): fact is EvidenceRow & { maturity: IntegrationCapabilityMaturity } =>
              isIntegrationCapabilityMaturity(fact.maturity));
          return {
            ...this.bindingView(binding),
            assessment: assessIntegrationCapability(
              binding.status,
              facts.map((fact) => this.evidenceFact(fact)),
            ),
            evidence: facts.map((fact) => this.evidenceView(fact)),
          };
        }),
      };
    });
  }

  async execute(
    user: RequestUser,
    command: IntegrationBindingCommand,
  ): Promise<IntegrationBindingCommandReceipt> {
    validateIntegrationBindingCommand(command);
    if (!user.membershipId?.trim() || user.isOrgAdmin !== true) {
      throw new ForbiddenException({ code: 'ORGANIZATION_ADMIN_REQUIRED' });
    }
    const requestFingerprint = integrationBindingCommandFingerprint(command);
    try {
      return await this.rls.withTrustedContext(
        user,
        async (tx, context) => {
          await tx.$queryRaw(Prisma.sql`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${`${context.tenantId}:${context.orgId}:integration-binding`}, 0)
            ) IS NULL AS "locked"
          `);
          await tx.$queryRaw(Prisma.sql`
            SELECT set_config('app.current_command_id', ${command.commandId}, true)
          `);
          const durableAuthority = await tx.$queryRaw<Array<{ allowed: boolean }>>(Prisma.sql`
            SELECT public.app_organization_capability_is_org_admin() AS allowed
          `);
          if (durableAuthority[0]?.allowed !== true) {
            throw new ForbiddenException({ code: 'ORGANIZATION_ADMIN_REQUIRED' });
          }
          const replay = await this.findReplay(tx, context, command);
          if (replay) {
            assertIntegrationBindingReplay(replay.requestFingerprint, command);
            return { ...replay, replayed: true };
          }

          const providers = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
            SELECT "id" FROM public."providers"
            WHERE "tenantId" = ${context.tenantId}
              AND "organizationId" = ${context.orgId}
            FOR UPDATE
          `);
          const provider = providers[0];
          if (!provider) throw new NotFoundException({ code: 'PROVIDER_NOT_FOUND' });

          const existingRows = await tx.$queryRaw<BindingRow[]>(Prisma.sql`
            SELECT * FROM public."integration_bindings"
            WHERE "tenantId" = ${context.tenantId}
              AND "organizationId" = ${context.orgId}
              AND "providerId" = ${provider.id}
              AND "bindingKey" = ${command.bindingKey}
            FOR UPDATE
          `);
          const before = existingRows[0] ?? null;
          const expectedVersion = BigInt(command.expectedVersion);
          if (command.action === 'WITHDRAW' && !before) {
            throw new NotFoundException({ code: 'INTEGRATION_BINDING_NOT_FOUND' });
          }
          if (before ? before.version !== expectedVersion : expectedVersion !== 0n) {
            throw staleVersion(before?.version ?? '0');
          }

          const clock = await tx.$queryRaw<Array<{ now: Date }>>(Prisma.sql`
            SELECT clock_timestamp() AS now
          `);
          const committedAt = clock[0]?.now ?? new Date();
          const after = command.action === 'UPSERT'
            ? await this.upsert(tx, context, user.membershipId!, provider.id, before, command, committedAt)
            : await this.withdraw(tx, context, user.membershipId!, before!, committedAt);
          return this.appendAtomicEvidence(
            tx,
            context,
            user,
            command,
            requestFingerprint,
            before,
            after,
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
          this.findReplay(tx, context, command));
        if (replay) {
          assertIntegrationBindingReplay(replay.requestFingerprint, command);
          return { ...replay, replayed: true };
        }
      }
      if (databaseCode(error) === '40001' || databaseCode(error) === '40P01') {
        throw new ConflictException({
          code: 'INTEGRATION_BINDING_CONCURRENT_COMMAND',
          refreshRequired: true,
        });
      }
      throw error;
    }
  }

  private async upsert(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    membershipId: string,
    providerId: string,
    before: BindingRow | null,
    command: Extract<IntegrationBindingCommand, { action: 'UPSERT' }>,
    committedAt: Date,
  ): Promise<BindingRow> {
    const capabilities = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM public."provider_capabilities"
      WHERE "id" = ${command.providerCapabilityId}
        AND "providerId" = ${providerId}
        AND "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
        AND "status" IN ('PENDING_VERIFICATION', 'ACTIVE')
      LIMIT 1
    `);
    if (!capabilities[0]) {
      throw new UnprocessableEntityException({ code: 'PROVIDER_CAPABILITY_REQUIRED' });
    }
    if (
      before
      && (
        before.providerCapabilityId !== command.providerCapabilityId
        || before.capabilityCode !== command.capabilityCode
      )
    ) {
      throw new ConflictException({ code: 'INTEGRATION_BINDING_IDENTITY_IMMUTABLE' });
    }

    const rows = before
      ? await tx.$queryRaw<BindingRow[]>(Prisma.sql`
          UPDATE public."integration_bindings"
          SET "transportType" = ${command.transportType},
              "environment" = ${command.environment},
              "endpointReference" = ${command.endpointReference?.trim() ?? null},
              "credentialReference" = ${command.credentialReference?.trim() ?? null},
              "status" = 'PENDING_VERIFICATION',
              "version" = "version" + 1,
              "updatedByMembershipId" = ${membershipId},
              "updatedAt" = ${committedAt}
          WHERE "id" = ${before.id}
            AND "version" = ${before.version}
          RETURNING *
        `)
      : await tx.$queryRaw<BindingRow[]>(Prisma.sql`
          INSERT INTO public."integration_bindings" (
            "id", "tenantId", "organizationId", "providerId",
            "providerCapabilityId", "bindingKey", "capabilityCode",
            "transportType", "environment", "endpointReference",
            "credentialReference", "status", "version",
            "createdByMembershipId", "updatedByMembershipId", "createdAt", "updatedAt"
          ) VALUES (
            ${deterministicId('binding', `${providerId}:${command.bindingKey}`)},
            ${context.tenantId}, ${context.orgId}, ${providerId},
            ${command.providerCapabilityId}, ${command.bindingKey}, ${command.capabilityCode},
            ${command.transportType}, ${command.environment},
            ${command.endpointReference?.trim() ?? null},
            ${command.credentialReference?.trim() ?? null},
            'PENDING_VERIFICATION', 1, ${membershipId}, ${membershipId},
            ${committedAt}, ${committedAt}
          )
          RETURNING *
        `);
    if (!rows[0]) throw staleVersion(before?.version ?? '0');
    return rows[0];
  }

  private async withdraw(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    membershipId: string,
    before: BindingRow,
    committedAt: Date,
  ): Promise<BindingRow> {
    const rows = await tx.$queryRaw<BindingRow[]>(Prisma.sql`
      UPDATE public."integration_bindings"
      SET "status" = 'WITHDRAWN',
          "version" = "version" + 1,
          "updatedByMembershipId" = ${membershipId},
          "updatedAt" = ${committedAt}
      WHERE "id" = ${before.id}
        AND "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
        AND "version" = ${before.version}
      RETURNING *
    `);
    if (!rows[0]) throw staleVersion(before.version);
    return rows[0];
  }

  private async appendAtomicEvidence(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    user: RequestUser,
    command: IntegrationBindingCommand,
    requestFingerprint: string,
    before: BindingRow | null,
    after: BindingRow,
    committedAt: Date,
  ): Promise<IntegrationBindingCommandReceipt> {
    const identity = `${context.tenantId}:${context.orgId}:${command.commandId}`;
    const auditId = deterministicId('audit-binding', identity);
    const eventId = deterministicId('binding-event', identity);
    const outboxEntryId = deterministicId('outbox-binding', identity);
    const outboxKey = `integration-binding:${integrationBindingDigest({
      tenantId: context.tenantId,
      organizationId: context.orgId,
      idempotencyKey: command.idempotencyKey,
    })}`;
    const beforeState = before ? this.bindingSnapshot(before) : null;
    const afterState = this.bindingSnapshot(after);
    const receipt: IntegrationBindingCommandReceipt = {
      commandId: command.commandId,
      idempotencyKey: command.idempotencyKey,
      correlationId: command.correlationId,
      integrationBindingId: after.id,
      bindingKey: after.bindingKey,
      action: command.action,
      status: after.status,
      version: after.version.toString(),
      replayed: false,
      requestFingerprint,
      committedAt: committedAt.toISOString(),
      maturityAuthority: 'SERVER_HELD_EVIDENCE',
    };

    const previousAudit = await tx.auditEvent.findFirst({
      where: { objectType: 'INTEGRATION_BINDING', objectId: after.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { hash: true },
    });
    const auditMaterial = {
      id: auditId,
      action: `INTEGRATION_BINDING_${command.action}`,
      actorUserId: context.userId,
      actorRole: context.role,
      tenantId: context.tenantId,
      orgId: context.orgId,
      objectType: 'INTEGRATION_BINDING',
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
        objectType: 'INTEGRATION_BINDING',
        objectId: after.id,
        beforeState: stableIntegrationBindingJson(beforeState) as Prisma.InputJsonValue,
        afterState: stableIntegrationBindingJson(afterState) as Prisma.InputJsonValue,
        outcome: 'SUCCESS',
        reason: command.reason.trim(),
        metadata: {
          schema: 'integration-binding.audit.v1',
          commandId: command.commandId,
          idempotencyKey: command.idempotencyKey,
          membershipId: user.membershipId,
          sessionId: context.sessionId,
          requestFingerprint,
          credentialValueStored: false,
          maturityAuthority: 'SERVER_HELD_EVIDENCE',
        } as Prisma.InputJsonValue,
        correlationId: command.correlationId,
        runtimeIdempotencyKey: outboxKey,
        hash: integrationBindingDigest(auditMaterial),
        prevHash: previousAudit?.hash ?? null,
        createdAt: committedAt,
      },
    });

    const previousEvents = await tx.$queryRaw<Array<{ hash: string }>>(Prisma.sql`
      SELECT "hash" FROM public."integration_binding_events"
      WHERE "integrationBindingId" = ${after.id}
      ORDER BY "createdAt" DESC, "id" DESC
      LIMIT 1
    `);
    const eventMaterial = {
      id: eventId,
      tenantId: context.tenantId,
      organizationId: context.orgId,
      providerId: after.providerId,
      integrationBindingId: after.id,
      action: command.action,
      resultStatus: after.status,
      commandId: command.commandId,
      idempotencyKey: command.idempotencyKey,
      requestFingerprint,
      reason: command.reason.trim(),
      actorUserId: context.userId,
      actorRole: context.role,
      actorMembershipId: user.membershipId!,
      correlationId: command.correlationId,
      beforeState,
      afterState,
      prevHash: previousEvents[0]?.hash ?? null,
      auditEventId: auditId,
      outboxEntryId,
      aggregateVersion: after.version.toString(),
    };
    const eventHash = integrationBindingDigest(eventMaterial);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public."integration_binding_events" (
        "id", "tenantId", "organizationId", "providerId", "integrationBindingId",
        "action", "resultStatus", "commandId", "idempotencyKey",
        "requestFingerprint", "reason", "actorUserId", "actorRole",
        "actorMembershipId", "correlationId", "beforeState", "afterState",
        "prevHash", "hash", "auditEventId", "outboxEntryId",
        "aggregateVersion", "createdAt"
      ) VALUES (
        ${eventId}, ${context.tenantId}, ${context.orgId}, ${after.providerId}, ${after.id},
        ${command.action}, ${after.status}, ${command.commandId}, ${command.idempotencyKey},
        ${requestFingerprint}, ${command.reason.trim()}, ${context.userId}, ${context.role},
        ${user.membershipId!}, ${command.correlationId},
        ${JSON.stringify(stableIntegrationBindingJson(beforeState))}::jsonb,
        ${JSON.stringify(stableIntegrationBindingJson(afterState))}::jsonb,
        ${previousEvents[0]?.hash ?? null}, ${eventHash}, ${auditId}, ${outboxEntryId},
        ${after.version}, ${committedAt}
      )
    `);

    const integrationEvent = {
      type: 'integration.binding.changed.v1',
      aggregateType: 'IntegrationBinding',
      aggregateId: after.id,
      integrationBindingId: after.id,
      providerId: after.providerId,
      commandId: command.commandId,
      organizationId: context.orgId,
      tenantId: context.tenantId,
      action: command.action,
      status: after.status,
      aggregateVersion: after.version.toString(),
      correlationId: command.correlationId,
      auditId,
      occurredAt: committedAt.toISOString(),
      maturityAuthority: 'SERVER_HELD_EVIDENCE',
    };
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public."outbox_entries" (
        "id", "type", "payload", "status", "triggeredByUserId",
        "idempotencyKey", "correlationId", "auditId",
        "runtimeIdempotencyKey", "maxRetries", "nextRetryAt", "createdAt"
      ) VALUES (
        ${outboxEntryId}, ${integrationEvent.type},
        ${JSON.stringify({
          schema: 'integration-binding.command.v1',
          requestFingerprint,
          receipt,
          event: integrationEvent,
        })}::jsonb,
        'PENDING', ${context.userId}, ${outboxKey}, ${command.correlationId},
        ${auditId}, ${outboxKey}, 5, ${committedAt}, ${committedAt}
      )
    `);
    return receipt;
  }

  private async findReplay(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    command: IntegrationBindingCommand,
  ): Promise<IntegrationBindingCommandReceipt | null> {
    const rows = await tx.$queryRaw<ReplayRow[]>(Prisma.sql`
      SELECT
        "commandId", "idempotencyKey", "correlationId", "integrationBindingId",
        "action", "resultStatus", "aggregateVersion", "requestFingerprint", "createdAt"
      FROM public."integration_binding_events"
      WHERE "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
        AND "idempotencyKey" = ${command.idempotencyKey}
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) return null;
    return {
      commandId: row.commandId,
      idempotencyKey: row.idempotencyKey,
      correlationId: row.correlationId,
      integrationBindingId: row.integrationBindingId,
      bindingKey: command.bindingKey,
      action: row.action,
      status: row.resultStatus,
      version: row.aggregateVersion.toString(),
      replayed: false,
      requestFingerprint: row.requestFingerprint,
      committedAt: row.createdAt.toISOString(),
      maturityAuthority: 'SERVER_HELD_EVIDENCE',
    };
  }

  private bindingSnapshot(row: BindingRow) {
    return {
      id: row.id,
      providerId: row.providerId,
      providerCapabilityId: row.providerCapabilityId,
      bindingKey: row.bindingKey,
      capabilityCode: row.capabilityCode,
      transportType: row.transportType,
      environment: row.environment,
      endpointReferencePresent: row.endpointReference !== null,
      credentialReferencePresent: row.credentialReference !== null,
      status: row.status,
      version: row.version.toString(),
    };
  }

  private bindingView(row: BindingRow) {
    return {
      ...this.bindingSnapshot(row),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private evidenceFact(row: EvidenceRow): IntegrationCapabilityEvidenceFact {
    return {
      maturity: row.maturity as IntegrationCapabilityMaturity,
      evidenceReference: row.evidenceReference,
      evidenceIssuer: row.evidenceIssuer,
      externalReceiptId: row.externalReceiptId,
      checkedAt: row.checkedAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString() ?? null,
    };
  }

  private evidenceView(row: EvidenceRow) {
    return {
      id: row.id,
      ...this.evidenceFact(row),
      version: row.version.toString(),
      recordedByAuthority: row.recordedByAuthority,
    };
  }
}
