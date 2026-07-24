import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../common/types/request-user';
import { StaffRole } from '../staff-access/staff-access.types';
import { RegulatoryIntegrationControlTowerRepository } from './regulatory-integration.control-tower.repository';
import { RegulatoryIntegrationControlTowerRedriveRepository } from './regulatory-integration.control-tower.redrive.repository';
import { RegulatoryIntegrationReconciliationRepository } from './regulatory-integration.reconciliation.repository';

const describePostgres = process.env.PC_CROP_07B_POSTGRESQL === '1' ? describe : describe.skip;
const RUN_ID = `pc-crop-07b.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT_A = `${RUN_ID}.tenant-a`;
const TENANT_B = `${RUN_ID}.tenant-b`;
const ORG_A = `${RUN_ID}.org-a`;
const ORG_B = `${RUN_ID}.org-b`;
const ADAPTER_A = `${RUN_ID}.adapter-a`;
const ADAPTER_B = `${RUN_ID}.adapter-b`;
const ENTRY_READY = `${RUN_ID}.entry-ready`;
const ENTRY_RED_DRIVE = `${RUN_ID}.entry-redrive`;

let prisma: PrismaService;
let controlTower: RegulatoryIntegrationControlTowerRepository;
let reconciliation: RegulatoryIntegrationReconciliationRepository;
let redrive: RegulatoryIntegrationControlTowerRedriveRepository;

function actor(tenantId: string, orgId: string, suffix: string): RequestUser {
  return {
    id: `${RUN_ID}.user-${suffix}`,
    email: `${suffix}@industrial.invalid`,
    role: Role.ADMIN,
    tenantId,
    orgId,
    membershipId: `${RUN_ID}.membership-${suffix}`,
    sessionId: `${RUN_ID}.session-${suffix}`,
    mfaVerified: true,
    staffRoles: [StaffRole.PLATFORM_ADMIN],
  };
}

const USER_A = actor(TENANT_A, ORG_A, 'a');
const USER_B = actor(TENANT_B, ORG_B, 'b');

async function seedOrganization(id: string, tenantId: string, innSuffix: string): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO public."organizations" (
      "id", "inn", "name", "status", "tenantId", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${`7800${innSuffix.padStart(6, '0')}`}, ${`Control Tower ${innSuffix}`},
      'VERIFIED', ${tenantId}, clock_timestamp(), clock_timestamp()
    ) ON CONFLICT ("id") DO NOTHING
  `);
}

async function seedInbox(input: Readonly<{
  id: string;
  tenantId: string;
  orgId: string;
  adapterCode: string;
  provider: string;
  externalEventId: string;
  environment: 'PRODUCTION' | 'PREPROD';
  state: 'PROCESSED' | 'QUARANTINED';
  version: bigint;
  errorCode?: string;
}>): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO public."regulatory_integration_inbox_entries" (
      "id", "tenantId", "organizationId", "provider", "externalEventId",
      "adapterCode", "adapterVersion", "capabilities", "environment",
      "schemaVersion", "mappingVersion", "rawBodySha256", "evidenceReference",
      "signatureStatus", "occurredAt", "receivedAt", "state", "attempts",
      "nextAttemptAt", "lastErrorCode", "lastErrorCategory", "correlationId",
      "version", "createdAt", "updatedAt", "providerAcknowledgedAt",
      "businessAcceptedAt"
    ) VALUES (
      ${input.id}, ${input.tenantId}, ${input.orgId}, ${input.provider}, ${input.externalEventId},
      ${input.adapterCode}, '1.0.0', CAST('["INBOUND_EVENTS","SCHEMA_MAPPING"]' AS jsonb),
      ${input.environment}, '1.0.0', '1.0.0',
      ${input.id.endsWith('redrive') ? 'b'.repeat(64) : 'a'.repeat(64)},
      ${`evidence://${input.id}`}, 'NOT_REQUIRED', clock_timestamp(), clock_timestamp(),
      ${input.state}, ${input.state === 'QUARANTINED' ? 3 : 0}, NULL,
      ${input.errorCode ?? null}, ${input.errorCode ? 'SECURITY' : null},
      ${`${RUN_ID}.correlation.${input.id}`}, ${input.version},
      clock_timestamp(), clock_timestamp(),
      ${input.state === 'PROCESSED' ? new Date() : null},
      ${input.state === 'PROCESSED' ? new Date() : null}
    )
  `);
}

async function cleanup(): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM public."outbox_entries"
    WHERE "correlationId" LIKE ${`${RUN_ID}.%`}
       OR "idempotencyKey" LIKE ${`%${RUN_ID}%`}
  `);
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM public."audit_events"
    WHERE "correlationId" LIKE ${`${RUN_ID}.%`}
       OR "runtimeIdempotencyKey" LIKE ${`%${RUN_ID}%`}
  `);
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM public."regulatory_integration_inbox_conflicts"
    WHERE "tenantId" IN (${TENANT_A}, ${TENANT_B})
  `);
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM public."regulatory_integration_inbox_entries"
    WHERE "tenantId" IN (${TENANT_A}, ${TENANT_B})
  `);
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM public."organizations" WHERE "id" IN (${ORG_A}, ${ORG_B})
  `);
}

describePostgres('PC-CROP-07B PostgreSQL Integration Control Tower', () => {
  jest.setTimeout(120_000);

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await cleanup();
    await seedOrganization(ORG_A, TENANT_A, '801');
    await seedOrganization(ORG_B, TENANT_B, '802');
    await seedInbox({
      id: ENTRY_READY, tenantId: TENANT_A, orgId: ORG_A, adapterCode: ADAPTER_A,
      provider: 'provider-a', externalEventId: `${RUN_ID}.ready`, environment: 'PRODUCTION',
      state: 'PROCESSED', version: 4n,
    });
    await seedInbox({
      id: ENTRY_RED_DRIVE, tenantId: TENANT_A, orgId: ORG_A, adapterCode: ADAPTER_A,
      provider: 'provider-a', externalEventId: `${RUN_ID}.redrive`, environment: 'PRODUCTION',
      state: 'QUARANTINED', version: 7n, errorCode: 'SIGNATURE_INVALID',
    });
    await seedInbox({
      id: `${RUN_ID}.entry-b`, tenantId: TENANT_B, orgId: ORG_B, adapterCode: ADAPTER_B,
      provider: 'provider-b', externalEventId: `${RUN_ID}.tenant-b`, environment: 'PREPROD',
      state: 'PROCESSED', version: 2n,
    });
    const transactions = new RlsTransactionService(prisma);
    controlTower = new RegulatoryIntegrationControlTowerRepository(transactions);
    reconciliation = new RegulatoryIntegrationReconciliationRepository(transactions);
    redrive = new RegulatoryIntegrationControlTowerRedriveRepository(transactions);
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('isolates tenant/org and never infers CONFIRMED_LIVE', async () => {
    const pageA = await controlTower.list(USER_A, { limit: 20, hasJitAuthority: true });
    expect(pageA.items.map((item) => item.adapterCode)).toEqual([ADAPTER_A]);
    expect(pageA.items[0]).toMatchObject({
      honestStatus: 'DEGRADED', aggregateVersion: '7', quarantineCount: 1,
      credentialReferenceExpiresAt: null, credentialMetadataAvailable: false,
      primaryAction: { id: 'REDRIVE', entryId: ENTRY_RED_DRIVE, allowed: true },
    });
    expect(pageA.items[0]?.honestStatus).not.toBe('CONFIRMED_LIVE');

    const pageB = await controlTower.list(USER_B, { limit: 20, hasJitAuthority: false });
    expect(pageB.items.map((item) => item.adapterCode)).toEqual([ADAPTER_B]);
    expect(pageB.items[0]?.honestStatus).toBe('TEST');
  });

  it('persists reconciliation audit/outbox once and replays deterministically', async () => {
    const command = {
      adapterCode: ADAPTER_A,
      expectedVersion: '7',
      commandId: `${RUN_ID}.reconcile-command`,
      idempotencyKey: `${RUN_ID}.reconcile-idempotency`,
      correlationId: `${RUN_ID}.reconcile-correlation`,
      reason: 'Сверка после проверки расхождения входящих событий',
    };
    const applied = await reconciliation.request(USER_A, command);
    expect(applied).toMatchObject({ kind: 'APPLIED', adapterCode: ADAPTER_A, aggregateVersion: '7' });
    const replay = await reconciliation.request(USER_A, {
      ...command,
      correlationId: `${RUN_ID}.reconcile-retry`,
    });
    expect(replay).toMatchObject({
      kind: 'REPLAY', auditEventId: applied.auditEventId, outboxEntryId: applied.outboxEntryId,
      correlationId: command.correlationId,
    });
    const evidence = await prisma.$queryRaw<Array<{ auditCount: bigint; outboxCount: bigint }>>(Prisma.sql`
      SELECT
        (SELECT count(*) FROM public."audit_events" WHERE "runtimeIdempotencyKey" LIKE ${`%${RUN_ID}.reconcile-idempotency%`}) AS "auditCount",
        (SELECT count(*) FROM public."outbox_entries" WHERE "idempotencyKey" LIKE ${`%${RUN_ID}.reconcile-idempotency%`}) AS "outboxCount"
    `);
    expect(evidence).toEqual([{ auditCount: 1n, outboxCount: 1n }]);
    await expect(reconciliation.request(USER_A, { ...command, expectedVersion: '6' }))
      .rejects.toMatchObject({ code: 'STALE_VERSION' });
  });

  it('redrives with atomic If-Match and replays after the row version changes', async () => {
    const command = {
      entryId: ENTRY_RED_DRIVE,
      expectedVersion: '7',
      commandId: `${RUN_ID}.redrive-command`,
      idempotencyKey: `${RUN_ID}.redrive-idempotency`,
      correlationId: `${RUN_ID}.redrive-correlation`,
      reason: 'Повторная обработка после устранения ошибки подписи',
    };
    const applied = await redrive.redrive(USER_A, command);
    expect(applied.kind).toBe('APPLIED');
    const row = await prisma.$queryRaw<Array<{ state: string; version: bigint }>>(Prisma.sql`
      SELECT "state", "version" FROM public."regulatory_integration_inbox_entries"
      WHERE "id" = ${ENTRY_RED_DRIVE}
    `);
    expect(row).toEqual([{ state: 'RETRY', version: 8n }]);
    const replay = await redrive.redrive(USER_A, {
      ...command,
      correlationId: `${RUN_ID}.redrive-retry`,
    });
    expect(replay).toMatchObject({
      kind: 'REPLAY', auditEventId: applied.auditEventId, outboxEntryId: applied.outboxEntryId,
      correlationId: command.correlationId,
    });
  });
});
