import { createHash } from 'crypto';
import type { DealActionId } from '../../src/modules/deals/deal-command.policy';
import type { ExecuteDealCommandDto } from '../../src/modules/deals/dto/execute-deal-command.dto';
import type { RequestUser } from '../../src/common/types/request-user';
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
} from '../industrial/harness';

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

type UploadRequest = Readonly<{ fileId: string; objectKey: string }>;
type ActorType = 'SAMPLER' | 'COURIER' | 'RECEIVER' | 'ANALYST' | 'SIGNATORY';

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
) {
  const deal = await currentDeal(instance, fixture.dealId);
  return instance.gateway.executeUser(fixture.dealId, actionId, {
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

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function confirmUpload(
  instance: ServiceInstance,
  user: RequestUser,
  requested: UploadRequest,
  body: string,
): Promise<string> {
  const digest = sha256(body);
  const sizeBytes = Buffer.byteLength(body);
  instance.storageAdapter.put(requested.objectKey, {
    sizeBytes,
    contentType: 'application/json',
    sha256: digest,
    eTag: `one-deal-${digest.slice(0, 16)}`,
  });
  const verified = await instance.storage.confirmUpload(requested.fileId, digest, user);
  expect(verified.status).toBe('VERIFIED');
  expect(verified.immutable).toBe(true);
  return requested.fileId;
}

async function provisioningEvidence(
  instance: ServiceInstance,
  user: RequestUser,
  input: {
    purpose: LabProvisioningEvidencePurpose;
    dealId: string;
    laboratoryOrgId: string;
    filename: string;
    shipmentId?: string;
    acceptanceId?: string;
  },
): Promise<string> {
  const body = JSON.stringify(input);
  const requested = await instance.labEvidenceUploads.requestForProvisioning({
    ...input,
    mimeType: 'application/json',
    sizeBytes: Buffer.byteLength(body),
  }, user);
  return confirmUpload(instance, user, requested, body);
}

async function operationEvidence(
  instance: ServiceInstance,
  user: RequestUser,
  sampleId: string,
  purpose: LabOperationEvidencePurpose,
  filename: string,
): Promise<string> {
  const body = JSON.stringify({ sampleId, purpose, filename });
  const requested = await instance.labEvidenceUploads.requestForSample(sampleId, {
    purpose,
    filename,
    mimeType: 'application/json',
    sizeBytes: Buffer.byteLength(body),
  }, user);
  return confirmUpload(instance, user, requested, body);
}

async function provisionAuthority(
  instance: ServiceInstance,
  fixture: DealFixture,
  signatory: RequestUser,
): Promise<string> {
  const operator = fixture.users.operator;
  const authorityEvidence = await provisioningEvidence(instance, operator, {
    purpose: 'LAB_AUTHORITY',
    dealId: fixture.dealId,
    laboratoryOrgId: fixture.serviceOrgId,
    filename: 'laboratory-authority.json',
  });
  const actorEvidence = await provisioningEvidence(instance, operator, {
    purpose: 'ACTOR_AUTHORITY',
    dealId: fixture.dealId,
    laboratoryOrgId: fixture.serviceOrgId,
    filename: 'laboratory-actors.json',
  });
  const methodEvidence = await provisioningEvidence(instance, operator, {
    purpose: 'METHOD_AUTHORITY',
    dealId: fixture.dealId,
    laboratoryOrgId: fixture.serviceOrgId,
    filename: 'laboratory-methods.json',
  });
  const equipmentEvidence = await provisioningEvidence(instance, operator, {
    purpose: 'EQUIPMENT_AUTHORITY',
    dealId: fixture.dealId,
    laboratoryOrgId: fixture.serviceOrgId,
    filename: 'laboratory-equipment.json',
  });
  const admissionEvidence = await provisioningEvidence(instance, operator, {
    purpose: 'ADMISSION',
    dealId: fixture.dealId,
    laboratoryOrgId: fixture.serviceOrgId,
    shipmentId: fixture.shipmentId,
    acceptanceId: fixture.acceptanceId,
    filename: 'laboratory-admission.json',
  });

  const actors: Array<{
    userId: string;
    actorType: ActorType;
    evidenceRef: string;
    validUntil: string;
  }> = [
    { userId: fixture.users.surveyor.id, actorType: 'SAMPLER', evidenceRef: actorEvidence, validUntil: FUTURE_AUTHORITY_AT },
    { userId: fixture.users.driver.id, actorType: 'COURIER', evidenceRef: actorEvidence, validUntil: FUTURE_AUTHORITY_AT },
    { userId: fixture.users.elevator.id, actorType: 'RECEIVER', evidenceRef: actorEvidence, validUntil: FUTURE_AUTHORITY_AT },
    { userId: fixture.users.lab.id, actorType: 'ANALYST', evidenceRef: actorEvidence, validUntil: FUTURE_AUTHORITY_AT },
    { userId: signatory.id, actorType: 'SIGNATORY', evidenceRef: actorEvidence, validUntil: FUTURE_AUTHORITY_AT },
  ];

  await instance.labAuthority.provision({
    commandId: `lab-authority:${fixture.dealId}`,
    idempotencyKey: `lab-authority:${fixture.dealId}`,
    dealId: fixture.dealId,
    laboratoryOrgId: fixture.serviceOrgId,
    accreditationRef: `ACCREDITATION-${fixture.serviceOrgId}`,
    evidenceRef: authorityEvidence,
    validUntil: FUTURE_AUTHORITY_AT,
    actors,
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
      serialNumber: `LAB-${fixture.dealId}`,
      calibrationValidUntil: FUTURE_AUTHORITY_AT,
      evidenceRef: equipmentEvidence,
    }],
  }, operator);

  await instance.labAuthority.issueSampleAdmission({
    commandId: `lab-admission:${fixture.dealId}`,
    idempotencyKey: `lab-admission:${fixture.dealId}`,
    dealId: fixture.dealId,
    shipmentId: fixture.shipmentId,
    acceptanceId: fixture.acceptanceId,
    laboratoryOrgId: fixture.serviceOrgId,
    evidenceRef: admissionEvidence,
    validUntil: FUTURE_AUTHORITY_AT,
  }, operator);

  return admissionEvidence;
}

async function createSample(
  instance: ServiceInstance,
  fixture: DealFixture,
  admissionEvidence: string,
  user: RequestUser,
  suffix: string,
) {
  return instance.labs.create({
    commandId: `lab-create:${fixture.dealId}:${suffix}`,
    idempotencyKey: `lab-create:${fixture.dealId}:${suffix}`,
    dealId: fixture.dealId,
    shipmentId: fixture.shipmentId,
    acceptanceId: fixture.acceptanceId,
    evidenceRef: admissionEvidence,
    occurredAt: new Date().toISOString(),
  }, user);
}

async function finalizeDto(
  instance: ServiceInstance,
  fixture: DealFixture,
  sampleId: string,
  evidenceRef: string,
  suffix: string,
): Promise<ExecuteDealCommandDto> {
  const deal = await currentDeal(instance, fixture.dealId);
  return {
    commandId: `cmd:${fixture.dealId}:finalize_lab:${suffix}`,
    idempotencyKey: `idem:${fixture.dealId}:finalize_lab:${suffix}`,
    expectedUpdatedAt: deal.updatedAt.toISOString(),
    expectedVersion: deal.version.toString(),
    payload: { sampleId, signedEvidenceRef: evidenceRef },
  };
}

describe('IR-10.3 exact Labs actor and incomplete-custody proof', () => {
  it('rejects the wrong physical actor at create, collect, custody, test and protocol finalization', async () => {
    const instance = await createRememberedInstance();
    const fixture = await provisionDeal(instance.prisma, 'labs-actor-matrix', 240_000_000n);
    try {
      await driveToInspection(instance, fixture);
      const signatory = fixture.users.logistician;
      const admissionEvidence = await provisionAuthority(instance, fixture, signatory);

      await expect(createSample(instance, fixture, admissionEvidence, fixture.users.driver, 'wrong-actor'))
        .rejects.toMatchObject({ status: 403 });
      expect(await instance.prisma.labSample.count({ where: { dealId: fixture.dealId } })).toBe(0);

      let mutation = await createSample(instance, fixture, admissionEvidence, fixture.users.surveyor, 'sampler');
      fixture.sampleId = mutation.sample.id;

      const collectionEvidence = await operationEvidence(
        instance,
        fixture.users.surveyor,
        fixture.sampleId,
        'COLLECTION',
        'collection.json',
      );
      await expect(instance.labs.collect(fixture.sampleId, {
        commandId: `lab-collect:${fixture.dealId}:wrong-actor`,
        idempotencyKey: `lab-collect:${fixture.dealId}:wrong-actor`,
        expectedVersion: mutation.sample.version,
        evidenceRef: collectionEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.driver)).rejects.toMatchObject({ status: 403 });
      mutation = await instance.labs.collect(fixture.sampleId, {
        commandId: `lab-collect:${fixture.dealId}`,
        idempotencyKey: `lab-collect:${fixture.dealId}`,
        expectedVersion: mutation.sample.version,
        evidenceRef: collectionEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.surveyor);

      const sealedEvidence = await operationEvidence(instance, fixture.users.driver, fixture.sampleId, 'SEALED', 'sealed.json');
      await expect(instance.labs.recordCustody(fixture.sampleId, {
        commandId: `lab-sealed:${fixture.dealId}:wrong-actor`,
        idempotencyKey: `lab-sealed:${fixture.dealId}:wrong-actor`,
        expectedVersion: mutation.sample.version,
        eventType: 'SEALED',
        evidenceRef: sealedEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.surveyor)).rejects.toMatchObject({ status: 403 });
      mutation = await instance.labs.recordCustody(fixture.sampleId, {
        commandId: `lab-sealed:${fixture.dealId}`,
        idempotencyKey: `lab-sealed:${fixture.dealId}`,
        expectedVersion: mutation.sample.version,
        eventType: 'SEALED',
        evidenceRef: sealedEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.driver);

      const handoffEvidence = await operationEvidence(instance, fixture.users.driver, fixture.sampleId, 'HANDOFF', 'handoff.json');
      mutation = await instance.labs.recordCustody(fixture.sampleId, {
        commandId: `lab-handoff:${fixture.dealId}`,
        idempotencyKey: `lab-handoff:${fixture.dealId}`,
        expectedVersion: mutation.sample.version,
        eventType: 'HANDOFF',
        evidenceRef: handoffEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.driver);

      const receivedEvidence = await operationEvidence(instance, fixture.users.elevator, fixture.sampleId, 'RECEIVED', 'received.json');
      await expect(instance.labs.recordCustody(fixture.sampleId, {
        commandId: `lab-received:${fixture.dealId}:wrong-actor`,
        idempotencyKey: `lab-received:${fixture.dealId}:wrong-actor`,
        expectedVersion: mutation.sample.version,
        eventType: 'RECEIVED',
        evidenceRef: receivedEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.driver)).rejects.toMatchObject({ status: 403 });
      mutation = await instance.labs.recordCustody(fixture.sampleId, {
        commandId: `lab-received:${fixture.dealId}`,
        idempotencyKey: `lab-received:${fixture.dealId}`,
        expectedVersion: mutation.sample.version,
        eventType: 'RECEIVED',
        evidenceRef: receivedEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.elevator);

      const openedEvidence = await operationEvidence(instance, fixture.users.lab, fixture.sampleId, 'OPENED', 'opened.json');
      await expect(instance.labs.recordCustody(fixture.sampleId, {
        commandId: `lab-opened:${fixture.dealId}:wrong-actor`,
        idempotencyKey: `lab-opened:${fixture.dealId}:wrong-actor`,
        expectedVersion: mutation.sample.version,
        eventType: 'OPENED',
        evidenceRef: openedEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.elevator)).rejects.toMatchObject({ status: 403 });
      mutation = await instance.labs.recordCustody(fixture.sampleId, {
        commandId: `lab-opened:${fixture.dealId}`,
        idempotencyKey: `lab-opened:${fixture.dealId}`,
        expectedVersion: mutation.sample.version,
        eventType: 'OPENED',
        evidenceRef: openedEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.lab);

      const moistureEvidence = await operationEvidence(instance, fixture.users.lab, fixture.sampleId, 'TEST', 'moisture.json');
      await expect(instance.labs.recordTest(fixture.sampleId, {
        commandId: `lab-test:${fixture.dealId}:wrong-actor`,
        idempotencyKey: `lab-test:${fixture.dealId}:wrong-actor`,
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
        commandId: `lab-test:${fixture.dealId}:moisture`,
        idempotencyKey: `lab-test:${fixture.dealId}:moisture`,
        expectedVersion: mutation.sample.version,
        metric: 'moisture',
        value: 12.4,
        unit: '%',
        methodCode: 'MOISTURE',
        equipmentCode: 'CONTROLLED_ANALYZER',
        evidenceRef: moistureEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.lab);

      const proteinEvidence = await operationEvidence(instance, fixture.users.lab, fixture.sampleId, 'TEST', 'protein.json');
      mutation = await instance.labs.recordTest(fixture.sampleId, {
        commandId: `lab-test:${fixture.dealId}:protein`,
        idempotencyKey: `lab-test:${fixture.dealId}:protein`,
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

      const protocolEvidence = await operationEvidence(
        instance,
        signatory,
        fixture.sampleId,
        'PROTOCOL',
        'protocol.json',
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
        await finalizeDto(instance, fixture, fixture.sampleId, protocolEvidence, 'wrong-signatory'),
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

  it('rejects testing and finalization when custody is incomplete without direct state seeding', async () => {
    const instance = await createRememberedInstance();
    const fixture = await provisionDeal(instance.prisma, 'labs-incomplete-custody', 240_000_000n);
    try {
      await driveToInspection(instance, fixture);
      const admissionEvidence = await provisionAuthority(instance, fixture, fixture.users.lab);
      let mutation = await createSample(instance, fixture, admissionEvidence, fixture.users.surveyor, 'sampler');
      fixture.sampleId = mutation.sample.id;

      const collectionEvidence = await operationEvidence(instance, fixture.users.surveyor, fixture.sampleId, 'COLLECTION', 'collection.json');
      mutation = await instance.labs.collect(fixture.sampleId, {
        commandId: `lab-collect:${fixture.dealId}`,
        idempotencyKey: `lab-collect:${fixture.dealId}`,
        expectedVersion: mutation.sample.version,
        evidenceRef: collectionEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.surveyor);

      for (const step of [
        { eventType: 'SEALED' as const, actor: fixture.users.driver },
        { eventType: 'HANDOFF' as const, actor: fixture.users.driver },
        { eventType: 'RECEIVED' as const, actor: fixture.users.elevator },
      ]) {
        const evidenceRef = await operationEvidence(
          instance,
          step.actor,
          fixture.sampleId,
          step.eventType,
          `${step.eventType.toLowerCase()}.json`,
        );
        mutation = await instance.labs.recordCustody(fixture.sampleId, {
          commandId: `lab-custody:${fixture.dealId}:${step.eventType}`,
          idempotencyKey: `lab-custody:${fixture.dealId}:${step.eventType}`,
          expectedVersion: mutation.sample.version,
          eventType: step.eventType,
          evidenceRef,
          occurredAt: new Date().toISOString(),
        }, step.actor);
      }
      expect(mutation.sample.status).toBe('RECEIVED');

      const testEvidence = await operationEvidence(instance, fixture.users.lab, fixture.sampleId, 'TEST', 'premature-test.json');
      const beforeAudit = await instance.prisma.auditEvent.count({ where: { dealId: fixture.dealId } });
      const beforeOutbox = await instance.prisma.outboxEntry.count({ where: { dealId: fixture.dealId } });
      await expect(instance.labs.recordTest(fixture.sampleId, {
        commandId: `lab-test:${fixture.dealId}:incomplete-custody`,
        idempotencyKey: `lab-test:${fixture.dealId}:incomplete-custody`,
        expectedVersion: mutation.sample.version,
        metric: 'moisture',
        value: 12.4,
        unit: '%',
        methodCode: 'MOISTURE',
        equipmentCode: 'CONTROLLED_ANALYZER',
        evidenceRef: testEvidence,
        occurredAt: new Date().toISOString(),
      }, fixture.users.lab)).rejects.toBeDefined();
      expect(await instance.prisma.labTest.count({ where: { sampleId: fixture.sampleId } })).toBe(0);

      const protocolEvidence = await operationEvidence(
        instance,
        fixture.users.lab,
        fixture.sampleId,
        'PROTOCOL',
        'premature-protocol.json',
      );
      await expect(instance.gateway.executeUser(
        fixture.dealId,
        'finalize_lab',
        await finalizeDto(instance, fixture, fixture.sampleId, protocolEvidence, 'incomplete-custody'),
        fixture.users.lab,
      )).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'LAB_SAMPLE_NOT_READY' }),
      });

      expect((await instance.prisma.labSample.findUniqueOrThrow({ where: { id: fixture.sampleId } })).status)
        .toBe('RECEIVED');
      expect((await currentDeal(instance, fixture.dealId)).status).toBe('INSPECTION_CONFIRMED');
      expect(await instance.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*)::bigint AS count FROM labs.protocols WHERE sample_id = ${fixture.sampleId}
      `).toEqual([{ count: 0n }]);
      expect(await instance.prisma.auditEvent.count({ where: { dealId: fixture.dealId } })).toBe(beforeAudit);
      expect(await instance.prisma.outboxEntry.count({ where: { dealId: fixture.dealId } })).toBe(beforeOutbox);
    } finally {
      await destroyInstance(instance);
    }
  });
});
