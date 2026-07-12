import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { canonicalJson } from '../../src/modules/deals/deal-command-payload';
import { CANONICAL_TEST_DEAL_ID } from '../../src/modules/deals/deal-command.policy';

const TENANT_ID = 'tenant-canonical-test';
const CARRIER_ORG_ID = 'org-canonical-logistics';
const DRIVER_USER_ID = 'driver-e2e';
const VEHICLE_ID = `vehicle:${CANONICAL_TEST_DEAL_ID}`;
const ROUTE_FROM_ID = 'facility:org-canonical-seller:dispatch';
const ROUTE_TO_ID = 'facility:org-canonical-buyer:acceptance';
const CARRIER_ID = `carrier:${CARRIER_ORG_ID}`;
const DRIVER_ID = `driver:${DRIVER_USER_ID}`;
const LINK_ID = `driver-vehicle:${DRIVER_USER_ID}:${VEHICLE_ID}`;
const ADMISSION_ID = `logistics-admission:${CANONICAL_TEST_DEAL_ID}`;
const VALID_FROM = new Date('2026-07-12T08:00:00.000Z');
const VALID_UNTIL = new Date('2030-01-01T00:00:00.000Z');

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export async function seedCanonicalLogisticsAdmission(prisma: PrismaService): Promise<void> {
  const carrierHash = hash(`${CARRIER_ID}:verified`);
  const driverHash = hash(`${DRIVER_ID}:active`);
  const vehicleHash = hash(`${VEHICLE_ID}:active`);
  const linkHash = hash(`${LINK_ID}:active`);
  const originHash = hash(`${ROUTE_FROM_ID}:active`);
  const destinationHash = hash(`${ROUTE_TO_ID}:active`);
  const evidenceRef = `evidence:${CANONICAL_TEST_DEAL_ID}:loading`;
  const admissionHash = digest({
    tenantId: TENANT_ID,
    dealId: CANONICAL_TEST_DEAL_ID,
    carrierId: CARRIER_ID,
    carrierOrgId: CARRIER_ORG_ID,
    carrierSourceHash: carrierHash,
    driverId: DRIVER_ID,
    driverUserId: DRIVER_USER_ID,
    driverSourceHash: driverHash,
    vehicleId: VEHICLE_ID,
    vehicleSourceHash: vehicleHash,
    driverVehicleLinkId: LINK_ID,
    driverVehicleSourceHash: linkHash,
    routeFromFacilityId: ROUTE_FROM_ID,
    routeFromSourceHash: originHash,
    routeToFacilityId: ROUTE_TO_ID,
    routeToSourceHash: destinationHash,
    validFrom: VALID_FROM.toISOString(),
    validUntil: VALID_UNTIL.toISOString(),
    evidenceRef,
  });

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.carriers (
        id, tenant_id, organization_id, status, valid_from, valid_until,
        verified_at, verified_by_user_id, source_hash, evidence_ref
      ) VALUES (
        ${CARRIER_ID}, ${TENANT_ID}, ${CARRIER_ORG_ID}, 'VERIFIED', ${VALID_FROM}, ${VALID_UNTIL},
        ${VALID_FROM}, 'operator-e2e', ${carrierHash}, ${evidenceRef}
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        organization_id = EXCLUDED.organization_id,
        status = EXCLUDED.status,
        valid_from = EXCLUDED.valid_from,
        valid_until = EXCLUDED.valid_until,
        verified_at = EXCLUDED.verified_at,
        verified_by_user_id = EXCLUDED.verified_by_user_id,
        source_hash = EXCLUDED.source_hash,
        evidence_ref = EXCLUDED.evidence_ref
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.drivers (
        id, tenant_id, carrier_id, user_id, status, valid_from, valid_until,
        verified_at, verified_by_user_id, source_hash, evidence_ref
      ) VALUES (
        ${DRIVER_ID}, ${TENANT_ID}, ${CARRIER_ID}, ${DRIVER_USER_ID}, 'ACTIVE', ${VALID_FROM}, ${VALID_UNTIL},
        ${VALID_FROM}, 'operator-e2e', ${driverHash}, ${evidenceRef}
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        carrier_id = EXCLUDED.carrier_id,
        user_id = EXCLUDED.user_id,
        status = EXCLUDED.status,
        valid_from = EXCLUDED.valid_from,
        valid_until = EXCLUDED.valid_until,
        verified_at = EXCLUDED.verified_at,
        verified_by_user_id = EXCLUDED.verified_by_user_id,
        source_hash = EXCLUDED.source_hash,
        evidence_ref = EXCLUDED.evidence_ref
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.vehicles (
        id, tenant_id, carrier_id, registration_number, vehicle_type, capacity_tons,
        status, valid_from, valid_until, verified_at, verified_by_user_id, source_hash, evidence_ref
      ) VALUES (
        ${VEHICLE_ID}, ${TENANT_ID}, ${CARRIER_ID}, 'А000АА77', 'Зерновоз', 200.000000,
        'ACTIVE', ${VALID_FROM}, ${VALID_UNTIL}, ${VALID_FROM}, 'operator-e2e', ${vehicleHash}, ${evidenceRef}
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        carrier_id = EXCLUDED.carrier_id,
        registration_number = EXCLUDED.registration_number,
        vehicle_type = EXCLUDED.vehicle_type,
        capacity_tons = EXCLUDED.capacity_tons,
        status = EXCLUDED.status,
        valid_from = EXCLUDED.valid_from,
        valid_until = EXCLUDED.valid_until,
        verified_at = EXCLUDED.verified_at,
        verified_by_user_id = EXCLUDED.verified_by_user_id,
        source_hash = EXCLUDED.source_hash,
        evidence_ref = EXCLUDED.evidence_ref
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.driver_vehicle_links (
        id, tenant_id, driver_id, vehicle_id, status, valid_from, valid_until,
        verified_at, verified_by_user_id, source_hash, evidence_ref
      ) VALUES (
        ${LINK_ID}, ${TENANT_ID}, ${DRIVER_ID}, ${VEHICLE_ID}, 'ACTIVE', ${VALID_FROM}, ${VALID_UNTIL},
        ${VALID_FROM}, 'operator-e2e', ${linkHash}, ${evidenceRef}
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        driver_id = EXCLUDED.driver_id,
        vehicle_id = EXCLUDED.vehicle_id,
        status = EXCLUDED.status,
        valid_from = EXCLUDED.valid_from,
        valid_until = EXCLUDED.valid_until,
        verified_at = EXCLUDED.verified_at,
        verified_by_user_id = EXCLUDED.verified_by_user_id,
        source_hash = EXCLUDED.source_hash,
        evidence_ref = EXCLUDED.evidence_ref
    `);
    for (const facility of [
      { id: ROUTE_FROM_ID, organizationId: 'org-canonical-seller', kind: 'DISPATCH', name: 'Точка погрузки продавца', sourceHash: originHash },
      { id: ROUTE_TO_ID, organizationId: 'org-canonical-buyer', kind: 'ACCEPTANCE', name: 'Точка приёмки покупателя', sourceHash: destinationHash },
    ]) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO logistics.facilities (
          id, tenant_id, organization_id, kind, name, status, valid_from, valid_until,
          verified_at, verified_by_user_id, source_hash, evidence_ref
        ) VALUES (
          ${facility.id}, ${TENANT_ID}, ${facility.organizationId}, ${facility.kind}, ${facility.name},
          'ACTIVE', ${VALID_FROM}, ${VALID_UNTIL}, ${VALID_FROM}, 'operator-e2e', ${facility.sourceHash}, ${evidenceRef}
        )
        ON CONFLICT (id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          organization_id = EXCLUDED.organization_id,
          kind = EXCLUDED.kind,
          name = EXCLUDED.name,
          status = EXCLUDED.status,
          valid_from = EXCLUDED.valid_from,
          valid_until = EXCLUDED.valid_until,
          verified_at = EXCLUDED.verified_at,
          verified_by_user_id = EXCLUDED.verified_by_user_id,
          source_hash = EXCLUDED.source_hash,
          evidence_ref = EXCLUDED.evidence_ref
      `);
    }
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.deal_admissions (
        id, tenant_id, deal_id, carrier_id, driver_id, vehicle_id, driver_vehicle_link_id,
        route_from_facility_id, route_to_facility_id, status, valid_from, valid_until,
        approved_by_user_id, approved_at, source_hash, evidence_ref
      ) VALUES (
        ${ADMISSION_ID}, ${TENANT_ID}, ${CANONICAL_TEST_DEAL_ID}, ${CARRIER_ID}, ${DRIVER_ID}, ${VEHICLE_ID}, ${LINK_ID},
        ${ROUTE_FROM_ID}, ${ROUTE_TO_ID}, 'CONFIRMED', ${VALID_FROM}, ${VALID_UNTIL},
        'operator-e2e', ${VALID_FROM}, ${admissionHash}, ${evidenceRef}
      )
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        deal_id = EXCLUDED.deal_id,
        carrier_id = EXCLUDED.carrier_id,
        driver_id = EXCLUDED.driver_id,
        vehicle_id = EXCLUDED.vehicle_id,
        driver_vehicle_link_id = EXCLUDED.driver_vehicle_link_id,
        route_from_facility_id = EXCLUDED.route_from_facility_id,
        route_to_facility_id = EXCLUDED.route_to_facility_id,
        status = 'CONFIRMED',
        valid_from = EXCLUDED.valid_from,
        valid_until = EXCLUDED.valid_until,
        approved_by_user_id = EXCLUDED.approved_by_user_id,
        approved_at = EXCLUDED.approved_at,
        source_hash = EXCLUDED.source_hash,
        evidence_ref = EXCLUDED.evidence_ref,
        consumed_at = NULL,
        consumed_by_user_id = NULL,
        consumed_by_command_id = NULL,
        version = 0
    `);
  });
}
