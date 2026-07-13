import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { DealCommandService } from '../../src/modules/deals/deal-command.service';
import { IndustrialDealCommandGateway } from '../../src/modules/deals/industrial-deal-command.gateway';
import type { DealActionId } from '../../src/modules/deals/deal-command.policy';
import { Role, type RequestUser } from '../../src/common/types/request-user';

export const INDUSTRIAL_TENANT = 'tenant-industrial-e2e';
const FACT_AT = '2026-07-12T09:00:00.000Z';

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
  rls: RlsTransactionService;
  commands: DealCommandService;
  gateway: IndustrialDealCommandGateway;
}

export async function createInstance(): Promise<ServiceInstance> {
  const prisma = new PrismaService();
  await prisma.$connect();
  const rls = new RlsTransactionService(prisma);
  const commands = new DealCommandService(rls);
  const gateway = new IndustrialDealCommandGateway(prisma, rls, commands);
  return { prisma, rls, commands, gateway };
}

export async function destroyInstance(instance: ServiceInstance): Promise<void> {
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

async function seedNormalizedLogisticsAdmission(
  prisma: PrismaService,
  input: {
    dealId: string;
    sellerOrgId: string;
    buyerOrgId: string;
    carrierOrgId: string;
    driverUserId: string;
    vehicleId: string;
    routeFromFacilityId: string;
    routeToFacilityId: string;
  },
): Promise<void> {
  const evidenceId = `file-logistics-admission:${input.dealId}`;
  const evidenceHash = fixtureHash(JSON.stringify(input));

  await prisma.$transaction(async (tx) => {
    // Isolated CI fixture only. Production evidence reaches VERIFIED exclusively
    // through the storage finalization principal introduced by IR-10.1.
    await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
    await tx.dealDocument.upsert({
      where: { id: evidenceId },
      update: {
        tenantId: INDUSTRIAL_TENANT,
        status: 'VERIFIED',
        hash: evidenceHash,
        isImmutable: true,
      },
      create: {
        id: evidenceId,
        dealId: input.dealId,
        tenantId: INDUSTRIAL_TENANT,
        type: 'EVIDENCE_FILE',
        status: 'VERIFIED',
        name: 'normalized-logistics-admission.json',
        mimeType: 'application/json',
        s3Key: `controlled-test/${input.dealId}/normalized-logistics-admission.json`,
        sizeBytes: 512,
        hash: evidenceHash,
        uploadedByUserId: `user-e2e-${input.dealId.slice('DEAL-E2E-'.length)}-operator`,
        version: 2,
        isImmutable: true,
      },
    });

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.carriers (
        id, tenant_id, organization_id, status, evidence_file_id
      ) VALUES (
        ${`carrier:${input.carrierOrgId}`}, ${INDUSTRIAL_TENANT},
        ${input.carrierOrgId}, 'VERIFIED', ${evidenceId}
      )
      ON CONFLICT (tenant_id, organization_id) DO UPDATE SET
        status = 'VERIFIED', evidence_file_id = EXCLUDED.evidence_file_id,
        valid_until = NULL, updated_at = now()
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.drivers (
        id, tenant_id, carrier_org_id, user_id, status, evidence_file_id
      ) VALUES (
        ${`driver-registry:${input.driverUserId}`}, ${INDUSTRIAL_TENANT},
        ${input.carrierOrgId}, ${input.driverUserId}, 'ACTIVE', ${evidenceId}
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
        ${input.vehicleId}, ${INDUSTRIAL_TENANT}, ${input.carrierOrgId},
        ${input.vehicleId}, 'TRUCK', 'ACTIVE', ${evidenceId}
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
        ${`driver-vehicle:${input.dealId}`}, ${INDUSTRIAL_TENANT},
        ${`driver-registry:${input.driverUserId}`}, ${input.vehicleId}, 'ACTIVE'
      )
      ON CONFLICT (tenant_id, driver_id, vehicle_id) DO UPDATE SET
        status = 'ACTIVE', valid_until = NULL
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.facilities (
        id, tenant_id, organization_id, facility_type, name, status,
        evidence_file_id
      ) VALUES (
        ${input.routeFromFacilityId}, ${INDUSTRIAL_TENANT}, ${input.sellerOrgId},
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
        ${input.routeToFacilityId}, ${INDUSTRIAL_TENANT}, ${input.buyerOrgId},
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
        ${`admission:${input.dealId}`}, ${INDUSTRIAL_TENANT}, ${input.dealId},
        ${input.carrierOrgId}, ${input.driverUserId}, ${input.vehicleId},
        ${input.routeFromFacilityId}, ${input.routeToFacilityId}, 'ACTIVE',
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
  const sampleId = `sample:${dealId}`;
  const contractDocumentId = `contract:${dealId}`;
  const inspectionDocumentId = `inspection:${dealId}`;
  const vehicleId = `vehicle:${dealId}`;
  const routeFromFacilityId = `facility:${sellerOrgId}:dispatch`;
  const routeToFacilityId = `facility:${buyerOrgId}:acceptance`;
  const passwordHash = bcrypt.hashSync('industrial-e2e', 4);

  const evidence: Record<string, string> = Object.fromEntries(
    ['seller-signature', 'buyer-signature', 'loading', 'departure', 'arrival', 'weighing', 'inspection', 'lab', 'acceptance']
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
      await tx.organization.upsert({
        where: { id: orgId },
        update: { tenantId: INDUSTRIAL_TENANT, status: 'VERIFIED', kycStatus: 'APPROVED' },
        create: {
          id: orgId,
          inn: `77${innDigits}${innSuffix}`,
          name: orgId,
          tenantId: INDUSTRIAL_TENANT,
          status: 'VERIFIED',
          kycStatus: 'APPROVED',
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

    await tx.deal.upsert({
      where: { id: dealId },
      update: {
        status: 'DRAFT',
        tenantId: INDUSTRIAL_TENANT,
        totalKopecks,
        version: 0,
        closedAt: null,
        sagaState: { logisticsBasis },
      },
      create: {
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
      await tx.user.upsert({
        where: { id: userId },
        update: { status: 'ACTIVE', deletedAt: null },
        create: {
          id: userId,
          email: `${key}-${slug}@industrial-e2e.invalid`,
          passwordHash,
          fullName: `E2E ${key} ${slug}`,
          status: 'ACTIVE',
        },
      });
      await tx.userOrg.upsert({
        where: { userId_organizationId: { userId, organizationId: orgId } },
        update: { role, isDefault: true },
        create: { userId, organizationId: orgId, role, isDefault: true },
      });
      await tx.dealParticipant.upsert({
        where: { dealId_userId_role: { dealId, userId, role } },
        update: {
          tenantId: INDUSTRIAL_TENANT,
          organizationId: orgId,
          accessLevel: accessFor(role),
          status: 'ACTIVE',
          revokedAt: null,
        },
        create: {
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
      await tx.evidenceFile.upsert({
        where: { id: evidenceId },
        update: {
          dealId,
          shipmentId: ['loading', 'departure', 'arrival', 'weighing', 'lab', 'acceptance'].includes(kind) ? shipmentId : null,
          hash: fixtureHash(evidenceId),
          s3Key: `industrial-e2e/${dealId}/${kind}.json`,
        },
        create: {
          id: evidenceId,
          dealId,
          shipmentId: ['loading', 'departure', 'arrival', 'weighing', 'lab', 'acceptance'].includes(kind) ? shipmentId : null,
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

    await tx.dealDocument.upsert({
      where: { id: contractDocumentId },
      update: { status: 'UPLOADED', signedAt: null, signatories: null, isImmutable: false, bankAcceptance: 'ACCEPTED' },
      create: {
        id: contractDocumentId,
        dealId,
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

    await tx.dealDocument.upsert({
      where: { id: inspectionDocumentId },
      update: { status: 'VALIDATED', signedAt: null, isImmutable: false },
      create: {
        id: inspectionDocumentId,
        dealId,
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
      await tx.dealDocument.upsert({
        where: { id: document.id },
        update: {},
        create: {
          ...document,
          dealId,
          status: 'SIGNED',
          s3Key: `industrial-e2e/${dealId}/${document.type}.pdf`,
          hash: fixtureHash(document.id),
          signedAt: new Date(FACT_AT),
          signatories: JSON.stringify([{ userId: `user-e2e-${slug}-operator`, signedAt: FACT_AT, evidenceRef: evidence.acceptance }]),
          uploadedByUserId: `user-e2e-${slug}-operator`,
          isImmutable: true,
          bankRequired: true,
          releaseRequired: true,
          bankAcceptance: 'ACCEPTED',
        },
      });
    }

    await tx.labSample.upsert({
      where: { id: sampleId },
      update: { status: 'PENDING', protocol: null, finalizedAt: null, labId: serviceOrgId, labName: serviceOrgId },
      create: {
        id: sampleId,
        dealId,
        shipmentId,
        acceptanceId,
        status: 'PENDING',
        culture: 'Пшеница',
        labId: serviceOrgId,
        labName: serviceOrgId,
        collectedAt: new Date(FACT_AT),
      },
    });
  });

  await seedNormalizedLogisticsAdmission(prisma, {
    dealId,
    sellerOrgId,
    buyerOrgId,
    carrierOrgId: serviceOrgId,
    driverUserId: `user-e2e-${slug}-driver`,
    vehicleId,
    routeFromFacilityId,
    routeToFacilityId,
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

  return {
    dealId,
    sellerOrgId,
    buyerOrgId,
    serviceOrgId,
    totalKopecks,
    shipmentId,
    acceptanceId,
    sampleId,
    contractDocumentId,
    inspectionDocumentId,
    vehicleId,
    routeFromFacilityId,
    routeToFacilityId,
    evidence,
    users,
  };
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
        protocolNumber: `PROTOCOL-${fixture.dealId}`,
        labId: fixture.serviceOrgId,
        accreditationRef: `ACCREDITATION-${fixture.serviceOrgId}`,
        applicableStandard: 'CONTROLLED-STANDARD-E2E',
        finalizedAt: '2026-07-12T15:00:00.000Z',
        signedEvidenceRef: fixture.evidence.lab,
        indicators: [
          { parameter: 'moisture', value: '12.400000', unit: '%', normMax: '14.000000' },
          { parameter: 'protein', value: '13.200000', unit: '%', normMin: '12.500000' },
        ],
      };
    case 'accept_delivery':
      return { acceptanceId: fixture.acceptanceId, acceptedAt: '2026-07-12T15:30:00.000Z', evidenceRef: fixture.evidence.acceptance };
    default:
      return {};
  }
}

export async function cleanTenant(prisma: PrismaService): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // session_replication_role is connection-local. Keep the trigger bypass and
    // every cleanup statement on one transaction-bound PostgreSQL connection.
    await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = replica`);
    const dealIds = (
      await tx.deal.findMany({ where: { tenantId: INDUSTRIAL_TENANT }, select: { id: true } })
    ).map((deal) => deal.id);
    if (dealIds.length > 0) {
      const inList = dealIds.map((id) => `'${id}'`).join(',');
      for (const statement of [
        `DELETE FROM logistics.shipment_bindings WHERE deal_id IN (${inList})`,
        `DELETE FROM logistics.deal_admissions WHERE deal_id IN (${inList})`,
        `DELETE FROM "shipment_gps_points" WHERE "shipmentId" IN (SELECT id FROM "shipments" WHERE "dealId" IN (${inList}))`,
        `DELETE FROM "ledger_entries" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "deal_events" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "audit_events" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "outbox_entries" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "bank_statement_entries" WHERE "matchedDealId" IN (${inList})`,
        `DELETE FROM "bank_operations" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "payments" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "lab_tests" WHERE "sampleId" IN (SELECT id FROM "lab_samples" WHERE "dealId" IN (${inList}))`,
        `DELETE FROM "lab_samples" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "acceptance_records" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "checkpoints" WHERE "shipmentId" IN (SELECT id FROM "shipments" WHERE "dealId" IN (${inList}))`,
        `DELETE FROM "shipments" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "deal_documents" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "evidence_files" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "deal_participants" WHERE "dealId" IN (${inList})`,
        `DELETE FROM "deals" WHERE "id" IN (${inList})`,
      ]) {
        await tx.$executeRawUnsafe(statement);
      }
    }
    await tx.$executeRawUnsafe(`DELETE FROM logistics.driver_vehicle_links WHERE tenant_id = '${INDUSTRIAL_TENANT}'`);
    await tx.$executeRawUnsafe(`DELETE FROM logistics.vehicles WHERE tenant_id = '${INDUSTRIAL_TENANT}'`);
    await tx.$executeRawUnsafe(`DELETE FROM logistics.drivers WHERE tenant_id = '${INDUSTRIAL_TENANT}'`);
    await tx.$executeRawUnsafe(`DELETE FROM logistics.facilities WHERE tenant_id = '${INDUSTRIAL_TENANT}'`);
    await tx.$executeRawUnsafe(`DELETE FROM logistics.carriers WHERE tenant_id = '${INDUSTRIAL_TENANT}'`);
    await tx.$executeRawUnsafe(
      `DELETE FROM "user_orgs" WHERE "organizationId" IN (SELECT id FROM "organizations" WHERE "tenantId" = '${INDUSTRIAL_TENANT}')`,
    );
    await tx.$executeRawUnsafe(`DELETE FROM "users" WHERE "id" LIKE 'user-e2e-%'`);
    await tx.$executeRawUnsafe(`DELETE FROM "organizations" WHERE "tenantId" = '${INDUSTRIAL_TENANT}'`);
  });
}
