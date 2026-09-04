import { ConflictException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import { OrganizationCapabilityCommandValidationError } from '../../src/modules/organization-capabilities/organization-capability-command.contract';
import { OrganizationCapabilityRepository } from '../../src/modules/organization-capabilities/organization-capability.repository';

const ADMIN_URL = String(process.env.ONE_DEAL_ADMIN_URL ?? '');
const RUN_ID = `org-capability-${randomUUID()}`;
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
  role: Role.FARMER,
  orgId: ORG_A,
  tenantId: TENANT_A,
  membershipId: MEMBERSHIP_C,
  // Deliberately forged in application memory. PostgreSQL must reject it from
  // the durable membership row even if a caller reaches the repository.
  isOrgAdmin: true,
  sessionId: `${RUN_ID}-session-c`,
};

function reason(suffix: string): string {
  return `Acceptance command for organization capability: ${suffix}`;
}

function command(
  capabilityCode: 'SELL_CROP' | 'BUY_CROP' | 'OWN_TRANSPORT' | 'PROVIDE_FINANCING' | 'API_INTEGRATION',
  expectedVersion: string,
  suffix: string,
  action: 'DECLARE' | 'REVOKE' = 'DECLARE',
) {
  return {
    commandId: `${RUN_ID}-command-${suffix}`,
    idempotencyKey: `${RUN_ID}-idempotency-${suffix}`,
    correlationId: `${RUN_ID}-correlation-${suffix}`,
    capabilityCode,
    action,
    expectedVersion,
    reason: reason(suffix),
  } as const;
}

function deterministicId(prefix: string, material: string): string {
  const digest = createHash('sha256').update(JSON.stringify(material)).digest('hex');
  return `${prefix}-${digest.slice(0, 32)}`;
}

describe('Organization Capability PostgreSQL authority', () => {
  const admin = new PrismaService({ datasources: { db: { url: ADMIN_URL } } });
  const app = new PrismaService();
  const repository = new OrganizationCapabilityRepository(new RlsTransactionService(app));

  beforeAll(async () => {
    if (!ADMIN_URL) throw new Error('ONE_DEAL_ADMIN_URL is required.');
    await Promise.all([admin.$connect(), app.$connect()]);
    await admin.organization.createMany({
      data: [
        { id: ORG_A, tenantId: TENANT_A, inn: `91${Date.now().toString().slice(-8)}`, name: 'Org Capability A', status: 'ACTIVE' },
        { id: ORG_B, tenantId: TENANT_B, inn: `92${Date.now().toString().slice(-8)}`, name: 'Org Capability B', status: 'ACTIVE' },
      ],
    });
    await admin.user.createMany({
      data: [
        { id: USER_A, email: actorA.email, passwordHash: 'industrial-not-a-login-secret', fullName: 'Capability Admin A' },
        { id: USER_B, email: actorB.email, passwordHash: 'industrial-not-a-login-secret', fullName: 'Capability Admin B' },
        { id: USER_C, email: forgedNonAdmin.email, passwordHash: 'industrial-not-a-login-secret', fullName: 'Capability Member C' },
      ],
    });
    await admin.userOrg.createMany({
      data: [
        { id: MEMBERSHIP_A, userId: USER_A, organizationId: ORG_A, role: Role.ADMIN, status: 'ACTIVE', isOrgAdmin: true },
        { id: MEMBERSHIP_B, userId: USER_B, organizationId: ORG_B, role: Role.ADMIN, status: 'ACTIVE', isOrgAdmin: true },
        { id: MEMBERSHIP_C, userId: USER_C, organizationId: ORG_A, role: Role.FARMER, status: 'ACTIVE', isOrgAdmin: false },
      ],
    });
  });

  afterAll(async () => {
    if (ADMIN_URL) {
      await admin.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
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

  it('enforces FORCE RLS and denies cross-tenant visibility', async () => {
    const authority = await app.$queryRaw<Array<{
      table_name: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>>(Prisma.sql`
      SELECT relname AS table_name, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE oid IN (
        'public.organization_capability_assignments'::regclass,
        'public.organization_capability_events'::regclass
      )
      ORDER BY relname
    `);
    expect(authority).toHaveLength(2);
    expect(authority).toEqual(expect.arrayContaining([
      expect.objectContaining({ relrowsecurity: true, relforcerowsecurity: true }),
    ]));

    await repository.execute(actorA, command('SELL_CROP', '0', 'rls-a'));
    await expect(repository.list(actorA)).resolves.toMatchObject({
      organizationId: ORG_A,
      effectiveCapabilityCodes: ['SELL_CROP'],
    });
    await expect(repository.list(actorB)).resolves.toMatchObject({
      organizationId: ORG_B,
      assignments: [],
      effectiveCapabilityCodes: [],
    });
    await expect(repository.list({ ...actorA, tenantId: TENANT_B })).resolves.toMatchObject({
      assignments: [],
      effectiveCapabilityCodes: [],
    });
  });

  it('keeps regulated and integration declarations pending verification', async () => {
    const regulated = await repository.execute(actorA, command('PROVIDE_FINANCING', '0', 'regulated'));
    const integration = await repository.execute(actorA, command('API_INTEGRATION', '0', 'integration'));
    expect(regulated.status).toBe('PENDING_VERIFICATION');
    expect(integration.status).toBe('PENDING_VERIFICATION');
    const snapshot = await repository.list(actorA);
    expect(snapshot.effectiveCapabilityCodes).not.toContain('PROVIDE_FINANCING');
    expect(snapshot.effectiveCapabilityCodes).not.toContain('API_INTEGRATION');
  });

  it('requires durable organization administration even when request memory is forged', async () => {
    await expect(repository.execute(
      forgedNonAdmin,
      command('BUY_CROP', '0', 'forged-admin'),
    )).rejects.toThrow(/row-level security|policy|42501/i);
  });

  it('returns exact replay and rejects a payload mismatch', async () => {
    const original = command('BUY_CROP', '0', 'replay');
    const first = await repository.execute(actorA, original);
    const replay = await repository.execute(actorA, original);
    expect(first.replayed).toBe(false);
    expect(replay).toMatchObject({
      commandId: first.commandId,
      version: first.version,
      committedAt: first.committedAt,
      replayed: true,
    });
    await expect(repository.execute(actorA, {
      ...original,
      reason: reason('changed-payload'),
    })).rejects.toBeInstanceOf(OrganizationCapabilityCommandValidationError);
  });

  it('serializes concurrent CAS commands into one commit and one stale version', async () => {
    await repository.execute(actorA, command('OWN_TRANSPORT', '0', 'race-seed'));
    const results = await Promise.allSettled([
      repository.execute(actorA, command('OWN_TRANSPORT', '1', 'race-a', 'REVOKE')),
      repository.execute(actorA, command('OWN_TRANSPORT', '1', 'race-b', 'REVOKE')),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictException);
    expect(JSON.stringify((rejected.reason as ConflictException).getResponse()))
      .toContain('ORGANIZATION_CAPABILITY_STALE_VERSION');
  });

  it('rolls back assignment, audit and event when the outbox insert fails', async () => {
    const failing = command('SELL_CROP', '0', 'atomic-failure');
    const identityMaterial = `${TENANT_B}:${ORG_B}:${failing.commandId}`;
    const conflictingOutboxId = deterministicId('outbox-ocap', identityMaterial);
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
    const assignmentCount = await admin.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint AS count
      FROM public."organization_capability_assignments"
      WHERE "tenantId" = ${TENANT_B}
        AND "organizationId" = ${ORG_B}
        AND "capabilityCode" = 'SELL_CROP'
    `);
    const eventCount = await admin.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint AS count
      FROM public."organization_capability_events"
      WHERE "tenantId" = ${TENANT_B}
        AND "organizationId" = ${ORG_B}
        AND "commandId" = ${failing.commandId}
    `);
    expect(assignmentCount[0]?.count).toBe(0n);
    expect(eventCount[0]?.count).toBe(0n);
    expect(await admin.auditEvent.count({
      where: { correlationId: failing.correlationId },
    })).toBe(0);
    expect(await admin.outboxEntry.count({ where: { id: conflictingOutboxId } })).toBe(1);
  });
});
