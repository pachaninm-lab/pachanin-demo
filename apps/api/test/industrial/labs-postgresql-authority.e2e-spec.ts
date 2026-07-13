import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import type { ExecuteDealCommandDto } from '../../src/modules/deals/dto/execute-deal-command.dto';
import type { DealActionId } from '../../src/modules/deals/deal-command.policy';
import type { RequestUser } from '../../src/common/types/request-user';
import { Role } from '../../src/common/types/request-user';
import { AuthorizedPrismaLabRepository } from '../../src/modules/labs/authorized-prisma-lab.repository';
import {
  createRememberedInstance,
  destroyInstance,
  payloadForAction,
  prepareLaboratoryLifecycle,
  provisionDeal,
  type DealFixture,
  type ServiceInstance,
} from './harness';

jest.setTimeout(240_000);

const PRE_RESERVE_SEQUENCE: ReadonlyArray<{ actionId: DealActionId; userKey: string }> = [
  { actionId: 'approve_admission', userKey: 'compliance' },
  { actionId: 'publish_auction', userKey: 'farmer' },
  { actionId: 'place_winning_bid', userKey: 'buyer' },
  { actionId: 'seller_sign_contract', userKey: 'farmer' },
  { actionId: 'buyer_sign_contract', userKey: 'buyer' },
  { actionId: 'request_reserve', userKey: 'buyer' },
];

const TO_INSPECTION_SEQUENCE: ReadonlyArray<{ actionId: DealActionId; userKey: string }> = [
  { actionId: 'assign_logistics', userKey: 'logistician' },
  { actionId: 'confirm_loading', userKey: 'driver' },
  { actionId: 'start_transit', userKey: 'driver' },
  { actionId: 'confirm_arrival', userKey: 'driver' },
  { actionId: 'confirm_weight', userKey: 'elevator' },
  { actionId: 'confirm_inspection', userKey: 'surveyor' },
];

async function currentDeal(instance: ServiceInstance, dealId: string) {
  return instance.prisma.deal.findUniqueOrThrow({
    where: { id: dealId },
    select: { id: true, status: true, updatedAt: true, version: true },
  });
}

async function executeAction(
  instance: ServiceInstance,
  fixture: DealFixture,
  actionId: DealActionId,
  user: RequestUser,
  options: Readonly<{
    commandId?: string;
    idempotencyKey?: string;
    payload?: Prisma.InputJsonObject;
  }> = {},
) {
  const deal = await currentDeal(instance, fixture.dealId);
  const dto: ExecuteDealCommandDto = {
    commandId: options.commandId ?? `cmd:${fixture.dealId}:${actionId}`,
    idempotencyKey: options.idempotencyKey ?? `idem:${fixture.dealId}:${actionId}`,
    expectedUpdatedAt: deal.updatedAt.toISOString(),
    expectedVersion: deal.version.toString(),
    payload: options.payload ?? payloadForAction(fixture, actionId),
  };
  return instance.gateway.executeUser(fixture.dealId, actionId, dto, user);
}

function reserveCallback(fixture: DealFixture) {
  return {
    dealId: fixture.dealId,
    eventId: `bank-event-${fixture.dealId}-RESERVE-1`,
    operation: 'RESERVE' as const,
    status: 'SUCCESS' as const,
    bankRef: `BANK-RESERVE-${fixture.dealId}`,
    operationId: `bank-reserve:${fixture.dealId}`,
    partnerId: 'safe-deals',
  };
}

async function driveToLaboratory(instance: ServiceInstance, fixture: DealFixture): Promise<void> {
  for (const step of PRE_RESERVE_SEQUENCE) {
    await executeAction(instance, fixture, step.actionId, fixture.users[step.userKey]);
  }
  await instance.gateway.executeBankCallback(reserveCallback(fixture));
  for (const step of TO_INSPECTION_SEQUENCE) {
    await executeAction(instance, fixture, step.actionId, fixture.users[step.userKey]);
  }
  expect((await currentDeal(instance, fixture.dealId)).status).toBe('INSPECTION_CONFIRMED');
}

async function createPreparedFixture(slug: string): Promise<{
  instance: ServiceInstance;
  fixture: DealFixture;
}> {
  const instance = await createRememberedInstance();
  const fixture = await provisionDeal(instance.prisma, slug, 240_000_000n);
  await driveToLaboratory(instance, fixture);
  await prepareLaboratoryLifecycle(instance, fixture);
  return { instance, fixture };
}

async function createPurposeEvidence(
  instance: ServiceInstance,
  fixture: DealFixture,
  user: RequestUser,
  purpose: string,
  suffix: string,
  metadata: Prisma.InputJsonObject,
): Promise<string> {
  const body = JSON.stringify({ purpose, suffix, metadata });
  const sha256 = createHash('sha256').update(body).digest('hex');
  const requested = await instance.storage.requestUpload({
    dealId: fixture.dealId,
    filename: `${suffix}.json`,
    mimeType: 'application/json',
    sizeBytes: Buffer.byteLength(body),
  }, user);
  instance.storageAdapter.put(requested.objectKey, {
    sizeBytes: Buffer.byteLength(body),
    contentType: 'application/json',
    sha256,
    eTag: `e2e-${sha256.slice(0, 16)}`,
  });
  await instance.rls.withTrustedContext(user, async (tx) => {
    const updated = await tx.dealDocument.updateMany({
      where: { id: requested.fileId, status: 'UPLOAD_PENDING', version: 1, isImmutable: false },
      data: { metadata: { labPurpose: purpose, ...metadata } },
    });
    expect(updated.count).toBe(1);
  });
  const verified = await instance.storage.confirmUpload(requested.fileId, sha256, user);
  expect(verified.status).toBe('VERIFIED');
  expect(verified.immutable).toBe(true);
  return requested.fileId;
}

function outsider(fixture: DealFixture, tenantId = fixture.users.lab.tenantId): RequestUser {
  return {
    id: `outsider-${fixture.dealId}`,
    email: `outsider-${fixture.dealId}@invalid.test`,
    fullName: 'Same-tenant outsider',
    role: Role.LAB,
    orgId: `outsider-org-${fixture.dealId}`,
    tenantId,
    sessionId: `outsider-session-${fixture.dealId}`,
    mfaVerified: true,
  };
}

async function finalizeDto(instance: ServiceInstance, fixture: DealFixture, key: string): Promise<ExecuteDealCommandDto> {
  const deal = await currentDeal(instance, fixture.dealId);
  return {
    commandId: `cmd:${fixture.dealId}:finalize_lab:${key}`,
    idempotencyKey: `idem:${fixture.dealId}:finalize_lab:${key}`,
    expectedUpdatedAt: deal.updatedAt.toISOString(),
    expectedVersion: deal.version.toString(),
    payload: payloadForAction(fixture, 'finalize_lab'),
  };
}

describe('IR-10.3 Labs PostgreSQL authority exploitation', () => {
  it('denies same-tenant outsider and cross-tenant reads under FORCE RLS', async () => {
    const { instance, fixture } = await createPreparedFixture('labs-scope');
    try {
      await expect(instance.labs.getById(fixture.sampleId, outsider(fixture))).rejects.toMatchObject({ status: 404 });
      await expect(
        instance.labs.getById(fixture.sampleId, outsider(fixture, 'cross-tenant-labs')),
      ).rejects.toMatchObject({ status: 404 });
    } finally {
      await destroyInstance(instance);
    }
  });

  it('prevents a privileged platform actor from impersonating an ANALYST', async () => {
    const { instance, fixture } = await createPreparedFixture('labs-privileged');
    try {
      const guarded = new AuthorizedPrismaLabRepository(instance.labs, instance.rls);
      const sample = await instance.prisma.labSample.findUniqueOrThrow({ where: { id: fixture.sampleId } });
      const evidenceRef = await createPurposeEvidence(
        instance,
        fixture,
        fixture.users.operator,
        'TEST',
        'privileged-test-attempt',
        {
          sampleId: fixture.sampleId,
          shipmentId: fixture.shipmentId,
          acceptanceId: fixture.acceptanceId,
          laboratoryOrgId: fixture.serviceOrgId,
        },
      );
      await expect(guarded.recordTest(fixture.sampleId, {
        commandId: `privileged-test-${fixture.dealId}`,
        idempotencyKey: `privileged-test-${fixture.dealId}`,
        expectedVersion: sample.version.toString(),
        metric: 'moisture',
        value: 12.5,
        unit: '%',
        methodCode: 'MOISTURE',
        equipmentCode: 'CONTROLLED_ANALYZER',
        evidenceRef,
        occurredAt: new Date().toISOString(),
      }, fixture.users.operator)).rejects.toMatchObject({ status: 403 });
    } finally {
      await destroyInstance(instance);
    }
  });

  it('rejects reordered custody and requires a continuous custody hash chain', async () => {
    const { instance, fixture } = await createPreparedFixture('labs-hash-chain');
    try {
      const events = await instance.prisma.$queryRaw<Array<{
        id: string;
        eventType: string;
        evidenceFileId: string;
        prevHash: string | null;
        hash: string;
      }>>(Prisma.sql`
        SELECT id, event_type AS "eventType", evidence_file_id AS "evidenceFileId",
               prev_hash AS "prevHash", hash
        FROM labs.sample_custody_events
        WHERE sample_id = ${fixture.sampleId}
        ORDER BY occurred_at, id
      `);
      expect(events.map((event) => event.eventType)).toEqual(
        expect.arrayContaining(['CREATED', 'COLLECTED', 'HANDOFF', 'RECEIVED', 'OPENED']),
      );
      for (let index = 0; index < events.length; index += 1) {
        expect(events[index].hash).toMatch(/^[a-f0-9]{64}$/);
        expect(events[index].prevHash).toBe(index === 0 ? null : events[index - 1].hash);
      }

      const handoff = events.find((event) => event.eventType === 'HANDOFF');
      const tail = events.at(-1);
      expect(handoff).toBeDefined();
      expect(tail).toBeDefined();
      await instance.rls.withTrustedContext(fixture.users.lab, async (tx) => {
        const material = `duplicate-handoff:${fixture.sampleId}:${tail!.hash}`;
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO labs.sample_custody_events (
            id, sample_id, tenant_id, event_type, from_status, to_status,
            actor_user_id, laboratory_org_id, evidence_file_id, command_id,
            idempotency_key, correlation_id, occurred_at, prev_hash, hash
          ) VALUES (
            ${`duplicate-handoff:${fixture.dealId}`}, ${fixture.sampleId},
            ${fixture.users.lab.tenantId}, 'HANDOFF', 'COLLECTED', 'IN_TRANSIT',
            ${fixture.users.lab.id}, ${fixture.serviceOrgId}, ${handoff!.evidenceFileId},
            ${`duplicate-handoff:${fixture.dealId}`}, ${`duplicate-handoff:${fixture.dealId}`},
            ${`duplicate-handoff:${fixture.dealId}`}, now(), ${tail!.hash},
            ${createHash('sha256').update(material).digest('hex')}
          )
        `);
      });

      await expect(
        instance.gateway.executeUser(
          fixture.dealId,
          'finalize_lab',
          await finalizeDto(instance, fixture, 'reordered-custody'),
          fixture.users.lab,
        ),
      ).rejects.toBeDefined();
      expect((await currentDeal(instance, fixture.dealId)).status).toBe('INSPECTION_CONFIRMED');
    } finally {
      await destroyInstance(instance);
    }
  });

  it('converges a two-instance idempotency race, survives restart and rejects payload mismatch', async () => {
    const { instance, fixture } = await createPreparedFixture('labs-two-instance');
    const second = await createRememberedInstance();
    try {
      const dto = await finalizeDto(instance, fixture, 'race');
      const outcomes = await Promise.allSettled([
        instance.gateway.executeUser(fixture.dealId, 'finalize_lab', dto, fixture.users.lab),
        second.gateway.executeUser(fixture.dealId, 'finalize_lab', dto, fixture.users.lab),
      ]);
      const fulfilled = outcomes.filter(
        (outcome): outcome is PromiseFulfilledResult<Record<string, unknown>> => outcome.status === 'fulfilled',
      );
      expect(fulfilled).toHaveLength(2);
      expect(fulfilled.map((outcome) => Boolean(outcome.value.duplicate)).sort()).toEqual([false, true]);

      expect(await instance.prisma.outboxEntry.count({
        where: { dealId: fixture.dealId, type: 'lab.protocol.finalized' },
      })).toBe(1);
      const protocolCount = await instance.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT count(*)::bigint AS count FROM labs.protocols WHERE sample_id = ${fixture.sampleId}
      `);
      expect(protocolCount[0].count).toBe(1n);

      await expect(second.gateway.executeUser(fixture.dealId, 'finalize_lab', {
        ...dto,
        payload: { sampleId: fixture.sampleId, signedEvidenceRef: 'foreign-evidence' },
      }, fixture.users.lab)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'IDEMPOTENCY_KEY_REUSED' }),
      });

      const restarted = await createRememberedInstance();
      try {
        const persisted = await restarted.prisma.labSample.findUniqueOrThrow({ where: { id: fixture.sampleId } });
        expect(persisted.status).toBe('FINALIZED');
        expect(await restarted.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT count(*)::bigint AS count FROM labs.protocols WHERE sample_id = ${fixture.sampleId}
        `)).toEqual([{ count: 1n }]);
      } finally {
        await destroyInstance(restarted);
      }
    } finally {
      await destroyInstance(second);
      await destroyInstance(instance);
    }
  });

  it('rejects foreign or wrong-purpose evidence and fully rolls back Deal, protocol, audit and outbox', async () => {
    const { instance, fixture } = await createPreparedFixture('labs-evidence-rollback');
    try {
      const beforeAudit = await instance.prisma.auditEvent.count({ where: { dealId: fixture.dealId } });
      const beforeOutbox = await instance.prisma.outboxEntry.count({ where: { dealId: fixture.dealId } });
      const dto = await finalizeDto(instance, fixture, 'wrong-purpose');
      await expect(instance.gateway.executeUser(fixture.dealId, 'finalize_lab', {
        ...dto,
        payload: { sampleId: fixture.sampleId, signedEvidenceRef: fixture.contractDocumentId },
      }, fixture.users.lab)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'LAB_PROTOCOL_EVIDENCE_NOT_PURPOSE_BOUND' }),
      });

      const [sample, deal, protocols, auditAfter, outboxAfter] = await Promise.all([
        instance.prisma.labSample.findUniqueOrThrow({ where: { id: fixture.sampleId } }),
        currentDeal(instance, fixture.dealId),
        instance.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT count(*)::bigint AS count FROM labs.protocols WHERE sample_id = ${fixture.sampleId}
        `),
        instance.prisma.auditEvent.count({ where: { dealId: fixture.dealId } }),
        instance.prisma.outboxEntry.count({ where: { dealId: fixture.dealId } }),
      ]);
      expect(sample.status).toBe('ANALYSIS_IN_PROGRESS');
      expect(deal.status).toBe('INSPECTION_CONFIRMED');
      expect(protocols[0].count).toBe(0n);
      expect(auditAfter).toBe(beforeAudit);
      expect(outboxAfter).toBe(beforeOutbox);
    } finally {
      await destroyInstance(instance);
    }
  });

  it('rejects expired accreditation and expired calibration without deleting correction history', async () => {
    const { instance, fixture } = await createPreparedFixture('labs-expiry-correction');
    try {
      const original = await instance.prisma.labTest.findFirstOrThrow({
        where: { sampleId: fixture.sampleId, parameter: 'moisture', supersedesId: null },
      });
      const sampleBeforeCorrection = await instance.prisma.labSample.findUniqueOrThrow({
        where: { id: fixture.sampleId },
      });
      const correctionEvidence = await createPurposeEvidence(
        instance,
        fixture,
        fixture.users.lab,
        'TEST',
        'moisture-correction',
        {
          sampleId: fixture.sampleId,
          shipmentId: fixture.shipmentId,
          acceptanceId: fixture.acceptanceId,
          laboratoryOrgId: fixture.serviceOrgId,
        },
      );
      await instance.labs.recordTest(fixture.sampleId, {
        commandId: `correction:${fixture.dealId}:moisture`,
        idempotencyKey: `correction:${fixture.dealId}:moisture`,
        expectedVersion: sampleBeforeCorrection.version.toString(),
        metric: 'moisture',
        value: 13.1,
        unit: '%',
        methodCode: 'MOISTURE',
        equipmentCode: 'CONTROLLED_ANALYZER',
        evidenceRef: correctionEvidence,
        occurredAt: new Date().toISOString(),
        supersedesId: original.id,
      }, fixture.users.lab);
      expect(await instance.prisma.labTest.count({ where: { sampleId: fixture.sampleId } })).toBe(3);
      expect(await instance.prisma.labTest.count({ where: { supersedesId: original.id } })).toBe(1);

      await instance.prisma.$executeRaw(Prisma.sql`
        UPDATE labs.equipment
        SET calibration_valid_until = '2020-01-01T00:00:00.000Z'::timestamptz
        WHERE tenant_id = ${fixture.users.lab.tenantId}
          AND laboratory_org_id = ${fixture.serviceOrgId}
      `);
      await expect(
        instance.gateway.executeUser(
          fixture.dealId,
          'finalize_lab',
          await finalizeDto(instance, fixture, 'expired-calibration'),
          fixture.users.lab,
        ),
      ).rejects.toBeDefined();
      expect(await instance.prisma.labTest.count({ where: { sampleId: fixture.sampleId } })).toBe(3);

      await instance.prisma.$executeRaw(Prisma.sql`
        UPDATE labs.equipment
        SET calibration_valid_until = '2035-01-01T00:00:00.000Z'::timestamptz
        WHERE tenant_id = ${fixture.users.lab.tenantId}
          AND laboratory_org_id = ${fixture.serviceOrgId}
      `);
      await instance.prisma.$executeRaw(Prisma.sql`
        UPDATE labs.laboratories
        SET valid_until = now() - interval '1 second'
        WHERE tenant_id = ${fixture.users.lab.tenantId}
          AND organization_id = ${fixture.serviceOrgId}
      `);
      await expect(
        instance.gateway.executeUser(
          fixture.dealId,
          'finalize_lab',
          await finalizeDto(instance, fixture, 'expired-accreditation'),
          fixture.users.lab,
        ),
      ).rejects.toBeDefined();
      expect((await currentDeal(instance, fixture.dealId)).status).toBe('INSPECTION_CONFIRMED');
      expect(await instance.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT count(*)::bigint AS count FROM labs.protocols WHERE sample_id = ${fixture.sampleId}
      `)).toEqual([{ count: 0n }]);
    } finally {
      await destroyInstance(instance);
    }
  });
});
