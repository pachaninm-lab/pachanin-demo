import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import type { RequestUser } from '../../src/common/types/request-user';
import type { DealActionId } from '../../src/modules/deals/deal-command.policy';
import type { ExecuteDealCommandDto } from '../../src/modules/deals/dto/execute-deal-command.dto';
import type {
  LabOperationEvidencePurpose,
  LabProvisioningEvidencePurpose,
} from '../../src/modules/labs/dto/request-lab-evidence-upload.dto';
import {
  createRememberedInstance,
  destroyInstance,
  payloadForAction,
  provisionDeal,
  type DealFixture,
  type ServiceInstance,
} from './harness';

jest.setTimeout(240_000);

const FUTURE_AUTHORITY_AT = '2035-01-01T00:00:00.000Z';
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

type ActorType = 'SAMPLER' | 'COURIER' | 'RECEIVER' | 'ANALYST' | 'SIGNATORY';

type UploadRequest = Readonly<{
  fileId: string;
  objectKey: string;
}>;

async function currentDeal(instance: ServiceInstance, dealId: string) {
  return instance.prisma.deal.findUniqueOrThrow({
    where: { id: dealId },
    select: { status: true, updatedAt: true, version: true },
  });
}

async function executeAction(
  instance: ServiceInstance,
  fixture: DealFixture,
  actionId: DealActionId,
  user: RequestUser,
): Promise<void> {
  const deal = await currentDeal(instance, fixture.dealId);
  await instance.gateway.executeUser(fixture.dealId, actionId, {
    commandId: `cmd:${fixture.dealId}:${actionId}`,
    idempotencyKey: `idem:${fixture.dealId}:${actionId}`,
    expectedUpdatedAt: deal.updatedAt.toISOString(),
    expectedVersion: deal.version.toString(),
    payload: payloadForAction(fixture, actionId),
  }, user);
}

async function driveToInspection(instance: ServiceInstance, fixture: DealFixture): Promise<void> {
  for (const step of PRE_RESERVE_SEQUENCE) {
    await executeAction(instance, fixture, step.actionId, fixture.users[step.userKey]);
  }
  await instance.gateway.executeBankCallback({
    dealId: fixture.dealId,
    eventId: `bank-event-${fixture.dealId}-RESERVE-1`,
    operation: 'RESERVE',
    status: 'SUCCESS',
    bankRef: `BANK-RESERVE-${fixture.dealId}`,
    operationId: `bank-reserve:${fixture.dealId}`,
    partnerId: 'safe-deals',
  });
  for (const step of TO_INSPECTION_SEQUENCE) {
    await executeAction(instance, fixture, step.actionId, fixture.users[step.userKey]);
  }
  expect((await currentDeal(instance, fixture.dealId)).status).toBe('INSPECTION_CONFIRMED');
}

function digest(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}

async function confirmEvidence(
  instance: ServiceInstance,
  requested: UploadRequest,
  body: string,
  user: RequestUser,
): Promise<string> {
  const sha256 = digest(body);
  const sizeBytes = Buffer.byteLength(body);
  instance.storageAdapter.put(requested.objectKey, {
    sizeBytes,
    contentType: 'application/json',
    sha256,
    eTag: `actor-matrix-${sha256.slice(0, 16)}`,
  });
  const verified = await instance.storage.confirmUpload(requested.fileId, sha256, user);
  expect(verified.status).toBe('VERIFIED');
  expect(verified.immutable).toBe(true);
  return requested.fileId;
}

async function provisioningEvidence(
  instance: ServiceInstance,
  fixture: DealFixture,
  purpose: LabProvisioningEvidencePurpose,
  suffix: string,
): Promise<string> {
  const body = JSON.stringify({
    dealId: fixture.dealId,
    laboratoryOrgId: fixture.serviceOrgId,
    purpose,
    suffix,
  });
  const requested = await instance.labEvidenceUploads.requestForProvisioning({
    purpose,
    filename: `${suffix}.json`,
    mimeType: 'application/json',
    sizeBytes: Buffer.byteLength(body),
    dealId: fixture.dealId,
    laboratoryOrgId: fixture.serviceOrgId,
    ...(purpose === 'ADMISSION'
      ? { shipmentId: fixture.shipmentId, acceptanceId: fixture.acceptanceId }
      : {}),
  }, fixture.users.operator);
  return confirmEvidence(instance, requested, body, fixture.users.operator);
}

async function sampleEvidence(
  instance: ServiceInstance,
  fixture: DealFixture,
  user: RequestUser,
  purpose: LabOperationEvidencePurpose,
  suffix: string,
): Promise<string> {
  const body = JSON.stringify({ sampleId: fixture.sampleId, purpose, suffix });
  const requested = await instance.labEvidenceUploads.requestForSample(fixture.sampleId, {
    purpose,
    filename: `${suffix}.json`,
    mimeType: 'application/json',
    sizeBytes: Buffer.byteLength(body),
  }, user);
  return confirmEvidence(instance, requested, body, user);
}

async function provisionDistinctActors(
  instance: ServiceInstance,
  fixture: DealFixture,
): Promise<string> {
  const [authorityEvidence, actorEvidence, methodEvidence, equipmentEvidence, admissionEvidence] =
    await Promise.all([
      provisioningEvidence(instance, fixture, 'LAB_AUTHORITY', 'authority'),
      provisioningEvidence(instance, fixture, 'ACTOR_AUTHORITY', 'actors'),
      provisioningEvidence(instance, fixture, 'METHOD_AUTHORITY', 'methods'),
      provisioningEvidence(instance, fixture, 'EQUIPMENT_AUTHORITY', 'equipment'),
      provisioningEvidence(instance, fixture, 'ADMISSION', 'admission'),
    ]);

  const actorAssignments: Array<{
    userId: string;
    actorType: ActorType;
    evidenceRef: string;
    validUntil: string;
  }> = [
    { userId: fixture.users.surveyor.id, actorType: 'SAMPLER', evidenceRef: actorEvidence, validUntil: FUTURE_AUTHORITY_AT },
    { userId: fixture.users.driver.id, actorType: 'COURIER', evidenceRef: actorEvidence, validUntil: FUTURE_AUTHORITY_AT },
    { userId: fixture.users.elevator.id, actorType: 'RECEIVER', evidenceRef: actorEvidence, validUntil: FUTURE_AUTHORITY_AT },
    { userId: fixture.users.lab.id, actorType: 'ANALYST', evidenceRef: actorEvidence, validUntil: FUTURE_AUTHORITY_AT },
    { userId: fixture.users.logistician.id, actorType: 'SIGNATORY', evidenceRef: actorEvidence, validUntil: FUTURE_AUTHORITY_AT },
  ];

  await instance.labAuthority.provision({
    commandId: `actor-matrix-authority:${fixture.dealId}`,
    idempotencyKey: `actor-matrix-authority:${fixture.dealId}`,
    dealId: fixture.dealId,
    laboratoryOrgId: fixture.serviceOrgId,
    accreditationRef: `ACCREDITATION-${fixture.serviceOrgId}`,
    evidenceRef: authorityEvidence,
    validUntil: FUTURE_AUTHORITY_AT,
    actors: actorAssignments,
    methods: [
      {
        code: 'MOISTURE',
        parameter: 'moisture',
        unit: '%',
        standardRef: 'CONTROLLED-STANDARD-E2E',
        normMax: '14.000000',
        evidenceRef: methodEvidence,
        validUntil: FUTURE_AUTHORITY_AT,
      },
      {
        code: 'PROTEIN',
        parameter: 'protein',
        unit: '%',
        standardRef: 'CONTROLLED-STANDARD-E2E',
        normMin: '12.500000',
        evidenceRef: methodEvidence,
        validUntil: FUTURE_AUTHORITY_AT,
      },
    ],
    equipment: [{
      code: 'CONTROLLED_ANALYZER',
      name: 'Controlled laboratory analyzer',
      serialNumber: `ACTOR-MATRIX-${fixture.dealId}`,
      calibrationValidUntil: FUTURE_AUTHORITY_AT,
      evidenceRef: equipmentEvidence,
    }],
  }, fixture.users.operator);

  await instance.labAuthority.issueSampleAdmission({
    commandId: `actor-matrix-admission:${fixture.dealId}`,
    idempotencyKey: `actor-matrix-admission:${fixture.dealId}`,
    dealId: fixture.dealId,
    shipmentId: fixture.shipmentId,
    acceptanceId: fixture.acceptanceId,
    laboratoryOrgId: fixture.serviceOrgId,
    evidenceRef: admissionEvidence,
    validUntil: FUTURE_AUTHORITY_AT,
  }, fixture.users.operator);

  return admissionEvidence;
}

async function finalizeDto(
  instance: ServiceInstance,
  fixture: DealFixture,
  evidenceRef: string,
): Promise<ExecuteDealCommandDto> {
  const deal = await currentDeal(instance, fixture.dealId);
  return {
    commandId: `actor-matrix-finalize:${fixture.dealId}`,
    idempotencyKey: `actor-matrix-finalize:${fixture.dealId}`,
    expectedUpdatedAt: deal.updatedAt.toISOString(),
    expectedVersion: deal.version.toString(),
    payload: {
      sampleId: fixture.sampleId,
      signedEvidenceRef: evidenceRef,
    } as Prisma.InputJsonObject,
  };
}

describe('IR-10.3 operation-specific physical actor authority', () => {
  it('rejects wrong SAMPLER, COURIER, RECEIVER, ANALYST and SIGNATORY without partial facts', async () => {
    const instance = await createRememberedInstance();
    const fixture = await provisionDeal(instance.prisma, 'labs-actor-authority', 240_000_000n);

    try {
      await driveToInspection(instance, fixture);
      const admissionEvidence = await provisionDistinctActors(instance, fixture);

      await expect(instance.labs.create({
        commandId: `wrong-sampler:${fixture.dealId}`,
        idempotencyKey: `wrong-sampler:${fixture.dealId}`,
        dealId: fixture.dealId,
        shipmentId: fixture.shipmentId,
        acceptanceId: fixture.acceptanceId,
        evidenceRef: admissionEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.driver)).rejects.toMatchObject({ status: 403 });
      expect(await instance.prisma.labSample.count({ where: { dealId: fixture.dealId } })).toBe(0);

      let mutation = await instance.labs.create({
        commandId: `sample-create:${fixture.dealId}`,
        idempotencyKey: `sample-create:${fixture.dealId}`,
        dealId: fixture.dealId,
        shipmentId: fixture.shipmentId,
        acceptanceId: fixture.acceptanceId,
        evidenceRef: admissionEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.surveyor);
      fixture.sampleId = mutation.sample.id;

      const collectionEvidence = await sampleEvidence(
        instance,
        fixture,
        fixture.users.surveyor,
        'COLLECTION',
        'collection',
      );
      await expect(instance.labs.collect(fixture.sampleId, {
        commandId: `wrong-collection-actor:${fixture.dealId}`,
        idempotencyKey: `wrong-collection-actor:${fixture.dealId}`,
        expectedVersion: mutation.sample.version,
        evidenceRef: collectionEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.driver)).rejects.toMatchObject({ status: 403 });
      mutation = await instance.labs.collect(fixture.sampleId, {
        commandId: `collection:${fixture.dealId}`,
        idempotencyKey: `collection:${fixture.dealId}`,
        expectedVersion: mutation.sample.version,
        evidenceRef: collectionEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.surveyor);

      const sealedEvidence = await sampleEvidence(instance, fixture, fixture.users.driver, 'SEALED', 'sealed');
      await expect(instance.labs.recordCustody(fixture.sampleId, {
        commandId: `wrong-sealed-actor:${fixture.dealId}`,
        idempotencyKey: `wrong-sealed-actor:${fixture.dealId}`,
        expectedVersion: mutation.sample.version,
        eventType: 'SEALED',
        evidenceRef: sealedEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.surveyor)).rejects.toMatchObject({ status: 403 });
      mutation = await instance.labs.recordCustody(fixture.sampleId, {
        commandId: `sealed:${fixture.dealId}`,
        idempotencyKey: `sealed:${fixture.dealId}`,
        expectedVersion: mutation.sample.version,
        eventType: 'SEALED',
        evidenceRef: sealedEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.driver);

      const handoffEvidence = await sampleEvidence(instance, fixture, fixture.users.driver, 'HANDOFF', 'handoff');
      mutation = await instance.labs.recordCustody(fixture.sampleId, {
        commandId: `handoff:${fixture.dealId}`,
        idempotencyKey: `handoff:${fixture.dealId}`,
        expectedVersion: mutation.sample.version,
        eventType: 'HANDOFF',
        evidenceRef: handoffEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.driver);

      const receivedEvidence = await sampleEvidence(instance, fixture, fixture.users.elevator, 'RECEIVED', 'received');
      await expect(instance.labs.recordCustody(fixture.sampleId, {
        commandId: `wrong-receiver:${fixture.dealId}`,
        idempotencyKey: `wrong-receiver:${fixture.dealId}`,
        expectedVersion: mutation.sample.version,
        eventType: 'RECEIVED',
        evidenceRef: receivedEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.driver)).rejects.toMatchObject({ status: 403 });
      mutation = await instance.labs.recordCustody(fixture.sampleId, {
        commandId: `received:${fixture.dealId}`,
        idempotencyKey: `received:${fixture.dealId}`,
        expectedVersion: mutation.sample.version,
        eventType: 'RECEIVED',
        evidenceRef: receivedEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.elevator);

      const openedEvidence = await sampleEvidence(instance, fixture, fixture.users.lab, 'OPENED', 'opened');
      await expect(instance.labs.recordCustody(fixture.sampleId, {
        commandId: `wrong-opened-actor:${fixture.dealId}`,
        idempotencyKey: `wrong-opened-actor:${fixture.dealId}`,
        expectedVersion: mutation.sample.version,
        eventType: 'OPENED',
        evidenceRef: openedEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.elevator)).rejects.toMatchObject({ status: 403 });
      mutation = await instance.labs.recordCustody(fixture.sampleId, {
        commandId: `opened:${fixture.dealId}`,
        idempotencyKey: `opened:${fixture.dealId}`,
        expectedVersion: mutation.sample.version,
        eventType: 'OPENED',
        evidenceRef: openedEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.lab);

      const moistureEvidence = await sampleEvidence(instance, fixture, fixture.users.lab, 'TEST', 'moisture');
      await expect(instance.labs.recordTest(fixture.sampleId, {
        commandId: `wrong-analyst:${fixture.dealId}`,
        idempotencyKey: `wrong-analyst:${fixture.dealId}`,
        expectedVersion: mutation.sample.version,
        metric: 'moisture',
        value: 12.4,
        unit: '%',
        methodCode: 'MOISTURE',
        equipmentCode: 'CONTROLLED_ANALYZER',
        evidenceRef: moistureEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.driver)).rejects.toMatchObject({ status: 403 });
      expect(await instance.prisma.labTest.count({ where: { sampleId: fixture.sampleId } })).toBe(0);
      mutation = await instance.labs.recordTest(fixture.sampleId, {
        commandId: `moisture:${fixture.dealId}`,
        idempotencyKey: `moisture:${fixture.dealId}`,
        expectedVersion: mutation.sample.version,
        metric: 'moisture',
        value: 12.4,
        unit: '%',
        methodCode: 'MOISTURE',
        equipmentCode: 'CONTROLLED_ANALYZER',
        evidenceRef: moistureEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.lab);

      const proteinEvidence = await sampleEvidence(instance, fixture, fixture.users.lab, 'TEST', 'protein');
      mutation = await instance.labs.recordTest(fixture.sampleId, {
        commandId: `protein:${fixture.dealId}`,
        idempotencyKey: `protein:${fixture.dealId}`,
        expectedVersion: mutation.sample.version,
        metric: 'protein',
        value: 13.2,
        unit: '%',
        methodCode: 'PROTEIN',
        equipmentCode: 'CONTROLLED_ANALYZER',
        evidenceRef: proteinEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.lab);
      expect(mutation.sample.status).toBe('ANALYSIS_IN_PROGRESS');

      const protocolEvidence = await sampleEvidence(
        instance,
        fixture,
        fixture.users.logistician,
        'PROTOCOL',
        'protocol',
      );
      const beforeAudit = await instance.prisma.auditEvent.count({
        where: { dealId: fixture.dealId, action: 'deal.command.finalize_lab' },
      });
      const beforeOutbox = await instance.prisma.outboxEntry.count({
        where: { dealId: fixture.dealId, type: 'lab.protocol.finalized' },
      });

      await expect(instance.gateway.executeUser(
        fixture.dealId,
        'finalize_lab',
        await finalizeDto(instance, fixture, protocolEvidence),
        fixture.users.lab,
      )).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'LAB_SIGNATORY_AUTHORITY_REQUIRED' }),
      });

      expect((await currentDeal(instance, fixture.dealId)).status).toBe('INSPECTION_CONFIRMED');
      expect((await instance.prisma.labSample.findUniqueOrThrow({ where: { id: fixture.sampleId } })).status)
        .toBe('ANALYSIS_IN_PROGRESS');
      expect(await instance.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*)::bigint AS count FROM labs.protocols WHERE sample_id = ${fixture.sampleId}
      `).toEqual([{ count: 0n }]);
      expect(await instance.prisma.auditEvent.count({
        where: { dealId: fixture.dealId, action: 'deal.command.finalize_lab' },
      })).toBe(beforeAudit);
      expect(await instance.prisma.outboxEntry.count({
        where: { dealId: fixture.dealId, type: 'lab.protocol.finalized' },
      })).toBe(beforeOutbox);
    } finally {
      await destroyInstance(instance);
    }
  });
});
