import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import { FgisGrainCommodityAuthorityRepository } from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-commodity-authority.repository';
import { FgisGrainCommodityAuthorityService } from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-commodity-authority.service';

const describePostgres = process.env.P0_FGIS_COMMODITY_POSTGRESQL === '1'
  ? describe
  : describe.skip;
const RUN_ID = `p0-fgis-2a-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const TENANT_A = `${RUN_ID}-tenant-a`;
const TENANT_B = `${RUN_ID}-tenant-b`;
const ORG_A = `${RUN_ID}-org-a`;
const ORG_B = `${RUN_ID}-org-b`;
const CONFIG_A = `${RUN_ID}-config-a`;
const ADMIN_A_ID = `${RUN_ID}-admin-a`;
const FARMER_A_ID = `${RUN_ID}-farmer-a`;
const ADMIN_B_ID = `${RUN_ID}-admin-b`;
const FARMER_B_ID = `${RUN_ID}-farmer-b`;

let prisma: PrismaService;
let transactions: RlsTransactionService;
let service: FgisGrainCommodityAuthorityService;
let connectionId = '';
let syncRunId = '';
let partyCurrentId = '';
let sourceSnapshotId = '';
let partyVersion = '0';
let rollbackPartyCurrentId = '';
let rollbackSnapshotId = '';
let rollbackPartyVersion = '0';
let acceptedReservationId = '';
let acceptedReservationVersion = '1';
let passportId = '';
let passportVersion = '0';

function actor(
  tenantId: string,
  orgId: string,
  id: string,
  role: Role,
  mfaVerified: boolean,
): RequestUser {
  return {
    id,
    email: `${id}@industrial.invalid`,
    role,
    tenantId,
    orgId,
    membershipId: `${id}-membership`,
    sessionId: `${id}-session`,
    mfaVerified,
  };
}

const ADMIN_A = actor(TENANT_A, ORG_A, ADMIN_A_ID, Role.ADMIN, true);
const FARMER_A = actor(TENANT_A, ORG_A, FARMER_A_ID, Role.FARMER, false);
const ADMIN_B = actor(TENANT_B, ORG_B, ADMIN_B_ID, Role.ADMIN, true);
const FARMER_B = actor(TENANT_B, ORG_B, FARMER_B_ID, Role.FARMER, false);

function command(prefix: string, suffix = '') {
  return {
    commandId: `${RUN_ID}-${prefix}-command${suffix}`,
    idempotencyKey: `${RUN_ID}-${prefix}-idem${suffix}`,
    correlationId: `${RUN_ID}-${prefix}-corr${suffix}`,
  };
}

function snapshot(
  externalPartyId: string,
  payloadSeed: string,
  amountAvailable = '100.000000',
) {
  return {
    externalPartyId,
    externalPartyNumber: `${externalPartyId}-number`,
    externalRecordId: `${externalPartyId}-record`,
    adapterVersion: 'fgis-zerno-1.0.23-catalog.v1',
    contractVersion: '1.0.23',
    ownerReference: `owner://${ORG_A}`,
    agentReference: null,
    repositoryReference: `repository://${ORG_A}/elevator`,
    productCode: 'WHEAT',
    productName: 'Пшеница',
    okpd2Code: '01.11.11',
    tnvedCode: '1001',
    targetCode: 'FOOD',
    purposeCode: 'SALE',
    harvestYear: '2026',
    storagePlace: { name: 'Элеватор Южный', region: '23' },
    amountOriginal: '120.000000',
    amountAvailable,
    sourceUnitCode: 'TNE',
    normalizedUnitCode: 'TNE',
    unitAuthority: 'PROVIDER' as const,
    qualityValues: { protein: { value: '12.4', sourceCode: 'FGIS' } },
    externalStatus: 'SUBSCRIBED',
    sourceRegisteredAt: new Date(Date.now() - 60_000).toISOString(),
    sourceUpdatedAt: new Date().toISOString(),
    organicFlag: false,
    quarantineZoneFlag: false,
    payloadHash: payloadSeed.repeat(64).slice(0, 64),
    criticalHash: `${payloadSeed}c`.repeat(64).slice(0, 64),
    protectedRawReference: `evidence://fgis-grain/${externalPartyId}/${payloadSeed}`,
  };
}

async function seedIdentityAndProviderAuthority(): Promise<void> {
  const now = new Date();
  const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60_000);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO public."organizations" (
      "id", "inn", "name", "type", "status", "tenantId", "verifiedAt",
      "kycStatus", "amlStatus", "sanctionHit", "createdAt", "updatedAt"
    ) VALUES
      (${ORG_A}, ${`77${Date.now().toString().slice(-8)}`}, ${`${RUN_ID} Org A`},
       'LEGAL', 'ACTIVE', ${TENANT_A}, ${now}, 'APPROVED', 'CLEAR', false, ${now}, ${now}),
      (${ORG_B}, ${`78${Date.now().toString().slice(-8)}`}, ${`${RUN_ID} Org B`},
       'LEGAL', 'ACTIVE', ${TENANT_B}, ${now}, 'APPROVED', 'CLEAR', false, ${now}, ${now})
  `);

  for (const user of [ADMIN_A, FARMER_A, ADMIN_B, FARMER_B]) {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO public."users" (
        "id", "email", "passwordHash", "fullName", "status", "mfaEnabled",
        "createdAt", "updatedAt"
      ) VALUES (
        ${user.id}, ${user.email}, 'not-a-real-password-hash', ${user.id},
        'ACTIVE', ${user.mfaVerified === true}, ${now}, ${now}
      )
    `);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO public."user_orgs" (
        "id", "userId", "organizationId", "role", "isDefault", "joinedAt"
      ) VALUES (
        ${user.membershipId!}, ${user.id}, ${user.orgId}, ${user.role}, true, ${now}
      )
    `);
  }

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO public."fgis_grain_provider_configurations" (
      "id", "tenantId", "organizationId", "adapterCode", "apiVersion",
      "mappingVersion", "signingPolicyVersion", "environment",
      "endpointReference", "tlsPolicyReference", "credentialReference",
      "signingKeyReference", "payloadStoreReference", "status", "version",
      "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
    ) VALUES (
      ${CONFIG_A}, ${TENANT_A}, ${ORG_A}, 'FGIS_ZERNO', '1.0.23',
      'fgis-zerno-1.0.23-catalog.v1',
      'fgis-zerno-1.0.23-signing-policy.v1', 'PRE_PRODUCTION',
      'endpoint://fgis-zerno/pre-production',
      'tls://fgis-zerno/pre-production',
      'credential://vault/fgis-zerno/pre-production',
      'signing-key://vault/fgis-zerno/pre-production',
      'object-store://fgis-zerno/pre-production',
      'TEST_APPROVED', 1, ${ADMIN_A_ID}, ${ADMIN_A_ID}, ${now}, ${now}
    )
  `);

  const gates = ['OWNER', 'SECURITY', 'LEGAL', 'OPERATIONS'] as const;
  for (const [index, gate] of gates.entries()) {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO public."fgis_grain_provider_attestations" (
        "id", "configurationId", "tenantId", "organizationId", "gate",
        "decision", "configurationVersion", "actorUserId", "actorRole",
        "mfaVerified", "justification", "evidenceReference", "validUntil",
        "idempotencyKey", "correlationId", "hash", "prevHash", "createdAt"
      ) VALUES (
        ${`${RUN_ID}-attestation-${gate.toLowerCase()}`}, ${CONFIG_A}, ${TENANT_A},
        ${ORG_A}, ${gate}, 'APPROVED', 1, ${ADMIN_A_ID}, 'ADMIN', true,
        ${`${gate} gate accepted for isolated PostgreSQL authority evidence.`},
        ${`evidence://fgis-grain/${RUN_ID}/${gate.toLowerCase()}`}, ${validUntil},
        ${`${RUN_ID}-attestation-${gate.toLowerCase()}-idem`},
        ${`${RUN_ID}-attestation-${gate.toLowerCase()}-corr`},
        ${String(index + 1).repeat(64).slice(0, 64)},
        ${index === 0 ? null : String(index).repeat(64).slice(0, 64)}, ${now}
      )
    `);
  }
}

async function setAppContext(
  tx: Prisma.TransactionClient,
  user: RequestUser,
): Promise<void> {
  await tx.$executeRawUnsafe('SET LOCAL ROLE app_deal');
  await tx.$queryRaw(Prisma.sql`
    SELECT
      set_config('app.current_user_id', ${user.id}, true),
      set_config('app.current_org_id', ${user.orgId}, true),
      set_config('app.current_tenant_id', ${user.tenantId!}, true),
      set_config('app.current_role', ${user.role}, true),
      set_config('app.current_session_id', ${user.sessionId!}, true)
  `);
}

describePostgres('P0.2-2A PostgreSQL FGIS commodity authority', () => {
  jest.setTimeout(240_000);

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    transactions = new RlsTransactionService(prisma);
    service = new FgisGrainCommodityAuthorityService(
      new FgisGrainCommodityAuthorityRepository(transactions),
    );
    await seedIdentityAndProviderAuthority();

    const bound = await service.bindConnection(ADMIN_A, {
      ...command('bind'),
      providerConfigurationId: CONFIG_A,
      expectedVersion: '0',
    });
    expect(bound).toMatchObject({ ok: true, status: 'BOUND', version: '1' });
    connectionId = String(bound.connectionId);

    const started = await service.startSyncRun(ADMIN_A, {
      ...command('sync'),
      connectionId,
      operationCode: 'GET_LIST_LOT',
      recordsModifiedFrom: null,
      pageCursor: null,
      expectedConnectionVersion: '1',
    });
    expect(started).toMatchObject({ ok: true, status: 'REQUESTED', version: '1' });
    syncRunId = String(started.syncRunId);

    const accepted = await service.acceptPartySnapshot(ADMIN_A, {
      ...command('snapshot-main'),
      connectionId,
      syncRunId,
      snapshot: snapshot(`${RUN_ID}-party-main`, 'a'),
      expectedCurrentVersion: '0',
    });
    expect(accepted).toMatchObject({ ok: true, normalizedStatus: 'AVAILABLE' });
    partyCurrentId = String(accepted.partyCurrentId);
    sourceSnapshotId = String(accepted.snapshotId);
    partyVersion = String(accepted.version);

    const rollbackParty = await service.acceptPartySnapshot(ADMIN_A, {
      ...command('snapshot-rollback'),
      connectionId,
      syncRunId,
      snapshot: snapshot(`${RUN_ID}-party-rollback`, 'b', '20.000000'),
      expectedCurrentVersion: '0',
    });
    rollbackPartyCurrentId = String(rollbackParty.partyCurrentId);
    rollbackSnapshotId = String(rollbackParty.snapshotId);
    rollbackPartyVersion = String(rollbackParty.version);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('persists connection, immutable snapshots and current projection with audit/outbox evidence', async () => {
    const rows = await prisma.$queryRaw<Array<{
      connections: bigint;
      snapshots: bigint;
      currentRows: bigint;
      auditRows: bigint;
      outboxRows: bigint;
    }>>(Prisma.sql`
      SELECT
        (SELECT count(*) FROM public."fgis_grain_organization_connections"
          WHERE "id" = ${connectionId}) AS connections,
        (SELECT count(*) FROM public."fgis_grain_party_snapshots"
          WHERE "id" IN (${sourceSnapshotId}, ${rollbackSnapshotId})) AS snapshots,
        (SELECT count(*) FROM public."fgis_grain_party_current"
          WHERE "id" IN (${partyCurrentId}, ${rollbackPartyCurrentId})) AS "currentRows",
        (SELECT count(*) FROM public."audit_events"
          WHERE "tenantId" = ${TENANT_A} AND "objectType" LIKE 'FGIS%') AS "auditRows",
        (SELECT count(*) FROM public."outbox_entries"
          WHERE "correlationId" LIKE ${`${RUN_ID}-%`}) AS "outboxRows"
    `);
    expect(rows[0]).toMatchObject({
      connections: 1n,
      snapshots: 2n,
      currentRows: 2n,
    });
    expect(rows[0].auditRows).toBeGreaterThanOrEqual(4n);
    expect(rows[0].outboxRows).toBeGreaterThanOrEqual(4n);

    await expect(prisma.$executeRaw(Prisma.sql`
      UPDATE public."fgis_grain_party_snapshots"
      SET "productName" = 'tampered'
      WHERE "id" = ${sourceSnapshotId}
    `)).rejects.toBeDefined();
    await expect(prisma.$executeRaw(Prisma.sql`
      DELETE FROM public."fgis_grain_party_snapshots"
      WHERE "id" = ${sourceSnapshotId}
    `)).rejects.toBeDefined();
  });

  it('serializes fifty concurrent reservation attempts without oversell and preserves idempotency', async () => {
    const requests = Array.from({ length: 50 }, (_, index) => ({
      ...command('reserve-race', `-${index}`),
      partyCurrentId,
      sourceSnapshotId,
      volume: '3.000000',
      unit: 'TNE',
      reason: `Concurrent reservation ${index}`,
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      expectedPartyVersion: partyVersion,
    }));
    const settled = await Promise.allSettled(
      requests.map((input) => service.reserveVolume(FARMER_A, input)),
    );
    const accepted = settled
      .filter((entry): entry is PromiseFulfilledResult<Record<string, unknown>> => entry.status === 'fulfilled')
      .map((entry) => entry.value)
      .filter((receipt) => receipt.ok === true);
    expect(accepted.length).toBeGreaterThanOrEqual(1);

    const totals = await prisma.$queryRaw<Array<{ consumed: Prisma.Decimal; capacity: Prisma.Decimal }>>(Prisma.sql`
      SELECT
        COALESCE(sum(r."volume"), 0)::numeric(20,6) AS consumed,
        p."availableSourceAmount" AS capacity
      FROM public."fgis_grain_party_current" p
      LEFT JOIN public."commodity_reservations" r
        ON r."partyCurrentId" = p."id"
       AND r."status" IN ('PENDING', 'ACTIVE', 'CONVERTED_TO_DEAL', 'FROZEN')
      WHERE p."id" = ${partyCurrentId}
      GROUP BY p."availableSourceAmount"
    `);
    expect(totals[0].consumed.lessThanOrEqualTo(totals[0].capacity)).toBe(true);

    const firstAccepted = accepted[0];
    acceptedReservationId = String(firstAccepted.reservationId);
    acceptedReservationVersion = '1';
    const originalInput = requests.find(
      (candidate) => candidate.idempotencyKey === firstAccepted.idempotencyKey,
    ) ?? requests[0];
    const replay = await service.reserveVolume(FARMER_A, originalInput);
    expect(replay).toMatchObject({
      ok: true,
      reservationId: acceptedReservationId,
      duplicate: true,
    });
    await expect(service.reserveVolume(FARMER_A, {
      ...originalInput,
      volume: '4.000000',
    })).rejects.toBeDefined();
  });

  it('rolls reservation, audit and command state back when canonical outbox cannot be written', async () => {
    const correlationId = `${RUN_ID}-rollback-outbox-corr`;
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION public.fgis_commodity_test_fail_outbox()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW."correlationId" = '${correlationId}' THEN
          RAISE EXCEPTION 'TEST_OUTBOX_FAILURE';
        END IF;
        RETURN NEW;
      END $$;
      DROP TRIGGER IF EXISTS fgis_commodity_test_fail_outbox_trigger
        ON public."outbox_entries";
      CREATE TRIGGER fgis_commodity_test_fail_outbox_trigger
      BEFORE INSERT ON public."outbox_entries"
      FOR EACH ROW EXECUTE FUNCTION public.fgis_commodity_test_fail_outbox();
    `);
    const before = await prisma.$queryRaw<Array<{ reservations: bigint; audits: bigint; commands: bigint }>>(Prisma.sql`
      SELECT
        (SELECT count(*) FROM public."commodity_reservations"
          WHERE "partyCurrentId" = ${rollbackPartyCurrentId}) AS reservations,
        (SELECT count(*) FROM public."audit_events"
          WHERE "correlationId" = ${correlationId}) AS audits,
        (SELECT count(*) FROM public."fgis_grain_commodity_commands"
          WHERE "idempotencyKey" = ${`${RUN_ID}-rollback-idem`}) AS commands
    `);
    try {
      await expect(service.reserveVolume(FARMER_A, {
        commandId: `${RUN_ID}-rollback-command`,
        idempotencyKey: `${RUN_ID}-rollback-idem`,
        correlationId,
        partyCurrentId: rollbackPartyCurrentId,
        sourceSnapshotId: rollbackSnapshotId,
        volume: '5.000000',
        unit: 'TNE',
        reason: 'Atomic rollback proof',
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        expectedPartyVersion: rollbackPartyVersion,
      })).rejects.toBeDefined();
    } finally {
      await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS fgis_commodity_test_fail_outbox_trigger
          ON public."outbox_entries";
        DROP FUNCTION IF EXISTS public.fgis_commodity_test_fail_outbox();
      `);
    }
    const after = await prisma.$queryRaw<Array<{ reservations: bigint; audits: bigint; commands: bigint }>>(Prisma.sql`
      SELECT
        (SELECT count(*) FROM public."commodity_reservations"
          WHERE "partyCurrentId" = ${rollbackPartyCurrentId}) AS reservations,
        (SELECT count(*) FROM public."audit_events"
          WHERE "correlationId" = ${correlationId}) AS audits,
        (SELECT count(*) FROM public."fgis_grain_commodity_commands"
          WHERE "idempotencyKey" = ${`${RUN_ID}-rollback-idem`}) AS commands
    `);
    expect(after[0]).toEqual(before[0]);
  });

  it('creates and seals a passport bound to the exact reservation and snapshot', async () => {
    const created = await service.createLotPassport(FARMER_A, {
      ...command('passport-create'),
      reservationId: acceptedReservationId,
    });
    expect(created).toMatchObject({ ok: true, status: 'DRAFT', version: '1' });
    passportId = String(created.passportId);
    passportVersion = String(created.version);

    const sealed = await service.sealLotPassport(FARMER_A, {
      ...command('passport-seal'),
      passportId,
      expectedVersion: passportVersion,
    });
    expect(sealed).toMatchObject({ ok: true, status: 'SEALED', version: '2' });

    const bound = await prisma.$queryRaw<Array<{
      reservationId: string;
      snapshotId: string;
      partyId: string;
      sourceType: string;
    }>>(Prisma.sql`
      SELECT
        "reservationId", "sourceSnapshotId" AS "snapshotId",
        "partyCurrentId" AS "partyId", "sourceType"
      FROM public."fgis_grain_lot_passports"
      WHERE "id" = ${passportId}
    `);
    expect(bound[0]).toEqual({
      reservationId: acceptedReservationId,
      snapshotId: sourceSnapshotId,
      partyId: partyCurrentId,
      sourceType: 'FGIS_GRAIN',
    });
    await expect(prisma.$executeRaw(Prisma.sql`
      UPDATE public."fgis_grain_lot_passports"
      SET "sourceSnapshotId" = ${rollbackSnapshotId}
      WHERE "id" = ${passportId}
    `)).rejects.toBeDefined();
  });

  it('enforces tenant and organization RLS plus direct-DML denial under app_deal', async () => {
    const role = await prisma.$queryRaw<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>(Prisma.sql`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'app_deal'
    `);
    expect(role[0]).toEqual({ rolsuper: false, rolbypassrls: false });

    const hidden = await prisma.$transaction(async (tx) => {
      await setAppContext(tx, FARMER_B);
      return tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT count(*) AS count
        FROM public."fgis_grain_party_current"
        WHERE "id" = ${partyCurrentId}
      `);
    });
    expect(hidden[0].count).toBe(0n);

    await expect(prisma.$transaction(async (tx) => {
      await setAppContext(tx, FARMER_A);
      await tx.$executeRaw(Prisma.sql`
        UPDATE public."fgis_grain_party_current"
        SET "availableSourceAmount" = 999999
        WHERE "id" = ${partyCurrentId}
      `);
    })).rejects.toBeDefined();
    await expect(prisma.$transaction(async (tx) => {
      await setAppContext(tx, FARMER_A);
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM public."commodity_reservations"
        WHERE "id" = ${acceptedReservationId}
      `);
    })).rejects.toBeDefined();
    await expect(prisma.$transaction(async (tx) => {
      await setAppContext(tx, FARMER_A);
      await tx.$executeRawUnsafe('TRUNCATE TABLE public."commodity_reservations"');
    })).rejects.toBeDefined();
  });

  it('opens one idempotent critical reconciliation case and blocks further reservation', async () => {
    const input = {
      ...command('reconciliation-open'),
      partyCurrentId,
      previousSnapshotId: sourceSnapshotId,
      actualSnapshotId: sourceSnapshotId,
      reservationId: acceptedReservationId,
      lotId: null,
      severity: 'CRITICAL',
      reasonCode: 'SOURCE_VOLUME_REQUIRES_REVIEW',
      expectedState: { available: '100.000000' },
      actualState: { available: '97.000000' },
      ownerUserId: ADMIN_A_ID,
    } as const;
    const opened = await service.openReconciliationCase(ADMIN_A, input);
    const replayed = await service.openReconciliationCase(ADMIN_A, input);
    expect(opened).toMatchObject({ ok: true, status: 'OPEN', severity: 'CRITICAL' });
    expect(replayed).toMatchObject({
      ok: true,
      caseId: opened.caseId,
      duplicate: true,
    });

    const current = await prisma.$queryRaw<Array<{ status: string }>>(Prisma.sql`
      SELECT "normalizedStatus" AS status
      FROM public."fgis_grain_party_current"
      WHERE "id" = ${partyCurrentId}
    `);
    expect(current[0].status).toBe('RECONCILIATION_REQUIRED');

    const latest = await prisma.$queryRaw<Array<{ version: bigint }>>(Prisma.sql`
      SELECT "version" FROM public."fgis_grain_party_current" WHERE "id" = ${partyCurrentId}
    `);
    const denied = await service.reserveVolume(FARMER_A, {
      ...command('reserve-after-reconciliation'),
      partyCurrentId,
      sourceSnapshotId,
      volume: '1.000000',
      unit: 'TNE',
      reason: 'Must be denied while critical reconciliation is open',
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      expectedPartyVersion: latest[0].version.toString(),
    });
    expect(denied).toMatchObject({
      ok: false,
      code: 'FGIS_PARTY_NOT_RESERVABLE',
    });
  });
});
