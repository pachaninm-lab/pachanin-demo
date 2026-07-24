import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import {
  FGIS_GRAIN_SDIZ_PROJECTION_COMMAND_SCHEMA,
  computeFgisGrainSdizBatchFingerprint,
  normalizeFgisGrainSdizRecord,
} from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-sdiz-projection.contract';
import {
  FgisGrainSdizProjectionRepository,
  FgisGrainSdizProjectionRepositoryError,
} from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-sdiz-projection.repository';

const describePostgres = process.env.PC_CROP_08F_POSTGRESQL === '1' ? describe : describe.skip;
const RUN_ID = `pc-crop-08f.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT_A = `${RUN_ID}.tenant-a`;
const TENANT_B = `${RUN_ID}.tenant-b`;
const ORG_A = `${RUN_ID}.org-a`;
const ORG_B = `${RUN_ID}.org-b`;
const USER_A = actor(TENANT_A, ORG_A, 'a');
const USER_B = actor(TENANT_B, ORG_B, 'b');

let prisma: PrismaService;
let repository: FgisGrainSdizProjectionRepository;

function actor(tenantId: string, orgId: string, suffix: string): RequestUser {
  return {
    id: `${RUN_ID}.worker-user-${suffix}`,
    email: `${suffix}@sdiz.invalid`,
    role: Role.ADMIN,
    tenantId,
    orgId,
    sessionId: `${RUN_ID}.session-${suffix}`,
    mfaVerified: true,
  };
}

async function seedOrganization(id: string, tenantId: string, suffix: string): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO public."organizations" (
      "id", "inn", "name", "status", "tenantId", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${`78${suffix.padStart(10, '0')}`}, ${`SDIZ Projection ${suffix}`},
      'VERIFIED', ${tenantId}, clock_timestamp(), clock_timestamp()
    ) ON CONFLICT ("id") DO NOTHING
  `);
}

interface SeedInboxInput {
  id: string;
  tenantId: string;
  organizationId: string;
  providerMessageId: string;
  providerReferenceMessageId: string | null;
  rawBodySha256: string;
  occurredAt: Date;
  workerId: string;
  version?: bigint;
  state?: 'PROCESSING' | 'VERIFIED';
  signatureStatus?: 'VERIFIED' | 'INVALID';
  leaseExpiresAt?: Date;
}

async function seedInbox(input: SeedInboxInput): Promise<void> {
  const verification = input.signatureStatus === 'INVALID'
    ? { verified: false, verifiedAt: input.occurredAt.toISOString(), errorCode: 'SIGNATURE_INVALID' }
    : {
        verified: true,
        verifiedAt: input.occurredAt.toISOString(),
        schemaVersion: '1.0.23',
        mappingVersion: 'fgis-zerno-1.0.23-catalog.v1',
        signatureKeyReference: 'signing-key://fgis/preprod/test',
      };
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO public."regulatory_integration_inbox_entries" (
      "id", "tenantId", "organizationId", "adapterCode", "adapterVersion",
      "provider", "externalEventId", "schemaVersion", "mappingVersion",
      "environment", "capabilities", "occurredAt", "receivedAt",
      "rawBodySha256", "evidenceReference", "signatureStatus",
      "signatureAlgorithm", "signatureKeyReference", "signatureKeyVersion",
      "verificationResult", "state", "attempts", "leaseOwner",
      "leaseExpiresAt", "correlationId", "causationId", "version",
      "createdAt", "updatedAt"
    ) VALUES (
      ${input.id}, ${input.tenantId}, ${input.organizationId}, 'FGIS_ZERNO', '1.0.23',
      'FGIS_ZERNO', ${input.providerMessageId}, '1.0.23',
      'fgis-zerno-1.0.23-catalog.v1', 'PREPROD',
      CAST('["INBOUND_EVENTS","SIGNATURE_VERIFICATION","SCHEMA_MAPPING"]' AS jsonb),
      ${input.occurredAt}, clock_timestamp(), ${input.rawBodySha256},
      ${`evidence://fgis-zerno/${input.id}`}, ${input.signatureStatus ?? 'VERIFIED'},
      'urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34102012-gostr34112012-256',
      'signing-key://fgis/preprod/test', 'v1',
      CAST(${JSON.stringify(verification)} AS jsonb), ${input.state ?? 'PROCESSING'}, 0,
      ${input.state === 'VERIFIED' ? null : input.workerId},
      ${input.state === 'VERIFIED' ? null : input.leaseExpiresAt ?? new Date(Date.now() + 60_000)},
      ${`${RUN_ID}.correlation.${input.id}`}, ${input.providerReferenceMessageId},
      ${input.version ?? 3n}, clock_timestamp(), clock_timestamp()
    )
  `);
}

function record(overrides: Record<string, unknown> = {}) {
  return {
    sdizID: `${RUN_ID}.sdiz-1`,
    sdizNumber: `${RUN_ID}.number-1`,
    lotNumber: `${RUN_ID}.lot-1`,
    status: 'CREATED',
    ...overrides,
  };
}

function command(input: {
  inboxEntryId: string;
  workerId: string;
  expectedInboxVersion?: string;
  providerMessageId: string;
  providerReferenceMessageId?: string | null;
  rawBodySha256: string;
  providerOccurredAt: Date;
  records: readonly unknown[];
  idempotencySuffix: string;
}) {
  const canonical = input.records.map(normalizeFgisGrainSdizRecord)
    .sort((left, right) => left.sdizId.localeCompare(right.sdizId));
  const providerOccurredAt = input.providerOccurredAt.toISOString();
  const batchFingerprint = computeFgisGrainSdizBatchFingerprint({
    providerMessageId: input.providerMessageId,
    providerReferenceMessageId: input.providerReferenceMessageId ?? null,
    rawBodySha256: input.rawBodySha256,
    providerOccurredAt,
    records: canonical,
  });
  return {
    schemaVersion: FGIS_GRAIN_SDIZ_PROJECTION_COMMAND_SCHEMA,
    inboxEntryId: input.inboxEntryId,
    workerId: input.workerId,
    expectedInboxVersion: input.expectedInboxVersion ?? '3',
    providerMessageId: input.providerMessageId,
    providerReferenceMessageId: input.providerReferenceMessageId ?? null,
    rawBodySha256: input.rawBodySha256,
    providerOccurredAt,
    batchFingerprint,
    records: input.records,
    correlationId: `${RUN_ID}.apply.${input.idempotencySuffix}`,
    idempotencyKey: `${RUN_ID}.apply.${input.idempotencySuffix}`,
    reason: 'Применение проверенного входящего пакета СДИЗ ФГИС Зерно',
  };
}

describePostgres('PC-CROP-08F PostgreSQL SDIZ projection authority', () => {
  jest.setTimeout(180_000);

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await seedOrganization(ORG_A, TENANT_A, '801');
    await seedOrganization(ORG_B, TENANT_B, '802');
    repository = new FgisGrainSdizProjectionRepository(new RlsTransactionService(prisma));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('atomically applies a verified leased inbox and replays without legal confirmation', async () => {
    const inboxId = `${RUN_ID}.inbox.apply`;
    const workerId = `${RUN_ID}.worker.apply`;
    const occurredAt = new Date('2026-07-24T12:00:00.000Z');
    await seedInbox({
      id: inboxId,
      tenantId: TENANT_A,
      organizationId: ORG_A,
      providerMessageId: `${RUN_ID}.message.apply`,
      providerReferenceMessageId: `${RUN_ID}.reference.apply`,
      rawBodySha256: 'a'.repeat(64),
      occurredAt,
      workerId,
    });
    const input = command({
      inboxEntryId: inboxId,
      workerId,
      providerMessageId: `${RUN_ID}.message.apply`,
      providerReferenceMessageId: `${RUN_ID}.reference.apply`,
      rawBodySha256: 'a'.repeat(64),
      providerOccurredAt: occurredAt,
      records: [
        record(),
        record({ sdizID: `${RUN_ID}.sdiz-2`, sdizNumber: undefined, SDIZNumber: `${RUN_ID}.number-2`, status: 'SUBSCRIBED' }),
      ],
      idempotencySuffix: 'initial',
    });
    const applied = await repository.applyVerifiedInbox(USER_A, input);
    expect(applied).toMatchObject({ kind: 'APPLIED', inboxEntryId: inboxId, recordCount: 2, conflictCode: null });
    const replay = await repository.applyVerifiedInbox(USER_A, input);
    expect(replay).toMatchObject({
      kind: 'REPLAY',
      projectionBatchId: applied.projectionBatchId,
      auditEventId: applied.auditEventId,
      outboxEntryId: applied.outboxEntryId,
      recordCount: 2,
    });
    const evidence = await prisma.$queryRaw<Array<{
      batchCount: bigint; projectionCount: bigint; state: string;
      providerAcknowledgedAt: Date | null; businessAcceptedAt: Date | null;
      confirmedAt: Date | null; linkedDomainOperationType: string | null;
    }>>(Prisma.sql`
      SELECT
        (SELECT count(*) FROM public."fgis_grain_sdiz_projection_batches" WHERE "sourceInboxEntryId" = ${inboxId}) AS "batchCount",
        (SELECT count(*) FROM public."fgis_grain_sdiz_projections" WHERE "sourceInboxEntryId" = ${inboxId}) AS "projectionCount",
        i."state", i."providerAcknowledgedAt", i."businessAcceptedAt",
        o."confirmedAt", i."linkedDomainOperationType"
      FROM public."regulatory_integration_inbox_entries" i
      JOIN public."outbox_entries" o ON o."id" = i."outboxEntryId"
      WHERE i."id" = ${inboxId}
    `);
    expect(evidence).toEqual([{
      batchCount: 1n,
      projectionCount: 2n,
      state: 'PROCESSED',
      providerAcknowledgedAt: null,
      businessAcceptedAt: null,
      confirmedAt: null,
      linkedDomainOperationType: 'FGIS_GRAIN_SDIZ_PROJECTION_BATCH',
    }]);
  });

  it('applies only newer provider state and quarantines stale or same-time conflicts', async () => {
    const sdizId = `${RUN_ID}.sdiz.monotonic`;
    const sdizNumber = `${RUN_ID}.number.monotonic`;
    const firstTime = new Date('2026-07-24T13:00:00.000Z');
    const secondTime = new Date('2026-07-24T14:00:00.000Z');
    for (const [suffix, time, status] of [
      ['first', firstTime, 'CREATED'],
      ['second', secondTime, 'SUBSCRIBED'],
    ] as const) {
      const inboxId = `${RUN_ID}.inbox.${suffix}`;
      const workerId = `${RUN_ID}.worker.${suffix}`;
      await seedInbox({
        id: inboxId, tenantId: TENANT_A, organizationId: ORG_A,
        providerMessageId: `${RUN_ID}.message.${suffix}`, providerReferenceMessageId: null,
        rawBodySha256: suffix === 'first' ? 'b'.repeat(64) : 'c'.repeat(64),
        occurredAt: time, workerId,
      });
      const result = await repository.applyVerifiedInbox(USER_A, command({
        inboxEntryId: inboxId, workerId, providerMessageId: `${RUN_ID}.message.${suffix}`,
        rawBodySha256: suffix === 'first' ? 'b'.repeat(64) : 'c'.repeat(64),
        providerOccurredAt: time,
        records: [record({ sdizID: sdizId, sdizNumber, status })],
        idempotencySuffix: suffix,
      }));
      expect(result.kind).toBe('APPLIED');
    }
    const current = await repository.list(USER_A, { sdizId });
    expect(current).toHaveLength(1);
    expect(current[0]).toMatchObject({ status: 'SUBSCRIBED', version: '1' });

    const staleInbox = `${RUN_ID}.inbox.stale`;
    const staleWorker = `${RUN_ID}.worker.stale`;
    await seedInbox({
      id: staleInbox, tenantId: TENANT_A, organizationId: ORG_A,
      providerMessageId: `${RUN_ID}.message.stale`, providerReferenceMessageId: null,
      rawBodySha256: 'd'.repeat(64), occurredAt: firstTime, workerId: staleWorker,
    });
    const stale = await repository.applyVerifiedInbox(USER_A, command({
      inboxEntryId: staleInbox, workerId: staleWorker,
      providerMessageId: `${RUN_ID}.message.stale`, rawBodySha256: 'd'.repeat(64),
      providerOccurredAt: firstTime,
      records: [record({ sdizID: sdizId, sdizNumber, status: 'CANCELED' })],
      idempotencySuffix: 'stale',
    }));
    expect(stale).toMatchObject({ kind: 'QUARANTINED', conflictCode: 'FGIS_SDIZ_STALE_PROVIDER_EVENT' });

    const conflictInbox = `${RUN_ID}.inbox.same-time-conflict`;
    const conflictWorker = `${RUN_ID}.worker.same-time-conflict`;
    await seedInbox({
      id: conflictInbox, tenantId: TENANT_A, organizationId: ORG_A,
      providerMessageId: `${RUN_ID}.message.same-time-conflict`, providerReferenceMessageId: null,
      rawBodySha256: 'e'.repeat(64), occurredAt: secondTime, workerId: conflictWorker,
    });
    const conflict = await repository.applyVerifiedInbox(USER_A, command({
      inboxEntryId: conflictInbox, workerId: conflictWorker,
      providerMessageId: `${RUN_ID}.message.same-time-conflict`, rawBodySha256: 'e'.repeat(64),
      providerOccurredAt: secondTime,
      records: [record({ sdizID: sdizId, sdizNumber, status: 'EXTINGUISHED' })],
      idempotencySuffix: 'same-time-conflict',
    }));
    expect(conflict).toMatchObject({
      kind: 'QUARANTINED',
      conflictCode: 'FGIS_SDIZ_SAME_TIME_FINGERPRINT_CONFLICT',
    });
    expect((await repository.list(USER_A, { sdizId }))[0]?.status).toBe('SUBSCRIBED');
  });

  it('rejects missing live lease and unverified input', async () => {
    const expiredId = `${RUN_ID}.inbox.expired`;
    const workerId = `${RUN_ID}.worker.expired`;
    const occurredAt = new Date('2026-07-24T15:00:00.000Z');
    await seedInbox({
      id: expiredId, tenantId: TENANT_A, organizationId: ORG_A,
      providerMessageId: `${RUN_ID}.message.expired`, providerReferenceMessageId: null,
      rawBodySha256: 'f'.repeat(64), occurredAt, workerId,
      leaseExpiresAt: new Date(Date.now() - 60_000),
    });
    await expect(repository.applyVerifiedInbox(USER_A, command({
      inboxEntryId: expiredId, workerId, providerMessageId: `${RUN_ID}.message.expired`,
      rawBodySha256: 'f'.repeat(64), providerOccurredAt: occurredAt,
      records: [record({ sdizID: `${RUN_ID}.sdiz.expired`, sdizNumber: `${RUN_ID}.number.expired` })],
      idempotencySuffix: 'expired',
    }))).rejects.toMatchObject({ code: 'INBOX_LEASE_INVALID' });

    const unverifiedId = `${RUN_ID}.inbox.unverified`;
    const unverifiedWorker = `${RUN_ID}.worker.unverified`;
    await seedInbox({
      id: unverifiedId, tenantId: TENANT_A, organizationId: ORG_A,
      providerMessageId: `${RUN_ID}.message.unverified`, providerReferenceMessageId: null,
      rawBodySha256: '1'.repeat(64), occurredAt, workerId: unverifiedWorker,
      signatureStatus: 'INVALID',
    });
    await expect(repository.applyVerifiedInbox(USER_A, command({
      inboxEntryId: unverifiedId, workerId: unverifiedWorker,
      providerMessageId: `${RUN_ID}.message.unverified`, rawBodySha256: '1'.repeat(64),
      providerOccurredAt: occurredAt,
      records: [record({ sdizID: `${RUN_ID}.sdiz.unverified`, sdizNumber: `${RUN_ID}.number.unverified` })],
      idempotencySuffix: 'unverified',
    }))).rejects.toMatchObject({ code: 'INBOX_AUTHORITY_MISMATCH' });
  });

  it('enforces tenant and organization isolation in projection reads', async () => {
    const inboxId = `${RUN_ID}.inbox.tenant-b`;
    const workerId = `${RUN_ID}.worker.tenant-b`;
    const occurredAt = new Date('2026-07-24T16:00:00.000Z');
    await seedInbox({
      id: inboxId, tenantId: TENANT_B, organizationId: ORG_B,
      providerMessageId: `${RUN_ID}.message.tenant-b`, providerReferenceMessageId: null,
      rawBodySha256: '2'.repeat(64), occurredAt, workerId,
    });
    const sdizId = `${RUN_ID}.sdiz.tenant-b`;
    await repository.applyVerifiedInbox(USER_B, command({
      inboxEntryId: inboxId, workerId, providerMessageId: `${RUN_ID}.message.tenant-b`,
      rawBodySha256: '2'.repeat(64), providerOccurredAt: occurredAt,
      records: [record({ sdizID: sdizId, sdizNumber: `${RUN_ID}.number.tenant-b` })],
      idempotencySuffix: 'tenant-b',
    }));
    expect(await repository.list(USER_A, { sdizId })).toEqual([]);
    expect(await repository.list(USER_B, { sdizId })).toHaveLength(1);
    await expect(repository.list({ ...USER_A, role: Role.BUYER }, { limit: 10 }))
      .rejects.toBeInstanceOf(FgisGrainSdizProjectionRepositoryError);
  });
});
