import { Prisma } from '@prisma/client';
import type { RequestUser } from '../../src/common/types/request-user';
import { Role } from '../../src/common/types/request-user';
import {
  createRememberedInstance,
  destroyInstance,
  payloadForAction,
  prepareLaboratoryLifecycle,
  provisionDeal,
  type DealFixture,
  type ServiceInstance,
} from './harness';

const PRE_LAB_ACTIONS = [
  'admit_parties',
  'seller_sign_contract',
  'buyer_sign_contract',
  'open_reserve',
  'confirm_reserve',
  'choose_funding',
  'mark_paid',
  'assign_logistics',
  'confirm_loading',
  'start_transit',
  'confirm_arrival',
  'confirm_weight',
  'confirm_inspection',
] as const;

type ActionId = (typeof PRE_LAB_ACTIONS)[number] | 'finalize_lab';

function actorKey(actionId: ActionId): string {
  const map: Record<ActionId, string> = {
    admit_parties: 'compliance',
    seller_sign_contract: 'farmer',
    buyer_sign_contract: 'buyer',
    open_reserve: 'accounting',
    confirm_reserve: 'accounting',
    choose_funding: 'buyer',
    mark_paid: 'accounting',
    assign_logistics: 'logistician',
    confirm_loading: 'farmer',
    start_transit: 'driver',
    confirm_arrival: 'elevator',
    confirm_weight: 'elevator',
    confirm_inspection: 'surveyor',
    finalize_lab: 'lab',
  };
  return map[actionId];
}

async function executeAction(
  instance: ServiceInstance,
  fixture: DealFixture,
  actionId: ActionId,
  options: { commandId?: string; idempotencyKey?: string; payload?: Prisma.InputJsonObject } = {},
) {
  const workspace = await instance.gateway.getWorkspace(fixture.dealId, fixture.users.operator);
  const commandId = options.commandId ?? `cmd-${fixture.dealId}-${actionId}`;
  const idempotencyKey = options.idempotencyKey ?? `idem-${fixture.dealId}-${actionId}`;
  return instance.gateway.execute(
    fixture.dealId,
    actionId,
    {
      commandId,
      idempotencyKey,
      expectedUpdatedAt: workspace.deal.updatedAt,
      expectedVersion: workspace.deal.version,
      payload: options.payload ?? payloadForAction(fixture, actionId),
    },
    fixture.users[actorKey(actionId)],
  );
}

async function reserveCallback(instance: ServiceInstance, fixture: DealFixture): Promise<void> {
  const operation = await instance.prisma.bankOperation.findFirstOrThrow({
    where: { dealId: fixture.dealId, type: 'RESERVE' },
    orderBy: { createdAt: 'desc' },
  });
  await instance.commands.applyBankCallback({
    eventId: `evt-reserve-${fixture.dealId}`,
    operationId: operation.id,
    providerOperationId: operation.providerOperationId,
    bankRef: `bank-reserve-${fixture.dealId}`,
    provider: 'CI_BANK',
    type: 'RESERVE_CONFIRMED',
    status: 'SUCCEEDED',
    amountKopecks: fixture.totalKopecks.toString(),
    occurredAt: new Date().toISOString(),
  });
}

async function paymentCallback(instance: ServiceInstance, fixture: DealFixture): Promise<void> {
  const payment = await instance.prisma.payment.findFirstOrThrow({
    where: { dealId: fixture.dealId },
  });
  await instance.commands.applyBankCallback({
    eventId: `evt-payment-reserve-${fixture.dealId}`,
    operationId: `payment:${fixture.dealId}`,
    providerOperationId: `payment:${fixture.dealId}`,
    bankRef: `bank-payment-reserve-${fixture.dealId}`,
    provider: 'CI_BANK',
    type: 'RESERVE_CONFIRMED',
    status: 'SUCCEEDED',
    amountKopecks: (payment.amountKopecks ?? fixture.totalKopecks).toString(),
    occurredAt: new Date().toISOString(),
  });
}

async function driveToLaboratory(instance: ServiceInstance, fixture: DealFixture): Promise<void> {
  for (const actionId of PRE_LAB_ACTIONS) {
    if (actionId === 'confirm_reserve') await reserveCallback(instance, fixture);
    if (actionId === 'mark_paid') await paymentCallback(instance, fixture);
    await executeAction(instance, fixture, actionId);
  }
  const deal = await instance.prisma.deal.findUniqueOrThrow({ where: { id: fixture.dealId } });
  expect(deal.status).toBe('INSPECTION_CONFIRMED');
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
  const sha256 = require('crypto').createHash('sha256').update(body).digest('hex');
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
      data: {
        metadata: {
          labPurpose: purpose,
          ...metadata,
        },
      },
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

describe('IR-10.3 Labs PostgreSQL authority exploitation', () => {
  it('denies same-tenant outsider and cross-tenant reads under FORCE RLS', async () => {
    const { instance, fixture } = await createPreparedFixture('labs-scope');
    try {
      await expect(instance.labs.getById(fixture.sampleId, outsider(fixture))).rejects.toMatchObject({
        status: 404,
      });
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
      await expect(instance.labs.recordTest(fixture.sampleId, {
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
      }, fixture.users.operator)).rejects.toBeDefined();
    } finally {
      await destroyInstance(instance);
    }
  });

  it('preserves an ordered continuous custody hash chain and rejects reordered custody', async () => {
    const { instance, fixture } = await createPreparedFixture('labs-hash-chain');
    try {
      const events = await instance.prisma.$queryRaw<Array<{
        eventType: string;
        prevHash: string | null;
        hash: string;
      }>>(Prisma.sql`
        SELECT event_type AS "eventType", prev_hash AS "prevHash", hash
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

      const sample = await instance.prisma.labSample.findUniqueOrThrow({ where: { id: fixture.sampleId } });
      await expect(instance.labs.recordCustody(fixture.sampleId, {
        commandId: `reordered-custody-${fixture.dealId}`,
        idempotencyKey: `reordered-custody-${fixture.dealId}`,
        expectedVersion: sample.version.toString(),
        eventType: 'HANDOFF',
        evidenceRef: fixture.evidence.lab,
        occurredAt: new Date().toISOString(),
      }, fixture.users.lab)).rejects.toBeDefined();
    } finally {
      await destroyInstance(instance);
    }
  });

  it('converges a two-instance exact idempotency race and rejects payload mismatch', async () => {
    const { instance, fixture } = await createPreparedFixture('labs-two-instance');
    const second = await createRememberedInstance();
    try {
      const workspace = await instance.gateway.getWorkspace(fixture.dealId, fixture.users.operator);
      const commandId = `labs-finalize-race-${fixture.dealId}`;
      const idempotencyKey = `labs-finalize-race-${fixture.dealId}`;
      const dto = {
        commandId,
        idempotencyKey,
        expectedUpdatedAt: workspace.deal.updatedAt,
        expectedVersion: workspace.deal.version,
        payload: payloadForAction(fixture, 'finalize_lab'),
      };
      const [first, replay] = await Promise.all([
        instance.gateway.execute(fixture.dealId, 'finalize_lab', dto, fixture.users.lab),
        second.gateway.execute(fixture.dealId, 'finalize_lab', dto, fixture.users.lab),
      ]);
      expect([Boolean(first.duplicate), Boolean(replay.duplicate)].sort()).toEqual([false, true]);

      const protocolCount = await instance.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT count(*)::bigint AS count FROM labs.protocols WHERE sample_id = ${fixture.sampleId}
      `);
      expect(protocolCount[0].count).toBe(1n);
      expect(await instance.prisma.outboxEntry.count({
        where: { dealId: fixture.dealId, type: 'lab.protocol.finalized' },
      })).toBe(1);

      await expect(second.gateway.execute(fixture.dealId, 'finalize_lab', {
        ...dto,
        payload: { sampleId: fixture.sampleId, signedEvidenceRef: 'foreign-evidence' },
      }, fixture.users.lab)).rejects.toMatchObject({ status: 409 });
    } finally {
      await destroyInstance(second);
      await destroyInstance(instance);
    }
  });

  it('rolls back protocol, Deal, audit and outbox when accreditation is expired', async () => {
    const { instance, fixture } = await createPreparedFixture('labs-expired-accreditation');
    try {
      await instance.prisma.$executeRaw(Prisma.sql`
        UPDATE labs.laboratories
        SET valid_until = now() - interval '1 second'
        WHERE tenant_id = ${fixture.users.lab.tenantId}
          AND organization_id = ${fixture.serviceOrgId}
      `);
      const beforeAudit = await instance.prisma.auditEvent.count({ where: { dealId: fixture.dealId } });
      const beforeOutbox = await instance.prisma.outboxEntry.count({ where: { dealId: fixture.dealId } });
      await expect(executeAction(instance, fixture, 'finalize_lab')).rejects.toBeDefined();

      const [sample, deal, protocols, auditAfter, outboxAfter] = await Promise.all([
        instance.prisma.labSample.findUniqueOrThrow({ where: { id: fixture.sampleId } }),
        instance.prisma.deal.findUniqueOrThrow({ where: { id: fixture.dealId } }),
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

  it('rejects expired calibration and keeps correction history for active aggregation', async () => {
    const { instance, fixture } = await createPreparedFixture('labs-expired-calibration-correction');
    try {
      await instance.prisma.$executeRaw(Prisma.sql`
        UPDATE labs.equipment
        SET calibration_valid_until = '2020-01-01T00:00:00.000Z'::timestamptz
        WHERE tenant_id = ${fixture.users.lab.tenantId}
          AND laboratory_org_id = ${fixture.serviceOrgId}
      `);
      await expect(executeAction(instance, fixture, 'finalize_lab')).rejects.toBeDefined();
      expect(await instance.prisma.labTest.count({ where: { sampleId: fixture.sampleId } })).toBe(2);
      // correction proof is completed by the dedicated correction command test;
      // this assertion ensures failed finalization does not erase historical facts.
    } finally {
      await destroyInstance(instance);
    }
  });
});
