import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { StoragePrismaService } from '../../src/common/prisma/storage-prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { PostgresqlDealCommandService } from '../../src/modules/deals/postgresql-deal-command.service';
import { IndustrialDealCommandGateway } from '../../src/modules/deals/industrial-deal-command.gateway';
import type { DealActionId } from '../../src/modules/deals/deal-command.policy';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import { PrismaLabRepository } from '../../src/modules/labs/prisma-lab.repository';
import { AuthorizedPrismaLabRepository } from '../../src/modules/labs/authorized-prisma-lab.repository';
import { LabAuthorityService } from '../../src/modules/labs/lab-authority.service';
import { LabEvidenceUploadService } from '../../src/modules/labs/lab-evidence-upload.service';
import type {
  LabOperationEvidencePurpose,
  LabProvisioningEvidencePurpose,
} from '../../src/modules/labs/dto/request-lab-evidence-upload.dto';
import { StorageFinalizationRepository } from '../../src/modules/storage/storage-finalization.repository';
import { StorageService } from '../../src/modules/storage/storage.service';
import type {
  ObjectInspection,
  ObjectStorageAdapter,
  PresignedObjectUrl,
} from '../../src/modules/storage/object-storage.adapter';

export const INDUSTRIAL_TENANT = 'tenant-industrial-e2e';
const FACT_AT = '2026-07-12T09:00:00.000Z';
const FUTURE_AUTHORITY_AT = '2035-01-01T00:00:00.000Z';

export interface DealFixture {
  dealId: string;
  sellerOrgId: string;
  buyerOrgId: string;
  serviceOrgId: string;
  totalKopecks: bigint;
  shipmentId: string;
  acceptanceId: string;
  sampleId: string;
  contractDocumentId: string;
  inspectionDocumentId: string;
  vehicleId: string;
  routeFromFacilityId: string;
  routeToFacilityId: string;
  evidence: Record<string, string>;
  users: Record<string, RequestUser>;
}

export interface ServiceInstance {
  prisma: PrismaService;
  storagePrisma: StoragePrismaService;
  rls: RlsTransactionService;
  commands: PostgresqlDealCommandService;
  gateway: IndustrialDealCommandGateway;
  labs: AuthorizedPrismaLabRepository;
  labAuthority: LabAuthorityService;
  labEvidenceUploads: LabEvidenceUploadService;
  storage: StorageService;
  storageAdapter: ControlledObjectStorageAdapter;
}

class ControlledObjectStorageAdapter implements ObjectStorageAdapter {
  readonly driver = 'filesystem' as const;
  private readonly objects = new Map<string, ObjectInspection>();

  async getPresignedUploadUrl(
    key: string,
    _mimeType: string,
    ttlSeconds: number,
  ): Promise<PresignedObjectUrl> {
    return {
      url: `https://controlled.invalid/upload/${encodeURIComponent(key)}`,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };
  }

  async getPresignedDownloadUrl(key: string, ttlSeconds: number): Promise<PresignedObjectUrl> {
    return {
      url: `https://controlled.invalid/download/${encodeURIComponent(key)}`,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };
  }

  async inspectAndHashObject(key: string): Promise<ObjectInspection> {
    const inspection = this.objects.get(key);
    if (!inspection) throw new Error(`Controlled object is missing: ${key}`);
    return inspection;
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }

  put(key: string, inspection: ObjectInspection): void {
    this.objects.set(key, inspection);
  }
}

const activeInstances = new WeakMap<PrismaService, ServiceInstance>();

function rememberInstance(instance: ServiceInstance): ServiceInstance {
  activeInstances.set(instance.prisma, instance);
  return instance;
}

export async function createInstance(): Promise<ServiceInstance> {
  const prisma = new PrismaService();
  await prisma.$connect();
  const storagePrisma = new StoragePrismaService();
  await storagePrisma.$connect();
  const rls = new RlsTransactionService(prisma);
  const commands = new PostgresqlDealCommandService(rls);
  const gateway = new IndustrialDealCommandGateway(prisma, rls, commands);
  const prismaLabs = new PrismaLabRepository(rls);
  const labs = new AuthorizedPrismaLabRepository(prismaLabs, rls);
  const labAuthority = new LabAuthorityService(rls);
  const storageAdapter = new ControlledObjectStorageAdapter();
  const labEvidenceUploads = new LabEvidenceUploadService(rls, storageAdapter);
  const finalization = new StorageFinalizationRepository(storagePrisma);
  const storage = new StorageService(rls, storageAdapter, finalization);
  return rememberInstance({
    prisma,
    storagePrisma,
    rls,
    commands,
    gateway,
    labs,
    labAuthority,
    labEvidenceUploads,
    storage,
    storageAdapter,
  });
}

export async function createRememberedInstance(): Promise<ServiceInstance> {
  return createInstance();
}

export async function destroyInstance(instance: ServiceInstance): Promise<void> {
  activeInstances.delete(instance.prisma);
  await instance.storagePrisma.$disconnect();
  await instance.prisma.$disconnect();
}

const ROLE_SET: ReadonlyArray<{ role: Role; key: string }> = [
  { role: Role.COMPLIANCE_OFFICER, key: 'compliance' },
  { role: Role.FARMER, key: 'farmer' },
  { role: Role.BUYER, key: 'buyer' },
  { role: Role.LOGISTICIAN, key: 'logistician' },
  { role: Role.DRIVER, key: 'driver' },
  { role: Role.ELEVATOR, key: 'elevator' },
  { role: Role.SURVEYOR, key: 'surveyor' },
  { role: Role.LAB, key: 'lab' },
  { role: Role.ACCOUNTING, key: 'accounting' },
  { role: Role.SUPPORT_MANAGER, key: 'operator' },
];

function accessFor(role: Role): 'READ' | 'WORK' | 'APPROVE' {
  if (role === Role.EXECUTIVE) return 'READ';
  if (role === Role.COMPLIANCE_OFFICER || role === Role.SUPPORT_MANAGER) return 'APPROVE';
  return 'WORK';
}

function fixtureHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function confirmControlledUpload(
  instance: ServiceInstance,
  user: RequestUser,
  requested: { fileId: string; objectKey: string },
  body: string,
): Promise<string> {
  const sizeBytes = Buffer.byteLength(body);
  const sha256 = fixtureHash(body);
  instance.storageAdapter.put(requested.objectKey, {
    sizeBytes,
    contentType: 'application/json',
    sha256,
    eTag: `controlled-${sha256.slice(0, 16)}`,
  });
  const verified = await instance.storage.confirmUpload(requested.fileId, sha256, user);
  if (verified.status !== 'VERIFIED' || !verified.immutable || verified.sha256 !== sha256) {
    throw new Error('Controlled evidence did not reach immutable VERIFIED state.');
  }
  return requested.fileId;
}

async function createVerifiedEvidence(
  instance: ServiceInstance,
  user: RequestUser,
  input: {
    dealId: string;
    filename: string;
  },
): Promise<string> {
  const body = JSON.stringify({
    dealId: input.dealId,
    filename: input.filename,
  });
  const requested = await instance.storage.requestUpload({
    dealId: input.dealId,
    filename: input.filename,
    mimeType: 'application/json',
    sizeBytes: Buffer.byteLength(body),
  }, user);
  return confirmControlledUpload(instance, user, requested, body);
}

async function createProvisioningEvidence(
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
    purpose: input.purpose,
    dealId: input.dealId,
    laboratoryOrgId: input.laboratoryOrgId,
    filename: input.filename,
    mimeType: 'application/json',
    sizeBytes: Buffer.byteLength(body),
    shipmentId: input.shipmentId,
    acceptanceId: input.acceptanceId,
  }, user);
  return confirmControlledUpload(instance, user, requested, body);
}

async function createOperationEvidence(
  instance: ServiceInstance,
  user: RequestUser,
  input: {
    sampleId: string;
    purpose: LabOperationEvidencePurpose;
    filename: string;
  },
): Promise<string> {
  const body = JSON.stringify(input);
  const requested = await instance.labEvidenceUploads.requestForSample(input.sampleId, {
    purpose: input.purpose,
    filename: input.filename,
    mimeType: 'application/json',
    sizeBytes: Buffer.byteLength(body),
  }, user);
  return confirmControlledUpload(instance, user, requested, body);
}

async function seedNormalizedLogisticsAdmission(
  instance: ServiceInstance,
  fixture: DealFixture,
): Promise<void> {
  const evidenceId = await createVerifiedEvidence(instance, fixture.users.operator, {
    dealId: fixture.dealId,
    filename: 'normalized-logistics-admission.json',
  });

  await instance.prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.carriers (
        id, tenant_id, organization_id, status, evidence_file_id
      ) VALUES (
        ${`carrier:${fixture.serviceOrgId}`}, ${INDUSTRIAL_TENANT},
        ${fixture.serviceOrgId}, 'VERIFIED', ${evidenceId}
      )
      ON CONFLICT (tenant_id, organization_id) DO UPDATE SET
        status = 'VERIFIED', evidence_file_id = EXCLUDED.evidence_file_id,
        valid_until = NULL, updated_at = now()
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.drivers (
        id, tenant_id, carrier_org_id, user_id, status, evidence_file_id
      ) VALUES (
        ${`driver-registry:${fixture.users.driver.id}`}, ${INDUSTRIAL_TENANT},
        ${fixture.serviceOrgId}, ${fixture.users.driver.id}, 'ACTIVE', ${evidenceId}
      )
      ON CONFLICT (tenant_id, user_id) DO UPDATE SET
        carrier_org_id = EXCLUDED.carrier_org_id, status = 'ACTIVE',
        evidence_file_id = EXCLUDED.evidence_file_id, valid_until = NULL,
        updated_at = now()
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.vehicles (
        id, tenant_id, carrier_org_id, registration_number, vehicle_type,
        status, evidence_file_id
      ) VALUES (
        ${fixture.vehicleId}, ${INDUSTRIAL_TENANT}, ${fixture.serviceOrgId},
        ${fixture.vehicleId}, 'TRUCK', 'ACTIVE', ${evidenceId}
      )
      ON CONFLICT (id) DO UPDATE SET
        carrier_org_id = EXCLUDED.carrier_org_id, status = 'ACTIVE',
        evidence_file_id = EXCLUDED.evidence_file_id, valid_until = NULL,
        updated_at = now()
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.driver_vehicle_links (
        id, tenant_id, driver_id, vehicle_id, status
      ) VALUES (
        ${`driver-vehicle:${fixture.dealId}`}, ${INDUSTRIAL_TENANT},
        ${`driver-registry:${fixture.users.driver.id}`}, ${fixture.vehicleId}, 'ACTIVE'
      )
      ON CONFLICT (tenant_id, driver_id, vehicle_id) DO UPDATE SET
        status = 'ACTIVE', valid_until = NULL
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.facilities (
        id, tenant_id, organization_id, facility_type, name, status,
        evidence_file_id
      ) VALUES (
        ${fixture.routeFromFacilityId}, ${INDUSTRIAL_TENANT}, ${fixture.sellerOrgId},
        'DISPATCH', 'Seller dispatch', 'ACTIVE', ${evidenceId}
      )
      ON CONFLICT (id) DO UPDATE SET
        status = 'ACTIVE', evidence_file_id = EXCLUDED.evidence_file_id,
        valid_until = NULL, updated_at = now()
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.facilities (
        id, tenant_id, organization_id, facility_type, name, status,
        evidence_file_id
      ) VALUES (
        ${fixture.routeToFacilityId}, ${INDUSTRIAL_TENANT}, ${fixture.buyerOrgId},
        'ACCEPTANCE', 'Buyer acceptance', 'ACTIVE', ${evidenceId}
      )
      ON CONFLICT (id) DO UPDATE SET
        status = 'ACTIVE', evidence_file_id = EXCLUDED.evidence_file_id,
        valid_until = NULL, updated_at = now()
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.deal_admissions (
        id, tenant_id, deal_id, carrier_org_id, driver_user_id, vehicle_id,
        route_from_facility_id, route_to_facility_id, status, evidence_file_id,
        driver_pin_hash
      ) VALUES (
        ${`admission:${fixture.dealId}`}, ${INDUSTRIAL_TENANT}, ${fixture.dealId},
        ${fixture.serviceOrgId}, ${fixture.users.driver.id}, ${fixture.vehicleId},
        ${fixture.routeFromFacilityId}, ${fixture.routeToFacilityId}, 'ACTIVE',
        ${evidenceId}, ${bcrypt.hashSync('246810', 4)}
      )
      ON CONFLICT (id) DO UPDATE SET
        status = 'ACTIVE', evidence_file_id = EXCLUDED.evidence_file_id,
        driver_pin_hash = EXCLUDED.driver_pin_hash,
        consumed_at = NULL, consumed_by_command_id = NULL,
        valid_until = NULL, updated_at = now()
    `);
  });
}

export async function provisionDeal(
  prisma: PrismaService,
  slug: string,
  totalKopecks: bigint,
): Promise<DealFixture> {
  const dealId = `DEAL-E2E-${slug}`;
  const sellerOrgId = `org-e2e-${slug}-seller`;
  const buyerOrgId = `org-e2e-${slug}-buyer`;
  const serviceOrgId = `org-e2e-${slug}-services`;
  const shipmentId = `shipment:${dealId}`;
  const acceptanceId = `acceptance:${dealId}`;
  const contractDocumentId = `contract:${dealId}`;
  const inspectionDocumentId = `inspection:${dealId}`;
  const vehicleId = `vehicle:${dealId}`;
  const routeFromFacilityId = `facility:${sellerOrgId}:dispatch`;
  const routeToFacilityId = `facility:${buyerOrgId}:acceptance`;
  const passwordHash = bcrypt.hashSync('industrial-e2e', 4);

  const evidence: Record<string, string> = Object.fromEntries(
    ['seller-signature', 'buyer-signature', 'loading', 'departure', 'arrival', 'weighing', 'inspection', 'acceptance']
      .map((kind) => [kind, `evidence:${dealId}:${kind}`]),
  );

  const orgFor = (role: Role): string => {
    if (role === Role.FARMER) return sellerOrgId;
    if (role === Role.BUYER || role === Role.ACCOUNTING) return buyerOrgId;
    return serviceOrgId;
  };

  await prisma.$transaction(async (tx) => {
    let innSuffix = 0;
    for (const orgId of [sellerOrgId, buyerOrgId, serviceOrgId]) {
      innSuffix += 1;
      const innDigits = BigInt(`0x${createHash('sha256').update(slug).digest('hex').slice(0, 10)}`)
        .toString()
        .padStart(8, '0')
        .slice(0, 8);
      await tx.organization.create({
        data: {
          id: orgId,
          inn: `77${innDigits}${innSuffix}`,
          name: orgId,
          tenantId: INDUSTRIAL_TENANT,
          status: 'VERIFIED',
          kycStatus: 'APPROVED',
          amlStatus: 'CLEAR',
          verifiedAt: new Date(),
        },
      });
    }

    const driverId = `user-e2e-${slug}-driver`;
    const logisticsBasis = {
      carriers: [{ id: serviceOrgId, status: 'VERIFIED', tenantId: INDUSTRIAL_TENANT }],
      drivers: [{ id: driverId, carrierOrgId: serviceOrgId, status: 'ACTIVE', vehicleIds: [vehicleId] }],
      vehicles: [{ id: vehicleId, carrierOrgId: serviceOrgId, status: 'ACTIVE' }],
      facilities: [
        { id: routeFromFacilityId, organizationId: sellerOrgId, status: 'ACTIVE' },
        { id: routeToFacilityId, organizationId: buyerOrgId, status: 'ACTIVE' },
      ],
    };

    await tx.deal.create({
      data: {
        id: dealId,
        dealNumber: `ТП-E2E-${slug}`,
        status: 'DRAFT',
        tenantId: INDUSTRIAL_TENANT,
        sellerOrgId,
        buyerOrgId,
        totalKopecks,
        currency: 'RUB',
        culture: 'Пшеница',
        region: 'Контролируемый тестовый регион',
        sagaState: { logisticsBasis },
      },
    });

    for (const { role, key } of ROLE_SET) {
      const userId = `user-e2e-${slug}-${key}`;
      const orgId = orgFor(role);
      await tx.user.create({
        data: {
          id: userId,
          email: `${key}-${slug}@industrial-e2e.invalid`,
          passwordHash,
          fullName: `E2E ${key} ${slug}`,
          status: 'ACTIVE',
        },
      });
      await tx.userOrg.create({
        data: { userId, organizationId: orgId, role, isDefault: true },
      });
      await tx.dealParticipant.create({
        data: {
          id: `participant:${dealId}:${key}`,
          dealId,
          tenantId: INDUSTRIAL_TENANT,
          organizationId: orgId,
          userId,
          role,
          accessLevel: accessFor(role),
          status: 'ACTIVE',
        },
      });
    }

    for (const [kind, evidenceId] of Object.entries(evidence)) {
      await tx.evidenceFile.create({
        data: {
          id: evidenceId,
          dealId,
          shipmentId: ['loading', 'departure', 'arrival', 'weighing', 'acceptance'].includes(kind)
            ? shipmentId
            : null,
          type: kind.toUpperCase(),
          filename: `${kind}.json`,
          mimeType: 'application/json',
          sizeBytes: 256,
          hash: fixtureHash(evidenceId),
          s3Key: `industrial-e2e/${dealId}/${kind}.json`,
          uploadedBy: `user-e2e-${slug}-operator`,
        },
      });
    }

    await tx.dealDocument.create({
      data: {
        id: contractDocumentId,
        dealId,
        tenantId: INDUSTRIAL_TENANT,
        type: 'CONTRACT',
        status: 'UPLOADED',
        name: 'Контролируемый договор поставки',
        s3Key: `industrial-e2e/${dealId}/contract.pdf`,
        hash: fixtureHash(contractDocumentId),
        uploadedByUserId: `user-e2e-${slug}-farmer`,
        bankRequired: true,
        releaseRequired: true,
        bankAcceptance: 'ACCEPTED',
      },
    });
    await tx.dealDocument.create({
      data: {
        id: inspectionDocumentId,
        dealId,
        tenantId: INDUSTRIAL_TENANT,
        type: 'INSPECTION_REPORT',
        status: 'VALIDATED',
        name: 'Контролируемое заключение осмотра',
        s3Key: `industrial-e2e/${dealId}/inspection.pdf`,
        hash: fixtureHash(inspectionDocumentId),
        uploadedByUserId: `user-e2e-${slug}-surveyor`,
        releaseRequired: true,
      },
    });

    for (const document of [
      { id: `ttn:${dealId}`, type: 'TTN', name: 'Транспортная накладная' },
      { id: `weighing:${dealId}`, type: 'WEIGHING_ACT', name: 'Акт взвешивания' },
      { id: `lab-protocol:${dealId}`, type: 'LAB_PROTOCOL', name: 'Лабораторный протокол' },
      { id: `acceptance-act:${dealId}`, type: 'ACCEPTANCE_ACT', name: 'Акт приёмки' },
    ]) {
      await tx.dealDocument.create({
        data: {
          ...document,
          dealId,
          tenantId: INDUSTRIAL_TENANT,
          status: 'SIGNED',
          s3Key: `industrial-e2e/${dealId}/${document.type}.pdf`,
          hash: fixtureHash(document.id),
          signedAt: new Date(FACT_AT),
          signatories: JSON.stringify([{
            userId: `user-e2e-${slug}-operator`,
            signedAt: FACT_AT,
            evidenceRef: evidence.acceptance,
          }]),
          uploadedByUserId: `user-e2e-${slug}-operator`,
          isImmutable: true,
          bankRequired: true,
          releaseRequired: true,
          bankAcceptance: 'ACCEPTED',
        },
      });
    }
  });

  const users: Record<string, RequestUser> = {};
  for (const { role, key } of ROLE_SET) {
    users[key] = {
      id: `user-e2e-${slug}-${key}`,
      email: `${key}-${slug}@industrial-e2e.invalid`,
      fullName: `E2E ${key} ${slug}`,
      role,
      orgId: orgFor(role),
      tenantId: INDUSTRIAL_TENANT,
      sessionId: `session-e2e-${slug}-${key}`,
      mfaVerified: true,
    };
  }

  const fixture: DealFixture = {
    dealId,
    sellerOrgId,
    buyerOrgId,
    serviceOrgId,
    totalKopecks,
    shipmentId,
    acceptanceId,
    sampleId: '',
    contractDocumentId,
    inspectionDocumentId,
    vehicleId,
    routeFromFacilityId,
    routeToFacilityId,
    evidence,
    users,
  };

  const instance = activeInstances.get(prisma);
  if (!instance) throw new Error('provisionDeal requires a PrismaService created by createInstance().');
  await seedNormalizedLogisticsAdmission(instance, fixture);
  return fixture;
}

export async function prepareLaboratoryLifecycle(
  instance: ServiceInstance,
  fixture: DealFixture,
): Promise<void> {
  const operator = fixture.users.operator;
  const labUser = fixture.users.lab;

  const authorityEvidence = await createProvisioningEvidence(instance, operator, {
    purpose: 'LAB_AUTHORITY',
    dealId: fixture.dealId,
    laboratoryOrgId: fixture.serviceOrgId,
    filename: 'laboratory-authority.json',
  });
  const actorEvidence = await createProvisioningEvidence(instance, operator, {
    purpose: 'ACTOR_AUTHORITY',
    dealId: fixture.dealId,
    laboratoryOrgId: fixture.serviceOrgId,
    filename: 'laboratory-actors.json',
  });
  const methodEvidence = await createProvisioningEvidence(instance, operator, {
    purpose: 'METHOD_AUTHORITY',
    dealId: fixture.dealId,
    laboratoryOrgId: fixture.serviceOrgId,
    filename: 'laboratory-methods.json',
  });
  const equipmentEvidence = await createProvisioningEvidence(instance, operator, {
    purpose: 'EQUIPMENT_AUTHORITY',
    dealId: fixture.dealId,
    laboratoryOrgId: fixture.serviceOrgId,
    filename: 'laboratory-equipment.json',
  });
  const admissionEvidence = await createProvisioningEvidence(instance, operator, {
    purpose: 'ADMISSION',
    dealId: fixture.dealId,
    laboratoryOrgId: fixture.serviceOrgId,
    shipmentId: fixture.shipmentId,
    acceptanceId: fixture.acceptanceId,
    filename: 'laboratory-admission.json',
  });

  await instance.labAuthority.provision({
    commandId: `lab-authority:${fixture.dealId}`,
    idempotencyKey: `lab-authority:${fixture.dealId}`,
    dealId: fixture.dealId,
    laboratoryOrgId: fixture.serviceOrgId,
    accreditationRef: `ACCREDITATION-${fixture.serviceOrgId}`,
    evidenceRef: authorityEvidence,
    validUntil: FUTURE_AUTHORITY_AT,
    actors: ['SAMPLER', 'COURIER', 'RECEIVER', 'ANALYST', 'SIGNATORY'].map((actorType) => ({
      userId: labUser.id,
      actorType: actorType as 'SAMPLER' | 'COURIER' | 'RECEIVER' | 'ANALYST' | 'SIGNATORY',
      evidenceRef: actorEvidence,
      validUntil: FUTURE_AUTHORITY_AT,
    })),
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

  const created = await instance.labs.create({
    commandId: `lab-create:${fixture.dealId}`,
    idempotencyKey: `lab-create:${fixture.dealId}`,
    dealId: fixture.dealId,
    shipmentId: fixture.shipmentId,
    acceptanceId: fixture.acceptanceId,
    evidenceRef: admissionEvidence,
    occurredAt: new Date().toISOString(),
  }, labUser);
  fixture.sampleId = created.sample.id;

  const collectionEvidence = await createOperationEvidence(instance, labUser, {
    sampleId: fixture.sampleId,
    purpose: 'COLLECTION',
    filename: 'sample-collection.json',
  });
  let mutation = await instance.labs.collect(fixture.sampleId, {
    commandId: `lab-collect:${fixture.dealId}`,
    idempotencyKey: `lab-collect:${fixture.dealId}`,
    expectedVersion: created.sample.version,
    evidenceRef: collectionEvidence,
    occurredAt: new Date().toISOString(),
  }, labUser);

  for (const eventType of ['SEALED', 'HANDOFF', 'RECEIVED', 'OPENED'] as const) {
    const evidenceRef = await createOperationEvidence(instance, labUser, {
      sampleId: fixture.sampleId,
      purpose: eventType,
      filename: `sample-${eventType.toLowerCase()}.json`,
    });
    mutation = await instance.labs.recordCustody(fixture.sampleId, {
      commandId: `lab-custody:${fixture.dealId}:${eventType}`,
      idempotencyKey: `lab-custody:${fixture.dealId}:${eventType}`,
      expectedVersion: mutation.sample.version,
      eventType,
      evidenceRef,
      occurredAt: new Date().toISOString(),
    }, labUser);
  }

  const moistureEvidence = await createOperationEvidence(instance, labUser, {
    sampleId: fixture.sampleId,
    purpose: 'TEST',
    filename: 'test-moisture.json',
  });
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
  }, labUser);

  const proteinEvidence = await createOperationEvidence(instance, labUser, {
    sampleId: fixture.sampleId,
    purpose: 'TEST',
    filename: 'test-protein.json',
  });
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
  }, labUser);

  fixture.evidence.lab = await createOperationEvidence(instance, labUser, {
    sampleId: fixture.sampleId,
    purpose: 'PROTOCOL',
    filename: 'signed-laboratory-protocol.json',
  });
}

export function payloadForAction(fixture: DealFixture, actionId: DealActionId): Prisma.InputJsonObject {
  switch (actionId) {
    case 'seller_sign_contract':
      return { documentId: fixture.contractDocumentId, signedAt: FACT_AT, signatureEvidenceRef: fixture.evidence['seller-signature'] };
    case 'buyer_sign_contract':
      return { documentId: fixture.contractDocumentId, signedAt: '2026-07-12T09:05:00.000Z', signatureEvidenceRef: fixture.evidence['buyer-signature'] };
    case 'assign_logistics':
      return {
        carrierOrgId: fixture.serviceOrgId,
        driverUserId: fixture.users.driver.id,
        vehicleId: fixture.vehicleId,
        routeFromFacilityId: fixture.routeFromFacilityId,
        routeToFacilityId: fixture.routeToFacilityId,
      };
    case 'confirm_loading':
      return {
        shipmentId: fixture.shipmentId,
        actualWeightTons: '150.000000',
        occurredAt: '2026-07-12T10:00:00.000Z',
        basis: 'WEIGHING_TICKET',
        evidenceRef: fixture.evidence.loading,
        unit: 'TON',
      };
    case 'start_transit':
      return { shipmentId: fixture.shipmentId, occurredAt: '2026-07-12T10:15:00.000Z', basis: 'DRIVER_CONFIRMATION', evidenceRef: fixture.evidence.departure };
    case 'confirm_arrival':
      return { shipmentId: fixture.shipmentId, occurredAt: '2026-07-12T13:30:00.000Z', confirmationMethod: 'ELEVATOR_CHECKPOINT', evidenceRef: fixture.evidence.arrival };
    case 'confirm_weight':
      return {
        shipmentId: fixture.shipmentId,
        grossTons: '180.000000',
        tareTons: '30.400000',
        netTons: '149.600000',
        weighingSource: 'ELEVATOR_SCALE',
        occurredAt: '2026-07-12T13:45:00.000Z',
        evidenceRef: fixture.evidence.weighing,
        equipmentId: `scale:${fixture.dealId}`,
      };
    case 'confirm_inspection':
      return { documentId: fixture.inspectionDocumentId, evidenceRef: fixture.evidence.inspection, inspectedAt: '2026-07-12T14:00:00.000Z' };
    case 'finalize_lab':
      return {
        sampleId: fixture.sampleId,
        signedEvidenceRef: fixture.evidence.lab,
      };
    case 'accept_delivery':
      return { acceptanceId: fixture.acceptanceId, acceptedAt: '2026-07-12T15:30:00.000Z', evidenceRef: fixture.evidence.acceptance };
    default:
      return {};
  }
}

/**
 * Industrial suites run against a disposable PostgreSQL database created by the
 * CI job. Confirmed evidence and append-only facts are intentionally not deleted
 * through an application path. Test isolation is provided by unique Deal ids and
 * database disposal after the job, not by disabling production triggers.
 */
export async function cleanTenant(_prisma: PrismaService): Promise<void> {
  return Promise.resolve();
}
