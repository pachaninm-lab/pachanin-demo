import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import { OrganizationCapabilityRepository } from '../../src/modules/organization-capabilities/organization-capability.repository';
import {
  ProviderRegistryValidationError,
  providerRegistryDigest,
} from '../../src/modules/service-providers/provider-registry.contract';
import { ProviderRegistryRepository } from '../../src/modules/service-providers/provider-registry.repository';
import { ServiceProvidersService } from '../../src/modules/service-providers/service-providers.service';

const ADMIN_URL = String(process.env.ONE_DEAL_ADMIN_URL ?? '');
const APP_URL = String(process.env.ONE_DEAL_APP_URL ?? '');
const RUN_ID = `provider-registry-${randomUUID()}`;
const TENANT_A = `${RUN_ID}-tenant-a`;
const TENANT_B = `${RUN_ID}-tenant-b`;
const ORG_A = `${RUN_ID}-org-a`;
const ORG_B = `${RUN_ID}-org-b`;
const USER_A = `${RUN_ID}-user-a`;
const USER_B = `${RUN_ID}-user-b`;
const USER_C = `${RUN_ID}-user-c`;
const MEMBERSHIP_A = `${RUN_ID}-membership-a`;
const MEMBERSHIP_B = `${RUN_ID}-membership-b`;
const MEMBERSHIP_C = `${RUN_ID}-membership-c`;

const actorA: RequestUser = {
  id: USER_A,
  email: `${USER_A}@industrial.test`,
  role: Role.ADMIN,
  orgId: ORG_A,
  tenantId: TENANT_A,
  membershipId: MEMBERSHIP_A,
  isOrgAdmin: true,
  sessionId: `${RUN_ID}-session-a`,
};

const actorB: RequestUser = {
  id: USER_B,
  email: `${USER_B}@industrial.test`,
  role: Role.ADMIN,
  orgId: ORG_B,
  tenantId: TENANT_B,
  membershipId: MEMBERSHIP_B,
  isOrgAdmin: true,
  sessionId: `${RUN_ID}-session-b`,
};

const forgedNonAdmin: RequestUser = {
  id: USER_C,
  email: `${USER_C}@industrial.test`,
  role: Role.LOGISTICIAN,
  orgId: ORG_A,
  tenantId: TENANT_A,
  membershipId: MEMBERSHIP_C,
  isOrgAdmin: true,
  sessionId: `${RUN_ID}-session-c`,
};

function reason(suffix: string): string {
  return `Provider registry acceptance command: ${suffix}`;
}

function capabilityCommand(
  expectedVersion: string,
  suffix: string,
  action: 'DECLARE' | 'REVOKE' = 'DECLARE',
) {
  return {
    entityType: 'PROVIDER_CAPABILITY',
    action,
    category: 'LOGISTICS',
    legalRole: 'carrier',
    commandId: `${RUN_ID}-command-${suffix}`,
    idempotencyKey: `${RUN_ID}-idempotency-${suffix}`,
    correlationId: `${RUN_ID}-correlation-${suffix}`,
    expectedVersion,
    reason: reason(suffix),
  } as const;
}

function offeringCommand(expectedVersion: string, suffix: string, offeringKey = suffix) {
  return {
    entityType: 'SERVICE_OFFERING',
    action: 'UPSERT',
    offeringKey,
    category: 'LOGISTICS',
    title: `Перевозка ${suffix}`,
    description: `Проверяемое предложение перевозки для сценария ${suffix}.`,
    regions: ['Тамбовская область'],
    cultures: ['Пшеница'],
    stages: ['DISPATCH'],
    commandId: `${RUN_ID}-command-${suffix}`,
    idempotencyKey: `${RUN_ID}-idempotency-${suffix}`,
    correlationId: `${RUN_ID}-correlation-${suffix}`,
    expectedVersion,
    reason: reason(suffix),
  } as const;
}

function organizationCapabilityCommand(actor: RequestUser, suffix: string) {
  return {
    commandId: `${RUN_ID}-org-cap-command-${suffix}`,
    idempotencyKey: `${RUN_ID}-org-cap-idempotency-${suffix}`,
    correlationId: `${RUN_ID}-org-cap-correlation-${suffix}`,
    capabilityCode: 'PROVIDE_LOGISTICS',
    action: 'DECLARE',
    expectedVersion: '0',
    reason: `Declare logistics organization capability for ${actor.orgId}`,
  } as const;
}

function deterministicId(prefix: string, material: string): string {
  return `${prefix}-${providerRegistryDigest(material).slice(0, 32)}`;
}

const describeProviderRegistryAuthority = ADMIN_URL && APP_URL ? describe : describe.skip;

describeProviderRegistryAuthority('Provider Registry PostgreSQL authority', () => {
  const admin = new PrismaService({ datasources: { db: { url: ADMIN_URL } } });
  const app = new PrismaService({ datasources: { db: { url: APP_URL } } });
  const rls = new RlsTransactionService(app);
  const organizationCapabilities = new OrganizationCapabilityRepository(rls);
  const repository = new ProviderRegistryRepository(rls);
  const service = new ServiceProvidersService(repository);

  beforeAll(async () => {
    if (!ADMIN_URL || !APP_URL) throw new Error('ONE_DEAL_ADMIN_URL and ONE_DEAL_APP_URL are required.');
    await Promise.all([admin.$connect(), app.$connect()]);
    await admin.organization.createMany({
      data: [
        { id: ORG_A, tenantId: TENANT_A, inn: `93${Date.now().toString().slice(-8)}`, name: 'Provider Registry A', status: 'ACTIVE' },
        { id: ORG_B, tenantId: TENANT_B, inn: `94${Date.now().toString().slice(-8)}`, name: 'Provider Registry B', status: 'ACTIVE' },
      ],
    });
    await admin.user.createMany({
      data: [
        { id: USER_A, email: actorA.email, passwordHash: 'industrial-not-a-login-secret', fullName: 'Provider Admin A' },
        { id: USER_B, email: actorB.email, passwordHash: 'industrial-not-a-login-secret', fullName: 'Provider Admin B' },
        { id: USER_C, email: forgedNonAdmin.email, passwordHash: 'industrial-not-a-login-secret', fullName: 'Provider Member C' },
      ],
    });
    await admin.userOrg.createMany({
      data: [
        { id: MEMBERSHIP_A, userId: USER_A, organizationId: ORG_A, role: Role.ADMIN, status: 'ACTIVE', isOrgAdmin: true },
        { id: MEMBERSHIP_B, userId: USER_B, organizationId: ORG_B, role: Role.ADMIN, status: 'ACTIVE', isOrgAdmin: true },
        { id: MEMBERSHIP_C, userId: USER_C, organizationId: ORG_A, role: Role.LOGISTICIAN, status: 'ACTIVE', isOrgAdmin: false },
      ],
    });
    await organizationCapabilities.execute(actorA, organizationCapabilityCommand(actorA, 'a'));
    await organizationCapabilities.execute(actorB, organizationCapabilityCommand(actorB, 'b'));
  });

  afterAll(async () => {
    if (ADMIN_URL) {
      await admin.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
        await tx.$executeRaw(Prisma.sql`
          DELETE FROM public."provider_registry_events"
          WHERE "tenantId" IN (${TENANT_A}, ${TENANT_B})
        `);
        await tx.$executeRaw(Prisma.sql`
          DELETE FROM public."provider_registry_evidence"
          WHERE "tenantId" IN (${TENANT_A}, ${TENANT_B})
        `);
        await tx.$executeRaw(Prisma.sql`
          DELETE FROM public."service_offerings"
          WHERE "tenantId" IN (${TENANT_A}, ${TENANT_B})
        `);
        await tx.$executeRaw(Prisma.sql`
          DELETE FROM public."provider_capabilities"
          WHERE "tenantId" IN (${TENANT_A}, ${TENANT_B})
        `);
        await tx.$executeRaw(Prisma.sql`
          DELETE FROM public."providers"
          WHERE "tenantId" IN (${TENANT_A}, ${TENANT_B})
        `);
        await tx.$executeRaw(Prisma.sql`
          DELETE FROM public."organization_capability_events"
          WHERE "tenantId" IN (${TENANT_A}, ${TENANT_B})
        `);
        await tx.$executeRaw(Prisma.sql`
          DELETE FROM public."organization_capability_assignments"
          WHERE "tenantId" IN (${TENANT_A}, ${TENANT_B})
        `);
      });
      await admin.outboxEntry.deleteMany({ where: { correlationId: { startsWith: RUN_ID } } });
      await admin.auditEvent.deleteMany({ where: { correlationId: { startsWith: RUN_ID } } });
      await admin.userOrg.deleteMany({ where: { id: { in: [MEMBERSHIP_A, MEMBERSHIP_B, MEMBERSHIP_C] } } });
      await admin.user.deleteMany({ where: { id: { in: [USER_A, USER_B, USER_C] } } });
      await admin.organization.deleteMany({ where: { id: { in: [ORG_A, ORG_B] } } });
    }
    await Promise.allSettled([admin.$disconnect(), app.$disconnect()]);
  });

  it('enforces FORCE RLS and keeps evidence read-only for the app principal', async () => {
    const authority = await app.$queryRaw<Array<{
      table_name: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>>(Prisma.sql`
      SELECT relname AS table_name, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE oid IN (
        'public.providers'::regclass,
        'public.provider_capabilities'::regclass,
        'public.service_offerings'::regclass,
        'public.provider_registry_evidence'::regclass,
        'public.provider_registry_events'::regclass
      )
      ORDER BY relname
    `);
    expect(authority).toHaveLength(5);
    expect(authority.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
    const grants = await app.$queryRaw<Array<{ mayInsertEvidence: boolean }>>(Prisma.sql`
      SELECT has_table_privilege(current_user, 'public.provider_registry_evidence', 'INSERT')
        AS "mayInsertEvidence"
    `);
    expect(grants[0]?.mayInsertEvidence).toBe(false);
  });

  it('creates only pending provider state and exposes no fictional catalog entries', async () => {
    const receipt = await repository.execute(actorA, capabilityCommand('0', 'declare'));
    expect(receipt).toMatchObject({ status: 'PENDING_VERIFICATION', version: '1' });
    await expect(repository.ownRegistry(actorA)).resolves.toMatchObject({
      provider: { status: 'PENDING_VERIFICATION', version: '1', name: 'Provider Registry A' },
      capabilities: [expect.objectContaining({
        category: 'LOGISTICS',
        status: 'PENDING_VERIFICATION',
      })],
      offerings: [],
      evidence: [],
      verificationMode: 'SERVER_HELD',
    });
    await expect(service.catalog(actorA)).resolves.toMatchObject({
      items: [],
      authority: 'POSTGRESQL',
    });
    await expect(service.summary(actorA)).resolves.toMatchObject({
      bankDefault: null,
      authority: 'POSTGRESQL',
    });
    await expect(rls.withTrustedContext(actorA, (tx, context) => tx.$executeRaw(Prisma.sql`
      UPDATE public."providers"
      SET "status" = 'ACTIVE',
          "version" = "version" + 1,
          "updatedByMembershipId" = ${MEMBERSHIP_A},
          "updatedAt" = clock_timestamp()
      WHERE "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
    `))).rejects.toThrow(/SELF_ACTIVATION_FORBIDDEN|row-level security|policy|42501/i);
    await expect(repository.ownRegistry(actorB)).resolves.toMatchObject({ provider: null });
    await expect(repository.ownRegistry({ ...actorA, tenantId: TENANT_B })).resolves.toMatchObject({
      provider: null,
    });
  });

  it('evaluates compliance only from empty server-held evidence and fails closed', async () => {
    const own = await repository.ownRegistry(actorA);
    const result = await service.compliance(actorA, own.provider!.id, {
      category: 'LOGISTICS',
      legalRole: 'carrier',
    });
    expect(result.evidenceAuthority).toBe('SERVER_REGISTRY');
    expect(result.decision.status).toBe('BLOCKED');
    expect(result.decision.blockingChecks.length).toBeGreaterThan(0);
  });

  it('requires durable organization administration even when request memory is forged', async () => {
    await expect(repository.execute(
      forgedNonAdmin,
      capabilityCommand('1', 'forged-admin'),
    )).rejects.toMatchObject({
      response: { code: 'ORGANIZATION_ADMIN_REQUIRED' },
    });
  });

  it('stores offerings as pending, replays exactly and rejects payload mismatch', async () => {
    const original = offeringCommand('1', 'offering-main', 'main-route');
    const first = await repository.execute(actorA, original);
    const replay = await repository.execute(actorA, original);
    expect(first).toMatchObject({ status: 'PENDING_VERIFICATION', version: '2', replayed: false });
    expect(replay).toMatchObject({
      commandId: first.commandId,
      version: first.version,
      committedAt: first.committedAt,
      replayed: true,
    });
    await expect(repository.execute(actorA, {
      ...original,
      description: 'Изменённое предложение перевозки с другим содержанием.',
    })).rejects.toBeInstanceOf(ProviderRegistryValidationError);
    await expect(service.catalog(actorA, 'LOGISTICS')).resolves.toMatchObject({ items: [] });
  });

  it('serializes concurrent aggregate commands into one commit and one stale version', async () => {
    const results = await Promise.allSettled([
      repository.execute(actorA, offeringCommand('2', 'race-a')),
      repository.execute(actorA, offeringCommand('2', 'race-b')),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictException);
    expect(JSON.stringify((rejected.reason as ConflictException).getResponse()))
      .toContain('PROVIDER_REGISTRY_STALE_VERSION');
  });

  it('rolls back provider, capability, audit and event when outbox insertion fails', async () => {
    const failing = capabilityCommand('0', 'atomic-failure');
    const identityMaterial = `${TENANT_B}:${ORG_B}:${failing.commandId}`;
    const conflictingOutboxId = deterministicId('outbox-provider', identityMaterial);
    await admin.outboxEntry.create({
      data: {
        id: conflictingOutboxId,
        type: 'industrial.atomicity.sentinel',
        payload: { runId: RUN_ID },
        status: 'PENDING',
        correlationId: failing.correlationId,
        nextRetryAt: new Date(),
      },
    });

    await expect(repository.execute(actorB, failing)).rejects.toBeDefined();
    const counts = await admin.$queryRaw<Array<{
      providers: bigint;
      capabilities: bigint;
      events: bigint;
    }>>(Prisma.sql`
      SELECT
        (SELECT count(*) FROM public."providers" WHERE "organizationId" = ${ORG_B})::bigint AS providers,
        (SELECT count(*) FROM public."provider_capabilities" WHERE "organizationId" = ${ORG_B})::bigint AS capabilities,
        (SELECT count(*) FROM public."provider_registry_events" WHERE "organizationId" = ${ORG_B})::bigint AS events
    `);
    expect(counts[0]).toEqual({ providers: 0n, capabilities: 0n, events: 0n });
    expect(await admin.auditEvent.count({ where: { correlationId: failing.correlationId } })).toBe(0);
    expect(await admin.outboxEntry.count({ where: { id: conflictingOutboxId } })).toBe(1);
  });
});
