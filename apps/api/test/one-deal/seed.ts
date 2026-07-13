import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { PersistentAuthRepository } from '../../src/modules/auth/persistent-auth.repository';
import { CanonicalTestDealSeedService } from '../../src/modules/deals/canonical-test-deal.seed';
import { CANONICAL_TEST_DEAL_ID } from '../../src/modules/deals/deal-command.policy';

export const AUTHORITY_LOT_ID = 'LOT-RLS-AUTHORITY-001';
export const AUTHORITY_BID_ID = 'BID-RLS-AUTHORITY-001';
export const AUTHORITY_BASIS_EVENT_ID = 'basis-event-rls-authority-001';
export const AUTHORITY_CROSS_TENANT_ORG_ID = 'org-rls-authority-foreign-tenant';

const CANONICAL_TENANT_ID = 'tenant-canonical-test';
const LOGISTICS_CARRIER_ORG_ID = 'org-canonical-logistics';
const LOGISTICS_DRIVER_USER_ID = 'driver-e2e';
const LOGISTICS_VEHICLE_ID = `vehicle:${CANONICAL_TEST_DEAL_ID}`;
const LOGISTICS_ROUTE_FROM_ID = 'facility:org-canonical-seller:dispatch';
const LOGISTICS_ROUTE_TO_ID = 'facility:org-canonical-buyer:acceptance';
const LOGISTICS_EVIDENCE_ID = `file-logistics-admission:${CANONICAL_TEST_DEAL_ID}`;
export const LOGISTICS_TEST_PIN = '246810';

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

async function seedNormalizedLogisticsAdmission(prisma: PrismaService): Promise<void> {
  const evidenceHash = digest({
    dealId: CANONICAL_TEST_DEAL_ID,
    carrierOrgId: LOGISTICS_CARRIER_ORG_ID,
    driverUserId: LOGISTICS_DRIVER_USER_ID,
    vehicleId: LOGISTICS_VEHICLE_ID,
    routeFromFacilityId: LOGISTICS_ROUTE_FROM_ID,
    routeToFacilityId: LOGISTICS_ROUTE_TO_ID,
  });

  await prisma.$transaction(async (tx) => {
    // Test-only fixture setup. Production evidence must pass the isolated storage
    // finalization principal; this seed bypasses triggers only inside isolated CI.
    await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
    await tx.dealDocument.upsert({
      where: { id: LOGISTICS_EVIDENCE_ID },
      update: {
        tenantId: CANONICAL_TENANT_ID,
        status: 'VERIFIED',
        hash: evidenceHash,
        isImmutable: true,
      },
      create: {
        id: LOGISTICS_EVIDENCE_ID,
        dealId: CANONICAL_TEST_DEAL_ID,
        tenantId: CANONICAL_TENANT_ID,
        type: 'EVIDENCE_FILE',
        status: 'VERIFIED',
        name: 'normalized-logistics-admission.json',
        mimeType: 'application/json',
        s3Key: `controlled-test/${CANONICAL_TEST_DEAL_ID}/normalized-logistics-admission.json`,
        sizeBytes: 512,
        hash: evidenceHash,
        uploadedByUserId: 'operator-e2e',
        version: 2,
        isImmutable: true,
      },
    });

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.carriers (
        id, tenant_id, organization_id, status, evidence_file_id
      ) VALUES (
        ${`carrier:${LOGISTICS_CARRIER_ORG_ID}`}, ${CANONICAL_TENANT_ID},
        ${LOGISTICS_CARRIER_ORG_ID}, 'VERIFIED', ${LOGISTICS_EVIDENCE_ID}
      )
      ON CONFLICT (tenant_id, organization_id) DO UPDATE SET
        status = 'VERIFIED', evidence_file_id = EXCLUDED.evidence_file_id,
        valid_until = NULL, updated_at = now()
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.drivers (
        id, tenant_id, carrier_org_id, user_id, status, evidence_file_id
      ) VALUES (
        ${`driver-registry:${LOGISTICS_DRIVER_USER_ID}`}, ${CANONICAL_TENANT_ID},
        ${LOGISTICS_CARRIER_ORG_ID}, ${LOGISTICS_DRIVER_USER_ID}, 'ACTIVE',
        ${LOGISTICS_EVIDENCE_ID}
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
        ${LOGISTICS_VEHICLE_ID}, ${CANONICAL_TENANT_ID},
        ${LOGISTICS_CARRIER_ORG_ID}, 'А001АА77', 'TRUCK', 'ACTIVE',
        ${LOGISTICS_EVIDENCE_ID}
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
        ${`driver-vehicle:${LOGISTICS_DRIVER_USER_ID}`}, ${CANONICAL_TENANT_ID},
        ${`driver-registry:${LOGISTICS_DRIVER_USER_ID}`}, ${LOGISTICS_VEHICLE_ID}, 'ACTIVE'
      )
      ON CONFLICT (tenant_id, driver_id, vehicle_id) DO UPDATE SET
        status = 'ACTIVE', valid_until = NULL
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.facilities (
        id, tenant_id, organization_id, facility_type, name, status,
        evidence_file_id
      ) VALUES (
        ${LOGISTICS_ROUTE_FROM_ID}, ${CANONICAL_TENANT_ID},
        'org-canonical-seller', 'DISPATCH', 'Seller dispatch', 'ACTIVE',
        ${LOGISTICS_EVIDENCE_ID}
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
        ${LOGISTICS_ROUTE_TO_ID}, ${CANONICAL_TENANT_ID},
        'org-canonical-buyer', 'ACCEPTANCE', 'Buyer acceptance', 'ACTIVE',
        ${LOGISTICS_EVIDENCE_ID}
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
        ${`admission:${CANONICAL_TEST_DEAL_ID}`}, ${CANONICAL_TENANT_ID},
        ${CANONICAL_TEST_DEAL_ID}, ${LOGISTICS_CARRIER_ORG_ID},
        ${LOGISTICS_DRIVER_USER_ID}, ${LOGISTICS_VEHICLE_ID},
        ${LOGISTICS_ROUTE_FROM_ID}, ${LOGISTICS_ROUTE_TO_ID}, 'ACTIVE',
        ${LOGISTICS_EVIDENCE_ID}, ${bcrypt.hashSync(LOGISTICS_TEST_PIN, 4)}
      )
      ON CONFLICT (id) DO UPDATE SET
        status = 'ACTIVE', evidence_file_id = EXCLUDED.evidence_file_id,
        driver_pin_hash = EXCLUDED.driver_pin_hash,
        consumed_at = NULL, consumed_by_command_id = NULL,
        valid_until = NULL, updated_at = now()
    `);
  });
}


async function seedNormalizedLabAuthority(prisma: PrismaService): Promise<void> {
  const evidenceRef = `evidence:${CANONICAL_TEST_DEAL_ID}:lab`;
  const assignmentId = `lab-assignment:${CANONICAL_TEST_DEAL_ID}`;
  const accreditationId = `lab-accreditation:${CANONICAL_TEST_DEAL_ID}`;
  const methodId = `lab-method:${CANONICAL_TEST_DEAL_ID}:gost-9353`;
  const equipmentId = `lab-equipment:${CANONICAL_TEST_DEAL_ID}:analyzer-1`;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public."lab_assignments" (
        "id", "tenantId", "dealId", "labOrgId", "labUserId", "status", "evidenceRef"
      ) VALUES (
        ${assignmentId}, ${CANONICAL_TENANT_ID}, ${CANONICAL_TEST_DEAL_ID},
        'org-canonical-lab', 'lab-e2e', 'ACTIVE', ${evidenceRef}
      )
      ON CONFLICT ("dealId", "labUserId") DO UPDATE SET
        "tenantId" = EXCLUDED."tenantId", "labOrgId" = EXCLUDED."labOrgId",
        "status" = 'ACTIVE', "validUntil" = NULL, "evidenceRef" = EXCLUDED."evidenceRef",
        "updatedAt" = CURRENT_TIMESTAMP
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public."lab_accreditations" (
        "id", "tenantId", "labOrgId", "reference", "status", "scope",
        "validFrom", "validUntil", "verifiedAt", "evidenceRef"
      ) VALUES (
        ${accreditationId}, ${CANONICAL_TENANT_ID}, 'org-canonical-lab',
        'TEST-ACCREDITATION-NO-LIVE', 'ACTIVE',
        ${JSON.stringify({ cultures: ['Пшеница'], standards: ['ГОСТ 9353-2016'], testOnly: true })}::jsonb,
        TIMESTAMPTZ '2026-01-01T00:00:00Z', TIMESTAMPTZ '2027-01-01T00:00:00Z',
        TIMESTAMPTZ '2026-07-12T09:00:00Z', ${evidenceRef}
      )
      ON CONFLICT ("tenantId", "labOrgId", "reference") DO UPDATE SET
        "status" = 'ACTIVE', "scope" = EXCLUDED."scope", "validUntil" = EXCLUDED."validUntil",
        "verifiedAt" = EXCLUDED."verifiedAt", "evidenceRef" = EXCLUDED."evidenceRef",
        "updatedAt" = CURRENT_TIMESTAMP
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public."lab_methods" (
        "id", "tenantId", "labOrgId", "code", "name", "applicableStandard",
        "status", "validFrom", "validUntil", "evidenceRef"
      ) VALUES (
        ${methodId}, ${CANONICAL_TENANT_ID}, 'org-canonical-lab', 'GOST-9353',
        'Controlled test grain method', 'ГОСТ 9353-2016', 'ACTIVE',
        TIMESTAMPTZ '2026-01-01T00:00:00Z', TIMESTAMPTZ '2027-01-01T00:00:00Z', ${evidenceRef}
      )
      ON CONFLICT ("tenantId", "labOrgId", "code") DO UPDATE SET
        "status" = 'ACTIVE', "applicableStandard" = EXCLUDED."applicableStandard",
        "validUntil" = EXCLUDED."validUntil", "evidenceRef" = EXCLUDED."evidenceRef",
        "updatedAt" = CURRENT_TIMESTAMP
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public."lab_equipment" (
        "id", "tenantId", "labOrgId", "name", "serialNumber", "status",
        "calibratedAt", "calibrationValidUntil", "calibrationEvidenceRef"
      ) VALUES (
        ${equipmentId}, ${CANONICAL_TENANT_ID}, 'org-canonical-lab',
        'Controlled test analyzer', 'TEST-ANALYZER-001', 'ACTIVE',
        TIMESTAMPTZ '2026-06-01T00:00:00Z', TIMESTAMPTZ '2027-01-01T00:00:00Z', ${evidenceRef}
      )
      ON CONFLICT ("tenantId", "labOrgId", "serialNumber") DO UPDATE SET
        "status" = 'ACTIVE', "calibratedAt" = EXCLUDED."calibratedAt",
        "calibrationValidUntil" = EXCLUDED."calibrationValidUntil",
        "calibrationEvidenceRef" = EXCLUDED."calibrationEvidenceRef",
        "updatedAt" = CURRENT_TIMESTAMP
    `);
    await tx.$executeRaw(Prisma.sql`
      UPDATE public."lab_samples"
      SET "tenantId" = ${CANONICAL_TENANT_ID}, "labId" = 'org-canonical-lab',
          "assignedLabUserId" = 'lab-e2e', "currentCustodianOrgId" = 'org-canonical-surveyor',
          "currentCustodianUserId" = 'surveyor-e2e', "accreditationId" = NULL,
          "finalizedByUserId" = NULL, "protocolHash" = NULL, "status" = 'PENDING',
          "protocol" = NULL, "gost" = NULL, "finalizedAt" = NULL, "version" = 0,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${`sample:${CANONICAL_TEST_DEAL_ID}`}
    `);
  });
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('One-deal E2E seed is forbidden in production.');
  }
  if (String(process.env.SEED_CANONICAL_TEST_DEAL).toLowerCase() !== 'true') {
    throw new Error('SEED_CANONICAL_TEST_DEAL=true is required for the isolated E2E seed.');
  }

  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const authRepository = new PersistentAuthRepository(prisma);
    const seed = new CanonicalTestDealSeedService(prisma, authRepository);
    await seed.onModuleInit();
    await seedNormalizedLogisticsAdmission(prisma);
    await seedNormalizedLabAuthority(prisma);

    const basisMaterial = {
      dealNumber: 'ТП-RLS-AUTHORITY-001',
      tenantId: CANONICAL_TENANT_ID,
      lotId: AUTHORITY_LOT_ID,
      winnerBidId: AUTHORITY_BID_ID,
      sellerOrgId: 'org-canonical-seller',
      buyerOrgId: 'org-canonical-buyer',
      sellerUserId: 'farmer-e2e',
      buyerUserId: 'buyer-e2e',
      culture: 'Пшеница',
      cropClass: '3 класс',
      region: 'Контролируемый RLS-контур',
      incoterms: 'CPT',
      volumeTons: '100.000000',
      pricePerTon: '18500.000000',
      totalKopecks: '185000000',
      currency: 'RUB',
    };
    const basis = { ...basisMaterial, sourceHash: digest(basisMaterial) };
    await prisma.integrationEvent.upsert({
      where: { id: AUTHORITY_BASIS_EVENT_ID },
      update: {
        dealId: null,
        status: 'CONFIRMED',
        responsePayload: basis as Prisma.InputJsonValue,
      },
      create: {
        id: AUTHORITY_BASIS_EVENT_ID,
        adapterName: 'auction',
        direction: 'INBOUND',
        eventType: 'DEAL_BASIS_READY',
        externalId: `${AUTHORITY_LOT_ID}:${AUTHORITY_BID_ID}`,
        status: 'CONFIRMED',
        responsePayload: basis as Prisma.InputJsonValue,
        idempotencyKey: 'basis-rls-authority-001',
      },
    });
    await prisma.organization.upsert({
      where: { id: AUTHORITY_CROSS_TENANT_ORG_ID },
      update: {
        tenantId: 'tenant-rls-authority-foreign',
        status: 'VERIFIED',
        kycStatus: 'APPROVED',
      },
      create: {
        id: AUTHORITY_CROSS_TENANT_ORG_ID,
        inn: '990000000099',
        name: 'RLS foreign tenant organization',
        tenantId: 'tenant-rls-authority-foreign',
        status: 'VERIFIED',
        kycStatus: 'APPROVED',
      },
    });

    const [deal, memberships, credentialStates, authorityBasis, admission] = await Promise.all([
      prisma.deal.findUnique({ where: { id: CANONICAL_TEST_DEAL_ID } }),
      prisma.userOrg.findMany({
        where: { organization: { tenantId: CANONICAL_TENANT_ID } },
        include: { user: true, organization: true },
      }),
      prisma.$queryRaw<Array<{ user_id: string }>>`
        SELECT user_id
        FROM auth.credential_states
        WHERE user_id IN (
          SELECT u.id
          FROM public.users u
          JOIN public.user_orgs uo ON uo."userId" = u.id
          JOIN public.organizations o ON o.id = uo."organizationId"
          WHERE o."tenantId" = ${CANONICAL_TENANT_ID}
        )
      `,
      prisma.integrationEvent.findUnique({ where: { id: AUTHORITY_BASIS_EVENT_ID } }),
      prisma.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status FROM logistics.deal_admissions
        WHERE deal_id = ${CANONICAL_TEST_DEAL_ID}
      `,
    ]);

    if (!deal || deal.status !== 'DRAFT' || deal.tenantId !== CANONICAL_TENANT_ID) {
      throw new Error('Canonical deal seed did not produce the expected DRAFT tenant state.');
    }
    if (!authorityBasis || authorityBasis.status !== 'CONFIRMED' || authorityBasis.dealId !== null) {
      throw new Error('RLS authority deal basis was not seeded as an unconsumed confirmed event.');
    }
    if (admission[0]?.status !== 'ACTIVE') {
      throw new Error('Normalized logistics admission was not seeded as ACTIVE.');
    }

    const roles = new Set(memberships.map((item) => item.role));
    if (memberships.length !== 12 || roles.size !== 12 || credentialStates.length !== 12) {
      throw new Error(
        `Expected 12 PostgreSQL memberships, roles and credential states, got ${memberships.length}/${roles.size}/${credentialStates.length}.`,
      );
    }

    const deterministicIds = new Set(memberships.map((item) => item.userId));
    for (const expectedId of [
      'farmer-e2e',
      'buyer-e2e',
      'logistician-e2e',
      'driver-e2e',
      'surveyor-e2e',
      'elevator-e2e',
      'lab-e2e',
      'accounting-e2e',
      'compliance-e2e',
      'arbitrator-e2e',
      'operator-e2e',
      'executive-e2e',
    ]) {
      if (!deterministicIds.has(expectedId)) throw new Error(`Missing deterministic persistent identity ${expectedId}`);
    }

    process.stdout.write(`${JSON.stringify({
      seeded: true,
      identityMode: 'persistent-postgresql',
      dealId: deal.id,
      status: deal.status,
      tenantId: deal.tenantId,
      memberships: memberships.length,
      credentialStates: credentialStates.length,
      roles: [...roles].sort(),
      logisticsAdmission: admission[0],
      authorityBasis: {
        eventId: authorityBasis.id,
        lotId: AUTHORITY_LOT_ID,
        winnerBidId: AUTHORITY_BID_ID,
      },
    })}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
