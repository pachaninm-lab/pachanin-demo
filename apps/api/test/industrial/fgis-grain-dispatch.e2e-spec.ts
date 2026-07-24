import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import {
  FGIS_GRAIN_OUTBOX_EVENT_TYPE,
  type FgisGrainOutboundDispatchPayload,
} from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.dispatch.contract';
import {
  FgisGrainDispatchRepository,
  type EnqueueFgisGrainDispatchCommand,
} from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-dispatch.repository';

const describePostgres = process.env.PC_CROP_08D_POSTGRESQL === '1'
  ? describe
  : describe.skip;
const RUN_ID = `pc-crop-08d.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT_A = `${RUN_ID}.tenant-a`;
const TENANT_B = `${RUN_ID}.tenant-b`;
const ORG_A = `${RUN_ID}.org-a`;
const ORG_B = `${RUN_ID}.org-b`;

let prisma: PrismaService;
let repository: FgisGrainDispatchRepository;

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
  };
}

const USER_A = actor(TENANT_A, ORG_A, 'a');
const USER_B = actor(TENANT_B, ORG_B, 'b');

function command(overrides: Partial<EnqueueFgisGrainDispatchCommand> = {}): EnqueueFgisGrainDispatchCommand {
  return {
    commandId: `${RUN_ID}.command`,
    idempotencyKey: `${RUN_ID}.same-business-key`,
    reason: 'Передача подготовлена после серверной проверки официального контракта',
    transportOperation: 'SendRequest',
    businessOperationCode: 'CREATE_SDIZ',
    messageId: 'f47ac10b-58cc-11cf-a447-001122334455',
    referenceMessageId: 'f47ac10b-58cc-11cf-a447-001122334455',
    messageDataId: 'message-data-08d',
    unsignedEnvelopeReference: `object-store://${RUN_ID}/unsigned-envelope.xml`,
    unsignedEnvelopeSha256: 'a'.repeat(64),
    unsignedEnvelopeSizeBytes: 512,
    messageDataSha256: 'b'.repeat(64),
    providerConfigurationReference: `config://${RUN_ID}/fgis-sandbox`,
    correlationId: `${RUN_ID}.correlation`,
    causationId: `${RUN_ID}.causation`,
    ...overrides,
  };
}

function asPayload(value: unknown): FgisGrainOutboundDispatchPayload {
  return value as FgisGrainOutboundDispatchPayload;
}

describePostgres('PC-CROP-08D PostgreSQL FGIS Grain dispatch authority', () => {
  jest.setTimeout(120_000);

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new FgisGrainDispatchRepository(
      new RlsTransactionService(prisma),
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('atomically persists one immutable audit and canonical outbox row, then replays', async () => {
    const input = command();
    const applied = await repository.enqueue(USER_A, input);
    expect(applied).toMatchObject({
      state: 'PENDING',
      replayed: false,
      providerConfirmed: false,
      operationalStatus: 'NOT_ATTESTED',
    });

    const replay = await repository.enqueue(USER_A, input);
    expect(replay).toEqual({ ...applied, replayed: true });

    const evidence = await prisma.$queryRaw<Array<{
      auditCount: bigint;
      outboxCount: bigint;
      status: string;
      confirmedAt: Date | null;
      payload: unknown;
      auditHash: string;
      auditPrevHash: string | null;
    }>>(Prisma.sql`
      SELECT
        (SELECT count(*) FROM public."audit_events"
          WHERE "runtimeIdempotencyKey" = ${applied.idempotencyKey}) AS "auditCount",
        (SELECT count(*) FROM public."outbox_entries"
          WHERE "idempotencyKey" = ${applied.idempotencyKey}) AS "outboxCount",
        o."status", o."confirmedAt", o."payload",
        a."hash" AS "auditHash", a."prevHash" AS "auditPrevHash"
      FROM public."outbox_entries" o
      JOIN public."audit_events" a ON a."id" = o."auditId"
      WHERE o."id" = ${applied.outboxId}
    `);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      auditCount: 1n,
      outboxCount: 1n,
      status: 'PENDING',
      confirmedAt: null,
    });
    expect(evidence[0]?.auditHash).toMatch(/^[a-f0-9]{64}$/u);
    const payload = asPayload(evidence[0]?.payload);
    expect(payload).toMatchObject({
      tenantId: TENANT_A,
      organizationId: ORG_A,
      adapterCode: 'FGIS_ZERNO',
      schemaVersion: 'pc-crop.fgis-grain-outbound-dispatch.v1',
      providerConfigurationReference: input.providerConfigurationReference,
      unsignedEnvelopeReference: input.unsignedEnvelopeReference,
    });
    expect(JSON.stringify(payload)).not.toMatch(
      /rawXml|privateKey|certificateBytes|credentialBytes|password|token|signatureBytes/iu,
    );
  });

  it('rejects a reused idempotency key when any authority field changes', async () => {
    const input = command({
      idempotencyKey: `${RUN_ID}.mismatch-key`,
      correlationId: `${RUN_ID}.mismatch-correlation`,
    });
    await repository.enqueue(USER_A, input);
    await expect(repository.enqueue(USER_A, {
      ...input,
      unsignedEnvelopeSha256: 'c'.repeat(64),
    })).rejects.toBeInstanceOf(ConflictException);
    await expect(repository.enqueue(USER_A, {
      ...input,
      reason: 'Другая причина не может использовать уже связанную идемпотентность',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('derives tenant and organization from the server context and isolates the same client key', async () => {
    const shared = command({
      idempotencyKey: `${RUN_ID}.tenant-isolation-key`,
      correlationId: `${RUN_ID}.tenant-isolation-correlation`,
    });
    const receiptA = await repository.enqueue(USER_A, shared);
    const receiptB = await repository.enqueue(USER_B, shared);
    expect(receiptA.idempotencyKey).not.toBe(receiptB.idempotencyKey);
    expect(receiptA.outboxId).not.toBe(receiptB.outboxId);

    const rows = await prisma.$queryRaw<Array<{
      id: string;
      type: string;
      payload: unknown;
      status: string;
      confirmedAt: Date | null;
    }>>(Prisma.sql`
      SELECT "id", "type", "payload", "status", "confirmedAt"
      FROM public."outbox_entries"
      WHERE "id" IN (${receiptA.outboxId}, ${receiptB.outboxId})
      ORDER BY "id"
    `);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => asPayload(row.payload).tenantId)))
      .toEqual(new Set([TENANT_A, TENANT_B]));
    expect(new Set(rows.map((row) => asPayload(row.payload).organizationId)))
      .toEqual(new Set([ORG_A, ORG_B]));
    expect(rows.every((row) =>
      row.type === FGIS_GRAIN_OUTBOX_EVENT_TYPE
      && row.status === 'PENDING'
      && row.confirmedAt === null)).toBe(true);
  });
});
