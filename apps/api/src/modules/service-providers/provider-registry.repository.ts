import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ProviderComplianceContext,
  ProviderRegistryEvidence,
  RegistryEvidenceStatus,
  ServiceProviderCategory,
  ServiceProviderEntry,
  ServiceProviderStage,
} from '../../../../../packages/domain-core/src';
import {
  RlsTransactionService,
  type TrustedRlsContext,
} from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import {
  assertProviderRegistryReplay,
  normalizeProviderOffering,
  PROVIDER_CATEGORY_CAPABILITY,
  providerRegistryCommandFingerprint,
  providerRegistryDigest,
  stableProviderRegistryJson,
  type ProviderRegistryCommand,
  type ProviderRegistryCommandReceipt,
  type ServiceOfferingCommand,
  validateProviderRegistryCommand,
} from './provider-registry.contract';

type ProviderRow = {
  id: string;
  tenantId: string;
  organizationId: string;
  status: string;
  version: bigint;
  createdByMembershipId: string;
  updatedByMembershipId: string;
  createdAt: Date;
  updatedAt: Date;
};

type CapabilityRow = {
  id: string;
  tenantId: string;
  organizationId: string;
  providerId: string;
  category: ServiceProviderCategory;
  legalRole: string;
  status: string;
  version: bigint;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  createdByMembershipId: string;
  updatedByMembershipId: string;
  createdAt: Date;
  updatedAt: Date;
};

type OfferingRow = {
  id: string;
  tenantId: string;
  organizationId: string;
  providerId: string;
  capabilityId: string;
  offeringKey: string;
  category: ServiceProviderCategory;
  title: string;
  description: string;
  regions: string[];
  cultures: string[];
  stages: ServiceProviderStage[];
  status: string;
  version: bigint;
  createdByMembershipId: string;
  updatedByMembershipId: string;
  createdAt: Date;
  updatedAt: Date;
};

type EvidenceRow = {
  id: string;
  providerCapabilityId: string;
  checkCode: keyof ProviderRegistryEvidence;
  status: RegistryEvidenceStatus;
  source: string;
  evidenceReference: string;
  checkedAt: Date;
  expiresAt: Date | null;
  version: bigint;
};

type CatalogRow = {
  id: string;
  providerId: string;
  name: string;
  category: ServiceProviderCategory;
  regions: string[];
  cultures: string[];
  stages: ServiceProviderStage[];
  evidenceMaturity: 'VERIFIED' | 'MANUAL_REVIEW';
};

type ReplayRow = {
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  providerId: string;
  entityType: ProviderRegistryCommand['entityType'];
  entityId: string;
  category: ServiceProviderCategory;
  action: ProviderRegistryCommand['action'];
  resultStatus: string;
  aggregateVersion: bigint;
  requestFingerprint: string;
  createdAt: Date;
};

function deterministicId(prefix: string, material: string): string {
  return `${prefix}-${providerRegistryDigest(material).slice(0, 32)}`;
}

function staleVersion(currentVersion: bigint | string): ConflictException {
  return new ConflictException({
    code: 'PROVIDER_REGISTRY_STALE_VERSION',
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
export class ProviderRegistryRepository {
  constructor(private readonly rls: RlsTransactionService) {}

  async catalog(
    user: RequestUser,
    category?: ServiceProviderCategory,
  ): Promise<ServiceProviderEntry[]> {
    return this.rls.withTrustedContext(user, async (tx, context) => {
      const rows = await tx.$queryRaw<CatalogRow[]>(Prisma.sql`
        SELECT
          offering."id",
          provider."id" AS "providerId",
          organization."name",
          offering."category",
          offering."regions",
          offering."cultures",
          offering."stages",
          CASE
            WHEN evidence."evidenceCount" > 0
             AND evidence."nonLiveCount" = 0
            THEN 'VERIFIED'
            ELSE 'MANUAL_REVIEW'
          END AS "evidenceMaturity"
        FROM public."service_offerings" offering
        JOIN public."provider_capabilities" capability
          ON capability."id" = offering."capabilityId"
         AND capability."tenantId" = offering."tenantId"
         AND capability."organizationId" = offering."organizationId"
         AND capability."category" = offering."category"
        JOIN public."providers" provider
          ON provider."id" = offering."providerId"
         AND provider."tenantId" = offering."tenantId"
         AND provider."organizationId" = offering."organizationId"
        JOIN public."organizations" organization
          ON organization."id" = provider."organizationId"
         AND organization."tenantId" = provider."tenantId"
        LEFT JOIN LATERAL (
          SELECT
            count(*)::integer AS "evidenceCount",
            count(*) FILTER (
              WHERE registry_evidence."status" <> 'LIVE_OK'
                 OR (
                   registry_evidence."expiresAt" IS NOT NULL
                   AND registry_evidence."expiresAt" <= clock_timestamp()
                 )
            )::integer AS "nonLiveCount"
          FROM (
            SELECT DISTINCT ON (evidence_row."checkCode") evidence_row.*
            FROM public."provider_registry_evidence" evidence_row
            WHERE evidence_row."providerCapabilityId" = capability."id"
            ORDER BY evidence_row."checkCode", evidence_row."version" DESC
          ) registry_evidence
        ) evidence ON true
        WHERE offering."tenantId" = ${context.tenantId}
          AND provider."status" = 'ACTIVE'
          AND capability."status" = 'ACTIVE'
          AND offering."status" = 'ACTIVE'
          AND (${category ?? null}::text IS NULL OR offering."category" = ${category ?? null})
        ORDER BY organization."name" ASC, offering."id" ASC
      `);
      return rows.map((row) => ({
        id: row.id,
        providerId: row.providerId,
        name: row.name,
        category: row.category,
        region: row.regions[0],
        regions: row.regions,
        cultures: row.cultures,
        stages: row.stages,
        evidenceMaturity: row.evidenceMaturity,
      }));
    });
  }

  async ownRegistry(user: RequestUser) {
    return this.rls.withTrustedContext(user, async (tx, context) => {
      const providers = await tx.$queryRaw<Array<ProviderRow & { name: string }>>(Prisma.sql`
        SELECT provider.*, organization."name"
        FROM public."providers" provider
        JOIN public."organizations" organization
          ON organization."id" = provider."organizationId"
         AND organization."tenantId" = provider."tenantId"
        WHERE provider."tenantId" = ${context.tenantId}
          AND provider."organizationId" = ${context.orgId}
        LIMIT 1
      `);
      const provider = providers[0];
      if (!provider) {
        return {
          organizationId: context.orgId,
          tenantId: context.tenantId,
          provider: null,
          capabilities: [],
          offerings: [],
          evidence: [],
          verificationMode: 'SERVER_HELD' as const,
        };
      }
      const [capabilities, offerings, evidence] = await Promise.all([
        tx.$queryRaw<CapabilityRow[]>(Prisma.sql`
          SELECT * FROM public."provider_capabilities"
          WHERE "providerId" = ${provider.id}
            AND "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
          ORDER BY "category" ASC
        `),
        tx.$queryRaw<OfferingRow[]>(Prisma.sql`
          SELECT * FROM public."service_offerings"
          WHERE "providerId" = ${provider.id}
            AND "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
          ORDER BY "offeringKey" ASC
        `),
        tx.$queryRaw<EvidenceRow[]>(Prisma.sql`
          SELECT DISTINCT ON ("providerCapabilityId", "checkCode")
            "id", "providerCapabilityId", "checkCode", "status", "source",
            "evidenceReference", "checkedAt", "expiresAt", "version"
          FROM public."provider_registry_evidence"
          WHERE "providerId" = ${provider.id}
            AND "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
          ORDER BY "providerCapabilityId", "checkCode", "version" DESC
        `),
      ]);
      return {
        organizationId: context.orgId,
        tenantId: context.tenantId,
        provider: { ...this.provider(provider), name: provider.name },
        capabilities: capabilities.map((row) => this.capability(row)),
        offerings: offerings.map((row) => this.offering(row)),
        evidence: evidence.map((row) => this.evidence(row)),
        verificationMode: 'SERVER_HELD' as const,
      };
    });
  }

  async complianceEvidence(
    user: RequestUser,
    providerId: string,
    contextInput: ProviderComplianceContext,
  ): Promise<{ evidence: ProviderRegistryEvidence; legalRole: string }> {
    return this.rls.withTrustedContext(user, async (tx, context) => {
      const capabilities = await tx.$queryRaw<Array<{ id: string; legalRole: string }>>(Prisma.sql`
        SELECT capability."id", capability."legalRole"
        FROM public."provider_capabilities" capability
        JOIN public."providers" provider
          ON provider."id" = capability."providerId"
         AND provider."tenantId" = capability."tenantId"
         AND provider."organizationId" = capability."organizationId"
        WHERE capability."providerId" = ${providerId}
          AND capability."tenantId" = ${context.tenantId}
          AND capability."category" = ${contextInput.category}
          AND (
            capability."organizationId" = ${context.orgId}
            OR (provider."status" = 'ACTIVE' AND capability."status" = 'ACTIVE')
          )
        LIMIT 1
      `);
      const capability = capabilities[0];
      if (!capability) throw new NotFoundException({ code: 'PROVIDER_CAPABILITY_NOT_FOUND' });
      const rows = await tx.$queryRaw<EvidenceRow[]>(Prisma.sql`
        SELECT DISTINCT ON ("checkCode")
          "id", "providerCapabilityId", "checkCode", "status", "source",
          "evidenceReference", "checkedAt", "expiresAt", "version"
        FROM public."provider_registry_evidence"
        WHERE "providerCapabilityId" = ${capability.id}
          AND "tenantId" = ${context.tenantId}
        ORDER BY "checkCode", "version" DESC
      `);
      return {
        legalRole: capability.legalRole,
        evidence: Object.fromEntries(rows.map((row) => [row.checkCode, {
          status: row.expiresAt && row.expiresAt.getTime() <= Date.now() ? 'EXPIRED' : row.status,
          checkedAt: row.checkedAt.toISOString(),
          source: row.source,
          note: `evidence:${row.evidenceReference}`,
        }])) as ProviderRegistryEvidence,
      };
    });
  }

  async execute(
    user: RequestUser,
    command: ProviderRegistryCommand,
  ): Promise<ProviderRegistryCommandReceipt> {
    validateProviderRegistryCommand(command);
    if (!user.membershipId?.trim() || user.isOrgAdmin !== true) {
      throw new ForbiddenException({ code: 'ORGANIZATION_ADMIN_REQUIRED' });
    }
    const requestFingerprint = providerRegistryCommandFingerprint(command);
    try {
      return await this.rls.withTrustedContext(
        user,
        async (tx, context) => {
          await tx.$queryRaw(Prisma.sql`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${`${context.tenantId}:${context.orgId}:provider-registry`}, 0)
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
            assertProviderRegistryReplay(replay.requestFingerprint, command);
            return { ...replay, replayed: true };
          }

          const expectedVersion = BigInt(command.expectedVersion);
          let provider = await this.lockProvider(tx, context);
          if (!provider) {
            if (command.entityType !== 'PROVIDER_CAPABILITY' || command.action !== 'DECLARE') {
              throw new NotFoundException({ code: 'PROVIDER_NOT_FOUND' });
            }
            if (expectedVersion !== 0n) throw staleVersion('0');
            provider = await this.createProvider(tx, context, user.membershipId!);
          } else {
            if (provider.version !== expectedVersion) throw staleVersion(provider.version);
            provider = await this.advanceProvider(tx, context, user.membershipId!, provider);
          }

          const clock = await tx.$queryRaw<Array<{ now: Date }>>(Prisma.sql`
            SELECT clock_timestamp() AS now
          `);
          const committedAt = clock[0]?.now ?? new Date();
          const mutation = command.entityType === 'PROVIDER_CAPABILITY'
            ? await this.mutateCapability(tx, context, user.membershipId!, provider, command, committedAt)
            : await this.mutateOffering(tx, context, user.membershipId!, provider, command, committedAt);
          return this.appendAtomicEvidence(
            tx,
            context,
            user,
            command,
            requestFingerprint,
            provider,
            mutation.before,
            mutation.after,
            mutation.entityId,
            mutation.status,
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
          assertProviderRegistryReplay(replay.requestFingerprint, command);
          return { ...replay, replayed: true };
        }
      }
      if (databaseCode(error) === '40001' || databaseCode(error) === '40P01') {
        throw new ConflictException({
          code: 'PROVIDER_REGISTRY_CONCURRENT_COMMAND',
          refreshRequired: true,
        });
      }
      throw error;
    }
  }

  private async lockProvider(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
  ): Promise<ProviderRow | null> {
    const rows = await tx.$queryRaw<ProviderRow[]>(Prisma.sql`
      SELECT * FROM public."providers"
      WHERE "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
      FOR UPDATE
    `);
    return rows[0] ?? null;
  }

  private async createProvider(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    membershipId: string,
  ): Promise<ProviderRow> {
    const id = deterministicId('provider', `${context.tenantId}:${context.orgId}`);
    const rows = await tx.$queryRaw<ProviderRow[]>(Prisma.sql`
      INSERT INTO public."providers" (
        "id", "tenantId", "organizationId", "status", "version",
        "createdByMembershipId", "updatedByMembershipId"
      )
      SELECT
        ${id}, organization."tenantId", organization."id", 'PENDING_VERIFICATION', 1,
        ${membershipId}, ${membershipId}
      FROM public."organizations" organization
      WHERE organization."id" = ${context.orgId}
        AND organization."tenantId" = ${context.tenantId}
      RETURNING *
    `);
    if (!rows[0]) throw new NotFoundException({ code: 'ORGANIZATION_NOT_FOUND' });
    return rows[0];
  }

  private async advanceProvider(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    membershipId: string,
    provider: ProviderRow,
  ): Promise<ProviderRow> {
    const rows = await tx.$queryRaw<ProviderRow[]>(Prisma.sql`
      UPDATE public."providers"
      SET "version" = "version" + 1,
          "updatedByMembershipId" = ${membershipId},
          "updatedAt" = clock_timestamp()
      WHERE "id" = ${provider.id}
        AND "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
        AND "version" = ${provider.version}
      RETURNING *
    `);
    if (!rows[0]) throw staleVersion(provider.version);
    return rows[0];
  }

  private async mutateCapability(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    membershipId: string,
    provider: ProviderRow,
    command: Extract<ProviderRegistryCommand, { entityType: 'PROVIDER_CAPABILITY' }>,
    committedAt: Date,
  ) {
    const capabilityId = deterministicId('provider-cap', `${provider.id}:${command.category}`);
    const existingRows = await tx.$queryRaw<CapabilityRow[]>(Prisma.sql`
      SELECT * FROM public."provider_capabilities"
      WHERE "providerId" = ${provider.id}
        AND "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
        AND "category" = ${command.category}
      FOR UPDATE
    `);
    const before = existingRows[0] ?? null;
    if (command.action === 'REVOKE' && !before) {
      throw new NotFoundException({ code: 'PROVIDER_CAPABILITY_NOT_FOUND' });
    }
    if (command.action === 'DECLARE') {
      const organizationCapability = PROVIDER_CATEGORY_CAPABILITY[command.category];
      const prerequisites = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id"
        FROM public."organization_capability_assignments"
        WHERE "tenantId" = ${context.tenantId}
          AND "organizationId" = ${context.orgId}
          AND "capabilityCode" = ${organizationCapability}
          AND "status" IN ('ACTIVE', 'PENDING_VERIFICATION')
        LIMIT 1
      `);
      if (!prerequisites[0]) {
        throw new UnprocessableEntityException({
          code: 'ORGANIZATION_CAPABILITY_REQUIRED',
          capabilityCode: organizationCapability,
        });
      }
    }

    const rows = before
      ? await tx.$queryRaw<CapabilityRow[]>(Prisma.sql`
          UPDATE public."provider_capabilities"
          SET "legalRole" = ${command.legalRole},
              "status" = ${command.action === 'DECLARE' ? 'PENDING_VERIFICATION' : 'REVOKED'},
              "effectiveFrom" = NULL,
              "effectiveTo" = ${command.action === 'REVOKE' ? committedAt : null},
              "version" = "version" + 1,
              "updatedByMembershipId" = ${membershipId},
              "updatedAt" = ${committedAt}
          WHERE "id" = ${before.id}
            AND "version" = ${before.version}
          RETURNING *
        `)
      : await tx.$queryRaw<CapabilityRow[]>(Prisma.sql`
          INSERT INTO public."provider_capabilities" (
            "id", "tenantId", "organizationId", "providerId", "category",
            "legalRole", "status", "version", "effectiveFrom", "effectiveTo",
            "createdByMembershipId", "updatedByMembershipId", "createdAt", "updatedAt"
          ) VALUES (
            ${capabilityId}, ${context.tenantId}, ${context.orgId}, ${provider.id}, ${command.category},
            ${command.legalRole}, 'PENDING_VERIFICATION', 1, NULL, NULL,
            ${membershipId}, ${membershipId}, ${committedAt}, ${committedAt}
          )
          RETURNING *
        `);
    const after = rows[0]!;
    if (command.action === 'REVOKE') {
      await tx.$executeRaw(Prisma.sql`
        UPDATE public."service_offerings"
        SET "status" = 'WITHDRAWN',
            "version" = "version" + 1,
            "updatedByMembershipId" = ${membershipId},
            "updatedAt" = ${committedAt}
        WHERE "providerId" = ${provider.id}
          AND "tenantId" = ${context.tenantId}
          AND "organizationId" = ${context.orgId}
          AND "category" = ${command.category}
          AND "status" <> 'WITHDRAWN'
      `);
    }
    return {
      before: before ? this.capability(before) : null,
      after: this.capability(after),
      entityId: after.id,
      status: after.status,
    };
  }

  private async mutateOffering(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    membershipId: string,
    provider: ProviderRow,
    command: ServiceOfferingCommand,
    committedAt: Date,
  ) {
    const capabilities = await tx.$queryRaw<CapabilityRow[]>(Prisma.sql`
      SELECT * FROM public."provider_capabilities"
      WHERE "providerId" = ${provider.id}
        AND "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
        AND "category" = ${command.category}
        AND "status" IN ('PENDING_VERIFICATION', 'ACTIVE')
      LIMIT 1
    `);
    const capability = capabilities[0];
    if (!capability) throw new UnprocessableEntityException({ code: 'PROVIDER_CAPABILITY_REQUIRED' });
    const existingRows = await tx.$queryRaw<OfferingRow[]>(Prisma.sql`
      SELECT * FROM public."service_offerings"
      WHERE "providerId" = ${provider.id}
        AND "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
        AND "offeringKey" = ${command.offeringKey}
      FOR UPDATE
    `);
    const before = existingRows[0] ?? null;
    if (before && before.category !== command.category) {
      throw new ConflictException({ code: 'OFFERING_CATEGORY_IMMUTABLE' });
    }
    if (command.action === 'WITHDRAW' && !before) {
      throw new NotFoundException({ code: 'SERVICE_OFFERING_NOT_FOUND' });
    }
    const normalized = normalizeProviderOffering(command);
    const offeringId = deterministicId('offering', `${provider.id}:${command.offeringKey}`);
    const rows = before
      ? await tx.$queryRaw<OfferingRow[]>(Prisma.sql`
          UPDATE public."service_offerings"
          SET "title" = ${command.action === 'UPSERT' ? normalized.title! : before.title},
              "description" = ${command.action === 'UPSERT' ? normalized.description! : before.description},
              "regions" = ${command.action === 'UPSERT' ? normalized.regions : before.regions}::text[],
              "cultures" = ${command.action === 'UPSERT' ? normalized.cultures : before.cultures}::text[],
              "stages" = ${command.action === 'UPSERT' ? normalized.stages : before.stages}::text[],
              "status" = ${command.action === 'UPSERT' ? 'PENDING_VERIFICATION' : 'WITHDRAWN'},
              "version" = "version" + 1,
              "updatedByMembershipId" = ${membershipId},
              "updatedAt" = ${committedAt}
          WHERE "id" = ${before.id}
            AND "version" = ${before.version}
          RETURNING *
        `)
      : await tx.$queryRaw<OfferingRow[]>(Prisma.sql`
          INSERT INTO public."service_offerings" (
            "id", "tenantId", "organizationId", "providerId", "capabilityId",
            "offeringKey", "category", "title", "description", "regions",
            "cultures", "stages", "status", "version", "createdByMembershipId",
            "updatedByMembershipId", "createdAt", "updatedAt"
          ) VALUES (
            ${offeringId}, ${context.tenantId}, ${context.orgId}, ${provider.id}, ${capability.id},
            ${command.offeringKey}, ${command.category}, ${normalized.title!}, ${normalized.description!},
            ${normalized.regions}::text[], ${normalized.cultures}::text[], ${normalized.stages}::text[],
            'PENDING_VERIFICATION', 1, ${membershipId}, ${membershipId}, ${committedAt}, ${committedAt}
          )
          RETURNING *
        `);
    const after = rows[0]!;
    return {
      before: before ? this.offering(before) : null,
      after: this.offering(after),
      entityId: after.id,
      status: after.status,
    };
  }

  private async appendAtomicEvidence(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    user: RequestUser,
    command: ProviderRegistryCommand,
    requestFingerprint: string,
    provider: ProviderRow,
    beforeState: unknown,
    afterState: unknown,
    entityId: string,
    status: string,
    committedAt: Date,
  ): Promise<ProviderRegistryCommandReceipt> {
    const identityMaterial = `${context.tenantId}:${context.orgId}:${command.commandId}`;
    const auditId = deterministicId('audit-provider', identityMaterial);
    const eventId = deterministicId('provider-event', identityMaterial);
    const outboxEntryId = deterministicId('outbox-provider', identityMaterial);
    const outboxKey = `provider-registry:${providerRegistryDigest({
      tenantId: context.tenantId,
      organizationId: context.orgId,
      idempotencyKey: command.idempotencyKey,
    })}`;
    const receipt: ProviderRegistryCommandReceipt = {
      commandId: command.commandId,
      idempotencyKey: command.idempotencyKey,
      correlationId: command.correlationId,
      providerId: provider.id,
      entityType: command.entityType,
      entityId,
      category: command.category,
      action: command.action,
      status,
      version: provider.version.toString(),
      replayed: false,
      requestFingerprint,
      committedAt: committedAt.toISOString(),
      verificationMode: 'SERVER_HELD',
    };
    const previousAudit = await tx.auditEvent.findFirst({
      where: { objectType: command.entityType, objectId: entityId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { hash: true },
    });
    const auditMaterial = {
      id: auditId,
      action: `PROVIDER_REGISTRY_${command.action}`,
      actorUserId: context.userId,
      actorRole: context.role,
      tenantId: context.tenantId,
      orgId: context.orgId,
      objectType: command.entityType,
      objectId: entityId,
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
        objectType: command.entityType,
        objectId: entityId,
        beforeState: stableProviderRegistryJson(beforeState) as Prisma.InputJsonValue,
        afterState: stableProviderRegistryJson(afterState) as Prisma.InputJsonValue,
        outcome: 'SUCCESS',
        reason: command.reason.trim(),
        metadata: {
          schema: 'provider-registry.audit.v1',
          commandId: command.commandId,
          idempotencyKey: command.idempotencyKey,
          membershipId: user.membershipId,
          sessionId: context.sessionId,
          requestFingerprint,
          verificationMode: 'SERVER_HELD',
        } as Prisma.InputJsonValue,
        correlationId: command.correlationId,
        runtimeIdempotencyKey: outboxKey,
        hash: providerRegistryDigest(auditMaterial),
        prevHash: previousAudit?.hash ?? null,
        createdAt: committedAt,
      },
    });

    const previousEvents = await tx.$queryRaw<Array<{ hash: string }>>(Prisma.sql`
      SELECT "hash" FROM public."provider_registry_events"
      WHERE "providerId" = ${provider.id}
      ORDER BY "createdAt" DESC, "id" DESC
      LIMIT 1
    `);
    const eventMaterial = {
      id: eventId,
      tenantId: context.tenantId,
      organizationId: context.orgId,
      providerId: provider.id,
      entityType: command.entityType,
      entityId,
      category: command.category,
      action: command.action,
      resultStatus: status,
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
      aggregateVersion: provider.version.toString(),
    };
    const eventHash = providerRegistryDigest(eventMaterial);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public."provider_registry_events" (
        "id", "tenantId", "organizationId", "providerId", "entityType",
        "entityId", "category", "action", "resultStatus", "commandId",
        "idempotencyKey", "requestFingerprint", "reason", "actorUserId",
        "actorRole", "actorMembershipId", "correlationId", "beforeState",
        "afterState", "prevHash", "hash", "auditEventId", "outboxEntryId",
        "aggregateVersion", "createdAt"
      ) VALUES (
        ${eventId}, ${context.tenantId}, ${context.orgId}, ${provider.id}, ${command.entityType},
        ${entityId}, ${command.category}, ${command.action}, ${status}, ${command.commandId},
        ${command.idempotencyKey}, ${requestFingerprint}, ${command.reason.trim()}, ${context.userId},
        ${context.role}, ${user.membershipId!}, ${command.correlationId},
        ${JSON.stringify(stableProviderRegistryJson(beforeState))}::jsonb,
        ${JSON.stringify(stableProviderRegistryJson(afterState))}::jsonb,
        ${previousEvents[0]?.hash ?? null}, ${eventHash}, ${auditId}, ${outboxEntryId},
        ${provider.version}, ${committedAt}
      )
    `);

    const integrationEvent = {
      type: 'provider.registry.changed.v1',
      aggregateType: 'Provider',
      aggregateId: provider.id,
      providerId: provider.id,
      commandId: command.commandId,
      organizationId: context.orgId,
      tenantId: context.tenantId,
      entityType: command.entityType,
      entityId,
      category: command.category,
      action: command.action,
      status,
      aggregateVersion: provider.version.toString(),
      correlationId: command.correlationId,
      auditId,
      occurredAt: committedAt.toISOString(),
      verificationMode: 'SERVER_HELD',
    };
    const outboxPayload = {
      schema: 'provider-registry.command.v1',
      requestFingerprint,
      receipt,
      event: integrationEvent,
    };
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public."outbox_entries" (
        "id", "type", "payload", "status", "triggeredByUserId",
        "idempotencyKey", "correlationId", "auditId",
        "runtimeIdempotencyKey", "maxRetries", "nextRetryAt", "createdAt"
      ) VALUES (
        ${outboxEntryId}, ${integrationEvent.type}, ${JSON.stringify(outboxPayload)}::jsonb,
        'PENDING', ${context.userId}, ${outboxKey}, ${command.correlationId},
        ${auditId}, ${outboxKey}, 5, ${committedAt}, ${committedAt}
      )
    `);
    return receipt;
  }

  private async findReplay(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    command: ProviderRegistryCommand,
  ): Promise<ProviderRegistryCommandReceipt | null> {
    const rows = await tx.$queryRaw<ReplayRow[]>(Prisma.sql`
      SELECT
        "commandId", "idempotencyKey", "correlationId", "providerId",
        "entityType", "entityId", "category", "action", "resultStatus",
        "aggregateVersion", "requestFingerprint", "createdAt"
      FROM public."provider_registry_events"
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
      providerId: row.providerId,
      entityType: row.entityType,
      entityId: row.entityId,
      category: row.category,
      action: row.action,
      status: row.resultStatus,
      version: row.aggregateVersion.toString(),
      replayed: false,
      requestFingerprint: row.requestFingerprint,
      committedAt: row.createdAt.toISOString(),
      verificationMode: 'SERVER_HELD',
    };
  }

  private provider(row: ProviderRow) {
    return {
      id: row.id,
      status: row.status,
      version: row.version.toString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private capability(row: CapabilityRow) {
    return {
      id: row.id,
      category: row.category,
      legalRole: row.legalRole,
      status: row.status,
      version: row.version.toString(),
      effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
      effectiveTo: row.effectiveTo?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private offering(row: OfferingRow) {
    return {
      id: row.id,
      offeringKey: row.offeringKey,
      category: row.category,
      title: row.title,
      description: row.description,
      regions: row.regions,
      cultures: row.cultures,
      stages: row.stages,
      status: row.status,
      version: row.version.toString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private evidence(row: EvidenceRow) {
    return {
      id: row.id,
      providerCapabilityId: row.providerCapabilityId,
      checkCode: row.checkCode,
      status: row.expiresAt && row.expiresAt.getTime() <= Date.now() ? 'EXPIRED' : row.status,
      source: row.source,
      evidenceReference: row.evidenceReference,
      checkedAt: row.checkedAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString() ?? null,
      version: row.version.toString(),
    };
  }
}
