import {
  ConflictException,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import {
  FGIS_GRAIN_SDIZ_APPLICATION_SCHEMA_VERSION,
  assertFgisGrainSdizApplicationCommand,
  computeFgisGrainSdizBatchFingerprint,
  type FgisGrainSdizApplicationCommand,
  type ValidatedFgisGrainSdizRecord,
} from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-sdiz-registry.contract';
import { FgisGrainSdizRegistryRepository } from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-sdiz-registry.repository';

const describePostgres = process.env.PC_CROP_08F_POSTGRESQL === '1'
  ? describe
  : describe.skip;
const RUN_ID = `pc-crop-08f.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT_A = `${RUN_ID}.tenant-a`;
const TENANT_B = `${RUN_ID}.tenant-b`;
const ORG_A = `${RUN_ID}.org-a`;
const ORG_B = `${RUN_ID}.org-b`;
const USER_A = `${RUN_ID}.user-a`;
const USER_B = `${RUN_ID}.user-b`;
const WORKER = `${RUN_ID}.worker`;
let sequence = 1;

let prisma: PrismaService;
let repository: FgisGrainSdizRegistryRepository;

function uuidV1(prefix: number): string {
  return `${prefix.toString(16).padStart(8, '0')}-58cc-11cf-a447-001122334455`;
}

function nextAuthority(hashDigit = 'a') {
  const current = sequence++;
  return {
    inboxId: `${RUN_ID}.inbox-${current}`,
    messageId: uuidV1(0xf47ac100 + current),
    referenceMessageId: uuidV1(0xd9428800 + current),
    rawBodySha256: hashDigit.repeat(64),
  };
}

function requestUser(tenantId: string, orgId: string, id: string): RequestUser {
  return {
    id,
    email: `${id}@industrial.invalid`,
    role: Role.EXECUTIVE,
    tenantId,
    orgId,
    membershipId: `${id}.membership`,
    sessionId: `${id}.session`,
    mfaVerified: true,
  };
}

const CONTEXT_A = requestUser(TENANT_A, ORG_A, USER_A);
const CONTEXT_B = requestUser(TENANT_B, ORG_B, USER_B);

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

function hash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function rawRecord(overrides: Record<string, unknown> = {}) {
  return {
    providerSdizId: 'provider-sdiz-1',
    sdizNumber: 'SDIZ-2026-0001',
    SDIZNumber: 'SDIZ-2026-0001',
    status: 'SUBSCRIBED',
    lotNumber: 'LOT-100',
    createLotNumber: 'CREATE-LOT-100',
    correctedBySDIZNumber: null,
    correctedSDIZNumber: null,
    extinctionId: null,
    extinctionRefusalId: null,
    providerOccurredAt: '2026-07-24T12:00:00.000Z',
    ...overrides,
  };
}

function normalizedRecord(raw: ReturnType<typeof rawRecord>): ValidatedFgisGrainSdizRecord {
  const normalized = {
    providerSdizId: String(raw.providerSdizId),
    sdizNumber: String(raw.sdizNumber ?? raw.SDIZNumber),
    status: raw.status as ValidatedFgisGrainSdizRecord['status'],
    lotNumber: raw.lotNumber === null ? null : String(raw.lotNumber),
    createLotNumber:
      raw.createLotNumber === null ? null : String(raw.createLotNumber),
    correctedBySdizNumber:
      raw.correctedBySDIZNumber === null
        ? null
        : String(raw.correctedBySDIZNumber),
    correctedSdizNumber:
      raw.correctedSDIZNumber === null
        ? null
        : String(raw.correctedSDIZNumber),
    extinctionId:
      raw.extinctionId === null ? null : String(raw.extinctionId),
    extinctionRefusalId:
      raw.extinctionRefusalId === null
        ? null
        : String(raw.extinctionRefusalId),
    providerOccurredAt: new Date(String(raw.providerOccurredAt)).toISOString(),
  };
  return {
    ...normalized,
    recordFingerprint: hash(normalized),
  };
}

function command(
  authority: ReturnType<typeof nextAuthority>,
  records: Array<ReturnType<typeof rawRecord>>,
): FgisGrainSdizApplicationCommand {
  const normalized = records
    .map(normalizedRecord)
    .sort((left, right) =>
      left.providerSdizId.localeCompare(right.providerSdizId, 'en'),
    );
  const candidate: FgisGrainSdizApplicationCommand = {
    schemaVersion: FGIS_GRAIN_SDIZ_APPLICATION_SCHEMA_VERSION,
    sourceInboxEntryId: authority.inboxId,
    workerId: WORKER,
    rawBodySha256: authority.rawBodySha256,
    messageId: authority.messageId,
    referenceMessageId: authority.referenceMessageId,
    batchFingerprint: computeFgisGrainSdizBatchFingerprint(normalized),
    records,
  };
  assertFgisGrainSdizApplicationCommand(candidate);
  return candidate;
}

async function seedAuthority(): Promise<void> {
  const now = new Date();
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO public."organizations" (
      "id", "inn", "name", "tenantId", "updatedAt"
    ) VALUES
      (${ORG_A}, ${`77${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`}, ${`${RUN_ID} Org A`}, ${TENANT_A}, ${now}),
      (${ORG_B}, ${`78${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`}, ${`${RUN_ID} Org B`}, ${TENANT_B}, ${now})
    ON CONFLICT ("id") DO NOTHING
  `);
  for (const context of [CONTEXT_A, CONTEXT_B]) {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO public."users" (
        "id", "email", "passwordHash", "fullName", "mfaEnabled", "updatedAt"
      ) VALUES (
        ${context.id}, ${context.email}, 'not-a-real-password-hash',
        ${context.id}, true, ${now}
      )
      ON CONFLICT ("id") DO NOTHING
    `);
  }
}

async function resetProjection(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE public."fgis_grain_sdiz_records", public."fgis_grain_sdiz_projection_batches" RESTART IDENTITY CASCADE',
  );
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM public."regulatory_integration_inbox_entries"
    WHERE "tenantId" IN (${TENANT_A}, ${TENANT_B})
  `);
}

async function insertInbox(
  authority: ReturnType<typeof nextAuthority>,
  options: {
    tenantId?: string;
    organizationId?: string;
    occurredAt?: string;
    state?: 'PROCESSING' | 'VERIFIED';
    signatureStatus?: 'VERIFIED' | 'PENDING';
    leaseOwner?: string | null;
    leaseExpiresAt?: Date | null;
    verificationResult?: unknown;
  } = {},
): Promise<void> {
  const tenantId = options.tenantId ?? TENANT_A;
  const organizationId = options.organizationId ?? ORG_A;
  const state = options.state ?? 'PROCESSING';
  const leaseOwner = state === 'PROCESSING'
    ? options.leaseOwner === undefined ? WORKER : options.leaseOwner
    : null;
  const leaseExpiresAt = state === 'PROCESSING'
    ? options.leaseExpiresAt === undefined
      ? new Date(Date.now() + 5 * 60_000)
      : options.leaseExpiresAt
    : null;
  const verificationResult = options.verificationResult ?? {
    verified: true,
    verifiedAt: new Date().toISOString(),
    schemaVersion: '1.0.23',
    mappingVersion: 'fgis-zerno-1.0.23-catalog.v1',
    signatureKeyReference: 'certificate-registry://fgis/test/1',
  };
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO public."regulatory_integration_inbox_entries" (
      "id", "tenantId", "organizationId", "adapterCode", "adapterVersion",
      "provider", "externalEventId", "schemaVersion", "mappingVersion",
      "environment", "capabilities", "occurredAt", "rawBodySha256",
      "evidenceReference", "signatureStatus", "signatureAlgorithm",
      "signatureKeyReference", "signatureKeyVersion", "verificationResult",
      "state", "attempts", "leaseOwner", "leaseExpiresAt", "correlationId"
    ) VALUES (
      ${authority.inboxId}, ${tenantId}, ${organizationId}, 'FGIS_ZERNO',
      '1.0.23', 'FGIS_ZERNO', ${authority.messageId}, '1.0.23',
      'fgis-zerno-1.0.23-catalog.v1', 'TEST',
      CAST('["INBOUND_EVENTS","SIGNATURE_VERIFICATION","SCHEMA_MAPPING"]' AS jsonb),
      ${new Date(options.occurredAt ?? '2026-07-24T12:00:00.000Z')},
      ${authority.rawBodySha256}, ${`evidence://fgis/${authority.inboxId}`},
      ${options.signatureStatus ?? 'VERIFIED'}, 'GOST-2012-256',
      'certificate-registry://fgis/test/1', '1',
      CAST(${JSON.stringify(verificationResult)} AS jsonb), ${state}, 1,
      ${leaseOwner}, ${leaseExpiresAt}, ${authority.referenceMessageId}
    )
  `);
}

describePostgres('PC-CROP-08F PostgreSQL SDIZ registry', () => {
  jest.setTimeout(180_000);

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await seedAuthority();
    repository = new FgisGrainSdizRegistryRepository(
      new RlsTransactionService(prisma),
    );
  });

  beforeEach(resetProjection);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('atomically applies verified inbox, projection, immutable audit and canonical outbox', async () => {
    const authority = nextAuthority('a');
    await insertInbox(authority);
    const records = [
      rawRecord(),
      rawRecord({
        providerSdizId: 'provider-sdiz-2',
        sdizNumber: 'SDIZ-2026-0002',
        SDIZNumber: 'SDIZ-2026-0002',
        status: 'CREATED',
      }),
    ];
    const applied = await repository.applyVerifiedInbox(
      CONTEXT_A,
      command(authority, records),
    );
    expect(applied).toMatchObject({
      recordCount: 2,
      replayed: false,
      inboxState: 'PROCESSED',
      businessAccepted: false,
      operationalStatus: 'NOT_ATTESTED',
    });
    const rows = await prisma.$queryRaw<Array<{
      batchCount: bigint;
      recordCount: bigint;
      auditCount: bigint;
      outboxCount: bigint;
      state: string;
      linkedType: string | null;
      linkedId: string | null;
      businessAcceptedAt: Date | null;
    }>>(Prisma.sql`
      SELECT
        (SELECT count(*) FROM public."fgis_grain_sdiz_projection_batches" WHERE "id" = ${applied.batchId}) AS "batchCount",
        (SELECT count(*) FROM public."fgis_grain_sdiz_records" WHERE "sourceBatchId" = ${applied.batchId}) AS "recordCount",
        (SELECT count(*) FROM public."audit_events" WHERE "id" = ${applied.auditId}) AS "auditCount",
        (SELECT count(*) FROM public."outbox_entries" WHERE "id" = ${applied.outboxEntryId}) AS "outboxCount",
        "state", "linkedDomainOperationType" AS "linkedType",
        "linkedDomainOperationId" AS "linkedId", "businessAcceptedAt"
      FROM public."regulatory_integration_inbox_entries"
      WHERE "id" = ${authority.inboxId}
    `);
    expect(rows[0]).toEqual({
      batchCount: 1n,
      recordCount: 2n,
      auditCount: 1n,
      outboxCount: 1n,
      state: 'PROCESSED',
      linkedType: 'FGIS_SDIZ_PROJECTION_BATCH',
      linkedId: applied.batchId,
      businessAcceptedAt: null,
    });
    await expect(prisma.$executeRaw(Prisma.sql`
      UPDATE public."fgis_grain_sdiz_projection_batches"
      SET "recordCount" = 9 WHERE "id" = ${applied.batchId}
    `)).rejects.toThrow(/immutable/iu);
  });

  it('replays the same inbox and rejects payload mismatch', async () => {
    const authority = nextAuthority('b');
    await insertInbox(authority);
    const original = command(authority, [rawRecord()]);
    const applied = await repository.applyVerifiedInbox(CONTEXT_A, original);
    const replay = await repository.applyVerifiedInbox(CONTEXT_A, original);
    expect(replay).toEqual({ ...applied, replayed: true });
    await expect(repository.applyVerifiedInbox(
      CONTEXT_A,
      command(authority, [rawRecord({ status: 'CANCELED' })]),
    )).rejects.toBeInstanceOf(ConflictException);
  });

  it('applies monotonic updates and rejects stale or same-time conflicting state', async () => {
    const first = nextAuthority('c');
    await insertInbox(first);
    await repository.applyVerifiedInbox(
      CONTEXT_A,
      command(first, [rawRecord()]),
    );

    const second = nextAuthority('d');
    await insertInbox(second, { occurredAt: '2026-07-25T12:00:00.000Z' });
    await repository.applyVerifiedInbox(
      CONTEXT_A,
      command(second, [rawRecord({
        status: 'CANCELED',
        providerOccurredAt: '2026-07-25T12:00:00.000Z',
      })]),
    );
    const view = await repository.getByProviderSdizId(
      CONTEXT_A,
      'provider-sdiz-1',
    );
    expect(view).toMatchObject({
      status: 'CANCELED',
      version: '1',
      providerMessageId: second.messageId,
    });

    const stale = nextAuthority('e');
    await insertInbox(stale, { occurredAt: '2026-07-23T12:00:00.000Z' });
    await expect(repository.applyVerifiedInbox(
      CONTEXT_A,
      command(stale, [rawRecord({
        providerOccurredAt: '2026-07-23T12:00:00.000Z',
      })]),
    )).rejects.toBeInstanceOf(ConflictException);

    const conflict = nextAuthority('f');
    await insertInbox(conflict, { occurredAt: '2026-07-25T12:00:00.000Z' });
    await expect(repository.applyVerifiedInbox(
      CONTEXT_A,
      command(conflict, [rawRecord({
        status: 'EXTINGUISHED',
        providerOccurredAt: '2026-07-25T12:00:00.000Z',
      })]),
    )).rejects.toBeInstanceOf(ConflictException);
  });

  it('fails closed for missing verification, lost lease or hash mismatch', async () => {
    const pending = nextAuthority('1');
    await insertInbox(pending, { signatureStatus: 'PENDING' });
    await expect(repository.applyVerifiedInbox(
      CONTEXT_A,
      command(pending, [rawRecord()]),
    )).rejects.toBeInstanceOf(PreconditionFailedException);

    const expired = nextAuthority('2');
    await insertInbox(expired, {
      leaseExpiresAt: new Date(Date.now() - 1000),
    });
    await expect(repository.applyVerifiedInbox(
      CONTEXT_A,
      command(expired, [rawRecord()]),
    )).rejects.toBeInstanceOf(PreconditionFailedException);

    const stored = nextAuthority('3');
    await insertInbox(stored);
    const mismatched = { ...stored, rawBodySha256: '4'.repeat(64) };
    await expect(repository.applyVerifiedInbox(
      CONTEXT_A,
      command(mismatched, [rawRecord()]),
    )).rejects.toBeInstanceOf(ConflictException);
  });

  it('isolates projections by tenant and organization', async () => {
    const authority = nextAuthority('5');
    await insertInbox(authority);
    await repository.applyVerifiedInbox(
      CONTEXT_A,
      command(authority, [rawRecord()]),
    );
    await expect(repository.getByProviderSdizId(
      CONTEXT_B,
      'provider-sdiz-1',
    )).rejects.toBeInstanceOf(NotFoundException);
  });
});
