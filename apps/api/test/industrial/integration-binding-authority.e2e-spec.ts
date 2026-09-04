import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import { OrganizationCapabilityRepository } from '../../src/modules/organization-capabilities/organization-capability.repository';
import {
  IntegrationBindingValidationError,
  integrationBindingDigest,
  type IntegrationBindingCommand,
} from '../../src/modules/service-providers/integration-binding.contract';
import { IntegrationBindingRepository } from '../../src/modules/service-providers/integration-binding.repository';
import { ProviderRegistryRepository } from '../../src/modules/service-providers/provider-registry.repository';

const ADMIN_URL = String(process.env.ONE_DEAL_ADMIN_URL ?? '');
const APP_URL = String(process.env.ONE_DEAL_APP_URL ?? '');
const RUN_ID = `integration-binding-${randomUUID()}`;
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

function orgCapabilityCommand() {
  return {
    commandId: `${RUN_ID}-org-cap-command`,
    idempotencyKey: `${RUN_ID}-org-cap-idempotency`,
    correlationId: `${RUN_ID}-org-cap-correlation`,
    capabilityCode: 'PROVIDE_LOGISTICS',
    action: 'DECLARE',
    expectedVersion: '0',
    reason: 'Declare logistics capability for integration binding acceptance.',
  } as const;
}

function providerCapabilityCommand() {
  return {
    entityType: 'PROVIDER_CAPABILITY',
    action: 'DECLARE',
    category: 'LOGISTICS',
    legalRole: 'carrier',
    commandId: `${RUN_ID}-provider-command`,
    idempotencyKey: `${RUN_ID}-provider-idempotency`,
    correlationId: `${RUN_ID}-provider-correlation`,
    expectedVersion: '0',
    reason: 'Declare provider capability for integration binding acceptance.',
  } as const;
}

function bindingCommand(
  providerCapabilityId: string,
  expectedVersion: string,
  suffix: string,
  bindingKey = 'dispatch-primary',
): Extract<IntegrationBindingCommand, { action: 'UPSERT' }> {
  return {
    action: 'UPSERT',
    bindingKey,
    providerCapabilityId,
    capabilityCode: 'LOGISTICS_DISPATCH',
    transportType: 'MANUAL',
    environment: 'CONTROLLED_PILOT',
    endpointReference: 'endpoint:dispatch:operator-desk',
    credentialReference: 'secret:dispatch:operator-desk',
    commandId: `${RUN_ID}-binding-command-${suffix}`,
    idempotencyKey: `${RUN_ID}-binding-idempotency-${suffix}`,
    correlationId: `${RUN_ID}-binding-correlation-${suffix}`,
    expectedVersion,
    reason: `Declare provider-neutral integration binding for ${suffix}.`,
  };
}

function deterministicId(prefix: string, material: string): string {
  return `${prefix}-${integrationBindingDigest(material).slice(0, 32)}`;
}

const describeAuthority = ADMIN_URL && APP_URL ? describe : describe.skip;

describeAuthority('IntegrationBinding PostgreSQL authority', () => {
  const admin = new PrismaService({ datasources: { db: { url: ADMIN_URL } } });
  const app = new PrismaService({ datasources: { db: { url: APP_URL } } });
  const rls = new RlsTransactionService(app);
  const organizationCapabilities = new OrganizationCapabilityRepository(rls);
  const providers = new ProviderRegistryRepository(rls);
  const bindings = new IntegrationBindingRepository(rls);
  let providerCapabilityId = '';
  let bindingId = '';

  beforeAll(async () => {
    await Promise.all([admin.$connect(), app.$connect()]);
    await admin.organization.createMany({
      data: [
        { id: ORG_A, tenantId: TENANT_A, inn: `95${Date.now().toString().slice(-8)}`, name: 'Binding A', status: 'ACTIVE' },
        { id: ORG_B, tenantId: TENANT_B, inn: `96${Date.now().toString().slice(-8)}`, name: 'Binding B', status: 'ACTIVE' },
      ],
    });
    await admin.user.createMany({
      data: [
        { id: USER_A, email: actorA.email, passwordHash: 'industrial-not-a-login-secret', fullName: 'Binding Admin A' },
        { id: USER_B, email: actorB.email, passwordHash: 'industrial-not-a-login-secret', fullName: 'Binding Admin B' },
        { id: USER_C, email: forgedNonAdmin.email, passwordHash: 'industrial-not-a-login-secret', fullName: 'Binding Member C' },
      ],
    });
    await admin.userOrg.createMany({
      data: [
        { id: MEMBERSHIP_A, userId: USER_A, organizationId: ORG_A, role: Role.ADMIN, status: 'ACTIVE', isOrgAdmin: true },
        { id: MEMBERSHIP_B, userId: USER_B, organizationId: ORG_B, role: Role.ADMIN, status: 'ACTIVE', isOrgAdmin: true },
        { id: MEMBERSHIP_C, userId: USER_C, organizationId: ORG_A, role: Role.LOGISTICIAN, status: 'ACTIVE', isOrgAdmin: false },
      ],
    });
    await organizationCapabilities.execute(actorA, orgCapabilityCommand());
    providerCapabilityId = (await providers.execute(actorA, providerCapabilityCommand())).entityId;
  });

  afterAll(async () => {
    if (ADMIN_URL) {
      await admin.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
        for (const table of [
          'integration_binding_events',
          'integration_capability_evidence',
          'integration_bindings',
          'provider_registry_events',
          'provider_registry_evidence',
          'service_offerings',
          'provider_capabilities',
          'providers',
          'organization_capability_events',
          'organization_capability_assignments',
        ]) {
          await tx.$executeRawUnsafe(
            `DELETE FROM public."${table}" WHERE "tenantId" IN ('${TENANT_A}', '${TENANT_B}')`,
          );
        }
      });
      await admin.outboxEntry.deleteMany({ where: { correlationId: { startsWith: RUN_ID } } });
      await admin.auditEvent.deleteMany({ where: { correlationId: { startsWith: RUN_ID } } });
      await admin.userOrg.deleteMany({ where: { id: { in: [MEMBERSHIP_A, MEMBERSHIP_B, MEMBERSHIP_C] } } });
      await admin.user.deleteMany({ where: { id: { in: [USER_A, USER_B, USER_C] } } });
      await admin.organization.deleteMany({ where: { id: { in: [ORG_A, ORG_B] } } });
    }
    await Promise.allSettled([admin.$disconnect(), app.$disconnect()]);
  });

  it('forces RLS and grants the app principal SELECT-only evidence access', async () => {
    const authority = await app.$queryRaw<Array<{
      table_name: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>>(Prisma.sql`
      SELECT relname AS table_name, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE oid IN (
        'public.integration_bindings'::regclass,
        'public.integration_capability_evidence'::regclass,
        'public.integration_binding_events'::regclass
      )
      ORDER BY relname
    `);
    expect(authority).toHaveLength(3);
    expect(authority.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
    const grants = await app.$queryRaw<Array<{ mayInsertEvidence: boolean }>>(Prisma.sql`
      SELECT has_table_privilege(current_user, 'public.integration_capability_evidence', 'INSERT')
        AS "mayInsertEvidence"
    `);
    expect(grants[0]?.mayInsertEvidence).toBe(false);
  });

  it('creates a pending binding, redacts references and isolates tenant/org reads', async () => {
    const receipt = await bindings.execute(actorA, bindingCommand(providerCapabilityId, '0', 'initial'));
    bindingId = receipt.integrationBindingId;
    expect(receipt).toMatchObject({
      status: 'PENDING_VERIFICATION',
      version: '1',
      replayed: false,
      maturityAuthority: 'SERVER_HELD_EVIDENCE',
    });
    const own = await bindings.listOwn(actorA);
    expect(own).toMatchObject({
      authority: 'POSTGRESQL',
      maturityAuthority: 'SERVER_HELD_EVIDENCE',
      items: [expect.objectContaining({
        id: bindingId,
        transportType: 'MANUAL',
        endpointReferencePresent: true,
        credentialReferencePresent: true,
        assessment: expect.objectContaining({
          maturity: 'DISCOVERED',
          mayCarryRealTraffic: false,
        }),
      })],
    });
    expect(JSON.stringify(own)).not.toContain('secret:dispatch:operator-desk');
    await expect(bindings.listOwn(actorB)).resolves.toMatchObject({ items: [] });
    await expect(bindings.listOwn({ ...actorA, tenantId: TENANT_B })).resolves.toMatchObject({ items: [] });
  });

  it('requires durable organization administration even when the request memory is forged', async () => {
    await expect(bindings.execute(
      forgedNonAdmin,
      bindingCommand(providerCapabilityId, '1', 'forged'),
    )).rejects.toMatchObject({ response: { code: 'ORGANIZATION_ADMIN_REQUIRED' } });
  });

  it('replays exactly, rejects payload mismatch and serializes concurrent versions', async () => {
    const original = bindingCommand(providerCapabilityId, '1', 'update');
    const first = await bindings.execute(actorA, original);
    const replay = await bindings.execute(actorA, original);
    expect(first).toMatchObject({ version: '2', replayed: false });
    expect(replay).toMatchObject({ version: '2', replayed: true, committedAt: first.committedAt });
    await expect(bindings.execute(actorA, {
      ...original,
      environment: 'PRODUCTION',
    })).rejects.toBeInstanceOf(IntegrationBindingValidationError);

    const results = await Promise.allSettled([
      bindings.execute(actorA, bindingCommand(providerCapabilityId, '2', 'race-a')),
      bindings.execute(actorA, bindingCommand(providerCapabilityId, '2', 'race-b')),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictException);
    expect(JSON.stringify((rejected.reason as ConflictException).getResponse()))
      .toContain('INTEGRATION_BINDING_STALE_VERSION');
  });

  it('never accepts a platform-issued receipt and derives LIVE_ACCEPTED only from a complete chain', async () => {
    await expect(admin.$executeRaw(Prisma.sql`
      INSERT INTO public."integration_capability_evidence" (
        "id", "tenantId", "organizationId", "providerId", "integrationBindingId",
        "maturity", "evidenceReference", "evidenceIssuer", "externalReceiptId",
        "checkedAt", "recordedByAuthority"
      )
      SELECT ${`${RUN_ID}-self-receipt`}, "tenantId", "organizationId", "providerId", "id",
        'LIVE_ACCEPTED', 'evidence:self', 'PC_CROP', 'self-receipt', now(), 'acceptance'
      FROM public."integration_bindings" WHERE "id" = ${bindingId}
    `)).rejects.toThrow(/integration_capability_evidence_live_receipt_check/i);

    const stages = [
      'PUBLIC_SPEC_VERIFIED', 'CONTRACT_MAPPED', 'ADAPTER_IMPLEMENTED',
      'CONTRACT_TESTED', 'EXTERNAL_ACCESS_PENDING', 'CONTRACT_PENDING',
      'LIVE_TESTING', 'LIVE_ACCEPTED',
    ] as const;
    for (const [index, maturity] of stages.entries()) {
      await admin.$executeRaw(Prisma.sql`
        INSERT INTO public."integration_capability_evidence" (
          "id", "tenantId", "organizationId", "providerId", "integrationBindingId",
          "maturity", "evidenceReference", "evidenceIssuer", "externalReceiptId",
          "checkedAt", "recordedByAuthority"
        )
        SELECT ${`${RUN_ID}-evidence-${index}`}, "tenantId", "organizationId", "providerId", "id",
          ${maturity}, ${`evidence:${maturity}`}, 'EXTERNAL_OPERATOR',
          ${maturity === 'LIVE_ACCEPTED' ? 'operator-receipt-2026-1' : null},
          clock_timestamp() + ${index} * interval '1 millisecond', 'acceptance-authority'
        FROM public."integration_bindings" WHERE "id" = ${bindingId}
      `);
    }
    const beforeActivation = await bindings.listOwn(actorA);
    expect(beforeActivation.items[0]?.assessment).toMatchObject({
      maturity: 'LIVE_ACCEPTED',
      mayCarryRealTraffic: false,
    });
    await admin.$executeRaw(Prisma.sql`
      UPDATE public."integration_bindings"
      SET "status" = 'ACTIVE', "version" = "version" + 1, "updatedAt" = clock_timestamp()
      WHERE "id" = ${bindingId}
    `);
    const active = await bindings.listOwn(actorA);
    expect(active.items[0]?.assessment).toMatchObject({
      maturity: 'LIVE_ACCEPTED',
      nextRequired: null,
      mayCarryRealTraffic: true,
    });
  });

  it('rolls back binding, event and audit when outbox insertion fails', async () => {
    const failing = bindingCommand(providerCapabilityId, '0', 'atomic-failure', 'atomic-failure');
    const identity = `${TENANT_A}:${ORG_A}:${failing.commandId}`;
    const conflictingOutboxId = deterministicId('outbox-binding', identity);
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
    await expect(bindings.execute(actorA, failing)).rejects.toBeDefined();
    const counts = await admin.$queryRaw<Array<{ bindings: bigint; events: bigint }>>(Prisma.sql`
      SELECT
        (SELECT count(*) FROM public."integration_bindings" WHERE "bindingKey" = 'atomic-failure')::bigint AS bindings,
        (SELECT count(*) FROM public."integration_binding_events" WHERE "commandId" = ${failing.commandId})::bigint AS events
    `);
    expect(counts[0]).toEqual({ bindings: 0n, events: 0n });
    expect(await admin.auditEvent.count({ where: { correlationId: failing.correlationId } })).toBe(0);
  });
});
