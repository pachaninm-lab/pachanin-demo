import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import {
  RegulatoryInboxRepositoryError,
  RegulatoryIntegrationInboxRepository,
  type RegulatoryInboxReceiveCommand,
} from '../../src/modules/regulatory-integration/regulatory-integration.inbox.repository';
import {
  RegulatoryInboxLifecycleError,
  RegulatoryIntegrationInboxLifecycleRepository,
} from '../../src/modules/regulatory-integration/regulatory-integration.inbox-lifecycle.repository';

jest.setTimeout(120_000);

const RUN_ID = `pc-crop-07a.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT_A = `${RUN_ID}.tenant-a`;
const TENANT_B = `${RUN_ID}.tenant-b`;
const ORG_A = `${RUN_ID}.org-a`;
const ORG_B = `${RUN_ID}.org-b`;

let prismaA: PrismaService;
let prismaB: PrismaService;
let inboxA: RegulatoryIntegrationInboxRepository;
let inboxB: RegulatoryIntegrationInboxRepository;
let lifecycleA: RegulatoryIntegrationInboxLifecycleRepository;
let lifecycleB: RegulatoryIntegrationInboxLifecycleRepository;

function user(tenantId: string, orgId: string, suffix: string): RequestUser {
  return {
    id: `${RUN_ID}.user-${suffix}`,
    orgId,
    tenantId,
    role: Role.SUPPORT_MANAGER,
    email: `${suffix}@industrial.invalid`,
    fullName: `Industrial ${suffix}`,
    sessionId: `${RUN_ID}.session-${suffix}`,
    mfaVerified: true,
  };
}

const USER_A = user(TENANT_A, ORG_A, 'a');
const USER_B = user(TENANT_B, ORG_B, 'b');

function receiveCommand(
  externalEventId: string,
  rawBodySha256 = 'a'.repeat(64),
): RegulatoryInboxReceiveCommand {
  return {
    adapterIdentity: {
      adapterCode: 'industrial-adapter',
      adapterVersion: '1.0.0',
      mappingVersion: '1.0.23',
      environment: 'PRE_PRODUCTION',
      capabilities: [
        'INBOUND_EVENTS',
        'SIGNATURE_VERIFICATION',
        'SCHEMA_MAPPING',
        'PROVIDER_ACKNOWLEDGEMENT',
      ],
    },
    envelope: {
      provider: 'industrial-provider',
      externalEventId,
      schemaVersion: '1.0.23',
      mappingVersion: '1.0.23',
      occurredAt: '2026-07-23T10:00:00.000Z',
      rawBodySha256,
      signature: {
        algorithm: 'GOST-2012',
        keyReference: 'industrial-key',
        keyVersion: '1',
        signatureVersion: '1',
        verificationPolicyVersion: '2026-07',
      },
      correlationId: `${RUN_ID}.correlation.${externalEventId}`,
      causationId: null,
    },
    evidenceReference: `evidence://${RUN_ID}/${externalEventId}/${rawBodySha256.slice(0, 8)}`,
    verificationResult: null,
  };
}

async function seedOrganization(
  prisma: PrismaService,
  id: string,
  tenantId: string,
  innSuffix: string,
): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO public."organizations" (
      "id", "inn", "name", "status", "tenantId", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${`7700${innSuffix.padStart(6, '0')}`}, ${`Industrial ${innSuffix}`},
      'VERIFIED', ${tenantId}, clock_timestamp(), clock_timestamp()
    )
    ON CONFLICT ("id") DO NOTHING
  `);
}

async function verify(
  lifecycle: RegulatoryIntegrationInboxLifecycleRepository,
  actor: RequestUser,
  entryId: string,
): Promise<void> {
  await lifecycle.recordVerification(actor, entryId, {
    verified: true,
    verifiedAt: new Date().toISOString(),
    schemaVersion: '1.0.23',
    mappingVersion: '1.0.23',
    signatureKeyReference: 'industrial-key',
  });
}

beforeAll(async () => {
  prismaA = new PrismaService();
  prismaB = new PrismaService();
  await prismaA.$connect();
  await prismaB.$connect();

  await seedOrganization(prismaA, ORG_A, TENANT_A, '701');
  await seedOrganization(prismaA, ORG_B, TENANT_B, '702');

  const rlsA = new RlsTransactionService(prismaA);
  const rlsB = new RlsTransactionService(prismaB);
  inboxA = new RegulatoryIntegrationInboxRepository(rlsA);
  inboxB = new RegulatoryIntegrationInboxRepository(rlsB);
  lifecycleA = new RegulatoryIntegrationInboxLifecycleRepository(rlsA);
  lifecycleB = new RegulatoryIntegrationInboxLifecycleRepository(rlsB);
});

afterAll(async () => {
  await prismaA.$disconnect();
  await prismaB.$disconnect();
});

describe('PC-CROP-07A PostgreSQL 16 durable inbox acceptance', () => {
  it('commits before ACK eligibility and separates replay from immutable conflict', async () => {
    const externalId = `${RUN_ID}.receive-replay-conflict`;
    const first = await inboxA.receive(USER_A, receiveCommand(externalId));
    expect(first).toMatchObject({
      kind: 'INSERTED',
      providerAcknowledgementEligible: true,
    });
    if (first.kind === 'CONFLICT') throw new Error('unexpected conflict');

    const persisted = await prismaA.$queryRaw<Array<{
      id: string;
      providerAcknowledgedAt: Date | null;
    }>>(Prisma.sql`
      SELECT "id", "providerAcknowledgedAt"
      FROM public."regulatory_integration_inbox_entries"
      WHERE "id" = ${first.entryId}
    `);
    expect(persisted).toEqual([{
      id: first.entryId,
      providerAcknowledgedAt: null,
    }]);

    const replay = await inboxA.receive(USER_A, receiveCommand(externalId));
    expect(replay).toMatchObject({
      kind: 'REPLAY',
      entryId: first.entryId,
      providerAcknowledgementEligible: true,
    });

    const conflict = await inboxA.receive(
      USER_A,
      receiveCommand(externalId, 'b'.repeat(64)),
    );
    expect(conflict).toMatchObject({
      kind: 'CONFLICT',
      entryId: first.entryId,
      providerAcknowledgementEligible: false,
    });

    const conflicts = await prismaA.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint AS "count"
      FROM public."regulatory_integration_inbox_conflicts"
      WHERE "inboxEntryId" = ${first.entryId}
    `);
    expect(conflicts[0]?.count).toBe(1n);

    await expect(
      lifecycleA.markProviderAcknowledged(USER_A, first.entryId),
    ).resolves.toEqual({ kind: 'APPLIED', entryId: first.entryId });
    await expect(
      lifecycleA.markProviderAcknowledged(USER_A, first.entryId),
    ).resolves.toEqual({ kind: 'REPLAY', entryId: first.entryId });
  });

  it('gives two concurrent workers disjoint claims', async () => {
    const entryIds: string[] = [];
    for (let index = 0; index < 12; index += 1) {
      const received = await inboxA.receive(
        USER_A,
        receiveCommand(`${RUN_ID}.two-workers.${index}`),
      );
      if (received.kind === 'CONFLICT') throw new Error('unexpected conflict');
      await verify(lifecycleA, USER_A, received.entryId);
      entryIds.push(received.entryId);
    }

    const [batchA, batchB] = await Promise.all([
      inboxA.claimBatch(USER_A, 'worker-a', 8, 60),
      inboxB.claimBatch(USER_A, 'worker-b', 8, 60),
    ]);
    const claimed = [...batchA, ...batchB];
    const claimedIds = claimed.map((entry) => entry.id);
    expect(new Set(claimedIds).size).toBe(claimedIds.length);
    expect(new Set(claimedIds)).toEqual(new Set(entryIds));

    await Promise.all([
      ...batchA.map((entry) => inboxA.complete(
        USER_A,
        'worker-a',
        entry.id,
        false,
      )),
      ...batchB.map((entry) => inboxB.complete(
        USER_A,
        'worker-b',
        entry.id,
        false,
      )),
    ]);
  });

  it('reclaims an expired crash lease and rejects the stale worker', async () => {
    const received = await inboxA.receive(
      USER_A,
      receiveCommand(`${RUN_ID}.crash-reclaim`),
    );
    if (received.kind === 'CONFLICT') throw new Error('unexpected conflict');
    await verify(lifecycleA, USER_A, received.entryId);

    const [first] = await inboxA.claimBatch(USER_A, 'worker-crashed', 1, 1);
    expect(first.id).toBe(received.entryId);
    expect(await inboxB.claimBatch(USER_A, 'worker-recovery', 1, 60)).toHaveLength(0);

    await new Promise((resolve) => setTimeout(resolve, 1_300));
    const [recovered] = await inboxB.claimBatch(USER_A, 'worker-recovery', 1, 60);
    expect(recovered.id).toBe(received.entryId);

    await expect(
      inboxA.complete(USER_A, 'worker-crashed', received.entryId, false),
    ).rejects.toBeInstanceOf(RegulatoryInboxRepositoryError);
    await expect(
      inboxB.complete(USER_A, 'worker-recovery', received.entryId, false),
    ).resolves.toBeUndefined();
  });

  it('fails closed across tenant and organization boundaries', async () => {
    const externalId = `${RUN_ID}.tenant-boundary`;
    const receivedA = await inboxA.receive(USER_A, receiveCommand(externalId));
    if (receivedA.kind === 'CONFLICT') throw new Error('unexpected conflict');

    await expect(
      lifecycleB.markProviderAcknowledged(USER_B, receivedA.entryId),
    ).rejects.toBeInstanceOf(RegulatoryInboxLifecycleError);
    expect(await inboxB.claimBatch(USER_B, 'worker-foreign', 25, 60)).toHaveLength(0);

    const receivedB = await inboxB.receive(USER_B, receiveCommand(externalId));
    expect(receivedB).toMatchObject({ kind: 'INSERTED' });
    if (receivedB.kind === 'CONFLICT') throw new Error('unexpected conflict');
    expect(receivedB.entryId).not.toBe(receivedA.entryId);
  });

  it('quarantines failed verification and never exposes it to workers', async () => {
    const received = await inboxA.receive(
      USER_A,
      receiveCommand(`${RUN_ID}.quarantine`),
    );
    if (received.kind === 'CONFLICT') throw new Error('unexpected conflict');

    await lifecycleA.recordVerification(USER_A, received.entryId, {
      verified: false,
      verifiedAt: new Date().toISOString(),
      errorCode: 'UNSUPPORTED_SCHEMA_VERSION',
    });

    const claimed = await inboxA.claimBatch(USER_A, 'worker-quarantine', 25, 60);
    expect(claimed.some((entry) => entry.id === received.entryId)).toBe(false);
  });

  it('requires provider ACK before recording business acceptance', async () => {
    const received = await inboxA.receive(
      USER_A,
      receiveCommand(`${RUN_ID}.ack-before-business`),
    );
    if (received.kind === 'CONFLICT') throw new Error('unexpected conflict');
    await verify(lifecycleA, USER_A, received.entryId);
    const [claim] = await inboxA.claimBatch(USER_A, 'worker-ack', 1, 60);

    await expect(
      inboxA.complete(USER_A, 'worker-ack', claim.id, true),
    ).rejects.toThrow();

    await lifecycleA.markProviderAcknowledged(USER_A, received.entryId);
    await expect(
      inboxA.complete(USER_A, 'worker-ack', claim.id, true),
    ).resolves.toBeUndefined();
  });
});
