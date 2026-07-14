import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../../src/common/types/request-user';
import type {
  LabActorType,
  ProvisionLabAuthorityCommand,
} from '../../src/modules/labs/lab-authority.service';
import type { LabProvisioningEvidencePurpose } from '../../src/modules/labs/dto/request-lab-evidence-upload.dto';
import {
  createInstance,
  destroyInstance,
  provisionDeal,
  type DealFixture,
  type ServiceInstance,
} from './harness';

jest.setTimeout(180_000);

const FUTURE_AT = '2035-01-01T00:00:00.000Z';

type ActorAssignment = Readonly<{
  user: RequestUser;
  actorType: LabActorType;
}>;

const OPERATION_ACTOR: ReadonlyArray<Readonly<{
  operation: string;
  actorType: LabActorType;
}>> = [
  { operation: 'sample.create', actorType: 'SAMPLER' },
  { operation: 'sample.collect', actorType: 'SAMPLER' },
  { operation: 'custody.seal', actorType: 'COURIER' },
  { operation: 'custody.handoff', actorType: 'COURIER' },
  { operation: 'custody.receive', actorType: 'RECEIVER' },
  { operation: 'custody.open', actorType: 'ANALYST' },
  { operation: 'test.record', actorType: 'ANALYST' },
  { operation: 'protocol.finalize', actorType: 'SIGNATORY' },
];

function actorAssignments(fixture: DealFixture): ReadonlyArray<ActorAssignment> {
  return [
    { user: fixture.users.surveyor, actorType: 'SAMPLER' },
    { user: fixture.users.buyer, actorType: 'SAMPLER' },
    { user: fixture.users.driver, actorType: 'COURIER' },
    { user: fixture.users.elevator, actorType: 'RECEIVER' },
    { user: fixture.users.farmer, actorType: 'ANALYST' },
    { user: fixture.users.logistician, actorType: 'SIGNATORY' },
  ];
}

async function verifiedProvisioningEvidence(
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
  const sizeBytes = Buffer.byteLength(body);
  const requested = await instance.labEvidenceUploads.requestForProvisioning({
    purpose,
    filename: `${suffix}.json`,
    mimeType: 'application/json',
    sizeBytes,
    dealId: fixture.dealId,
    laboratoryOrgId: fixture.serviceOrgId,
  }, fixture.users.operator);
  const sha256 = createHash('sha256').update(body).digest('hex');
  instance.storageAdapter.put(requested.objectKey, {
    sizeBytes,
    contentType: 'application/json',
    sha256,
    eTag: `actor-proof-${sha256.slice(0, 16)}`,
  });
  const confirmed = await instance.storage.confirmUpload(
    requested.fileId,
    sha256,
    fixture.users.operator,
  );
  expect(confirmed.status).toBe('VERIFIED');
  expect(confirmed.immutable).toBe(true);
  return requested.fileId;
}

async function provisionDistinctActorAuthority(
  instance: ServiceInstance,
  fixture: DealFixture,
  assignments: ReadonlyArray<ActorAssignment>,
): Promise<void> {
  const [authorityEvidence, actorEvidence, methodEvidence, equipmentEvidence] = await Promise.all([
    verifiedProvisioningEvidence(instance, fixture, 'LAB_AUTHORITY', 'actor-proof-authority'),
    verifiedProvisioningEvidence(instance, fixture, 'ACTOR_AUTHORITY', 'actor-proof-actors'),
    verifiedProvisioningEvidence(instance, fixture, 'METHOD_AUTHORITY', 'actor-proof-method'),
    verifiedProvisioningEvidence(instance, fixture, 'EQUIPMENT_AUTHORITY', 'actor-proof-equipment'),
  ]);

  const command: ProvisionLabAuthorityCommand = {
    commandId: `actor-proof:authority:${fixture.dealId}`,
    idempotencyKey: `actor-proof:authority:${fixture.dealId}`,
    dealId: fixture.dealId,
    laboratoryOrgId: fixture.serviceOrgId,
    accreditationRef: `ACTOR-PROOF-${fixture.serviceOrgId}`,
    evidenceRef: authorityEvidence,
    validUntil: FUTURE_AT,
    actors: assignments.map(({ user, actorType }) => ({
      userId: user.id,
      actorType,
      evidenceRef: actorEvidence,
      validUntil: FUTURE_AT,
    })),
    methods: [{
      code: 'ACTOR_PROOF_METHOD',
      parameter: 'actor-proof',
      unit: '%',
      standardRef: 'CONTROLLED-ACTOR-PROOF',
      normMin: '0.000000',
      normMax: '100.000000',
      evidenceRef: methodEvidence,
      validUntil: FUTURE_AT,
    }],
    equipment: [{
      code: 'ACTOR_PROOF_EQUIPMENT',
      name: 'Controlled actor proof equipment',
      serialNumber: `ACTOR-PROOF-${fixture.dealId}`,
      calibrationValidUntil: FUTURE_AT,
      evidenceRef: equipmentEvidence,
    }],
  };

  const receipt = await instance.labAuthority.provision(command, fixture.users.operator);
  expect(receipt.laboratoryOrgId).toBe(fixture.serviceOrgId);
}

async function actorValid(
  instance: ServiceInstance,
  fixture: DealFixture,
  userId: string,
  actorType: LabActorType,
): Promise<boolean> {
  return instance.rls.withTrustedContext(fixture.users.operator, async (tx) => {
    const rows = await tx.$queryRaw<Array<{ valid: boolean }>>(Prisma.sql`
      SELECT public.app_labs_actor_valid(
        ${fixture.users.operator.tenantId}, ${fixture.serviceOrgId},
        ${userId}, ${actorType}, now()
      ) AS valid
    `);
    return rows[0]?.valid === true;
  });
}

describe('IR-10.3 PostgreSQL operation-specific actor matrix', () => {
  it('accepts only actor assignments that exactly match every laboratory operation', async () => {
    const instance = await createInstance();
    const fixture = await provisionDeal(
      instance.prisma,
      'labs-actor-authority-proof',
      240_000_000n,
    );

    try {
      const assignments = actorAssignments(fixture);
      await provisionDistinctActorAuthority(instance, fixture, assignments);

      for (const { operation, actorType } of OPERATION_ACTOR) {
        let deniedWrongTypes = 0;

        for (const assignment of assignments) {
          await expect(
            actorValid(instance, fixture, assignment.user.id, assignment.actorType),
          ).resolves.toBe(true);

          const expectedForOperation = assignment.actorType === actorType;
          await expect(
            actorValid(instance, fixture, assignment.user.id, actorType),
          ).resolves.toBe(expectedForOperation);
          if (!expectedForOperation) deniedWrongTypes += 1;
        }

        expect(operation).toBeTruthy();
        expect(deniedWrongTypes).toBeGreaterThanOrEqual(4);
      }
    } finally {
      await destroyInstance(instance);
    }
  });
});
