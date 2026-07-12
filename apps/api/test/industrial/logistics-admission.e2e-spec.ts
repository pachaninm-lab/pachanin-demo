import * as bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import { DealCommandService } from '../../src/modules/deals/deal-command.service';
import { LogisticsAdmissionService } from '../../src/modules/deals/logistics-admission.service';
import { PostgresqlDealCommandService } from '../../src/modules/deals/postgresql-deal-command.service';
import { canonicalJson } from '../../src/modules/deals/deal-command-payload';

jest.setTimeout(180_000);

const TENANT = 'tenant-logistics-admission-e2e';
const DEAL_ID = 'DEAL-LOGISTICS-ADMISSION-E2E';
const SELLER_ORG = 'org-logistics-e2e-seller';
const BUYER_ORG = 'org-logistics-e2e-buyer';
const CARRIER_ORG = 'org-logistics-e2e-carrier';
const LOGISTICIAN_ID = 'user-logistics-e2e-logistician';
const DRIVER_ID = 'user-logistics-e2e-driver';
const CARRIER_ID = 'carrier-logistics-e2e';
const DRIVER_REGISTRY_ID = 'driver-logistics-e2e';
const VEHICLE_ID = 'vehicle-logistics-e2e';
const LINK_ID = 'driver-vehicle-logistics-e2e';
const ORIGIN_ID = 'facility-logistics-e2e-origin';
const DESTINATION_ID = 'facility-logistics-e2e-destination';
const ADMISSION_ID = 'admission-logistics-e2e';
const SHIPMENT_ID = `shipment:${DEAL_ID}`;

const logistician: RequestUser = {
  id: LOGISTICIAN_ID,
  email: 'logistician@logistics-e2e.invalid',
  fullName: 'E2E Logistician',
  role: Role.LOGISTICIAN,
  orgId: CARRIER_ORG,
  tenantId: TENANT,
  sessionId: 'session-logistics-e2e',
  mfaVerified: true,
};

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

async function clean(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe('SET session_replication_role = replica');
  try {
    for (const statement of [
      `DELETE FROM logistics.shipment_bindings WHERE deal_id = '${DEAL_ID}'`,
      `DELETE FROM logistics.deal_admissions WHERE deal_id = '${DEAL_ID}'`,
      `DELETE FROM logistics.driver_vehicle_links WHERE tenant_id = '${TENANT}'`,
      `DELETE FROM logistics.vehicles WHERE tenant_id = '${TENANT}'`,
      `DELETE FROM logistics.drivers WHERE tenant_id = '${TENANT}'`,
      `DELETE FROM logistics.facilities WHERE tenant_id = '${TENANT}'`,
      `DELETE FROM logistics.carriers WHERE tenant_id = '${TENANT}'`,
      `DELETE FROM "outbox_entries" WHERE "dealId" = '${DEAL_ID}'`,
      `DELETE FROM "audit_events" WHERE "dealId" = '${DEAL_ID}'`,
      `DELETE FROM "deal_events" WHERE "dealId" = '${DEAL_ID}'`,
      `DELETE FROM "shipments" WHERE "dealId" = '${DEAL_ID}'`,
      `DELETE FROM "deal_participants" WHERE "dealId" = '${DEAL_ID}'`,
      `DELETE FROM "deals" WHERE id = '${DEAL_ID}'`,
      `DELETE FROM "user_orgs" WHERE "organizationId" IN ('${SELLER_ORG}','${BUYER_ORG}','${CARRIER_ORG}')`,
      `DELETE FROM "users" WHERE id IN ('${LOGISTICIAN_ID}','${DRIVER_ID}')`,
      `DELETE FROM "organizations" WHERE id IN ('${SELLER_ORG}','${BUYER_ORG}','${CARRIER_ORG}')`,
    ]) {
      await prisma.$executeRawUnsafe(statement);
    }
  } finally {
    await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT');
  }
}

async function seed(prisma: PrismaService): Promise<void> {
  const now = new Date();
  const validFrom = new Date(now.getTime() - 60_000);
  const validUntil = new Date(now.getTime() + 24 * 60 * 60_000);
  const passwordHash = bcrypt.hashSync('logistics-e2e', 4);
  const carrierHash = hash(`${CARRIER_ID}:verified`);
  const driverHash = hash(`${DRIVER_REGISTRY_ID}:active`);
  const vehicleHash = hash(`${VEHICLE_ID}:active`);
  const linkHash = hash(`${LINK_ID}:active`);
  const originHash = hash(`${ORIGIN_ID}:active`);
  const destinationHash = hash(`${DESTINATION_ID}:active`);
  const admissionHash = digest({
    tenantId: TENANT,
    dealId: DEAL_ID,
    carrierId: CARRIER_ID,
    carrierOrgId: CARRIER_ORG,
    carrierSourceHash: carrierHash,
    driverId: DRIVER_REGISTRY_ID,
    driverUserId: DRIVER_ID,
    driverSourceHash: driverHash,
    vehicleId: VEHICLE_ID,
    vehicleSourceHash: vehicleHash,
    driverVehicleLinkId: LINK_ID,
    driverVehicleSourceHash: linkHash,
    routeFromFacilityId: ORIGIN_ID,
    routeFromSourceHash: originHash,
    routeToFacilityId: DESTINATION_ID,
    routeToSourceHash: destinationHash,
    validFrom: validFrom.toISOString(),
    validUntil: validUntil.toISOString(),
    evidenceRef: null,
  });

  await prisma.$transaction(async (tx) => {
    for (const org of [
      { id: SELLER_ORG, inn: '779800000001' },
      { id: BUYER_ORG, inn: '779800000002' },
      { id: CARRIER_ORG, inn: '779800000003' },
    ]) {
      await tx.organization.create({
        data: {
          ...org,
          name: org.id,
          tenantId: TENANT,
          status: 'VERIFIED',
          kycStatus: 'APPROVED',
        },
      });
    }
    for (const identity of [
      { id: LOGISTICIAN_ID, role: Role.LOGISTICIAN },
      { id: DRIVER_ID, role: Role.DRIVER },
    ]) {
      await tx.user.create({
        data: {
          id: identity.id,
          email: `${identity.id}@logistics-e2e.invalid`,
          fullName: identity.id,
          passwordHash,
          status: 'ACTIVE',
        },
      });
      await tx.userOrg.create({
        data: {
          userId: identity.id,
          organizationId: CARRIER_ORG,
          role: identity.role,
          isDefault: true,
        },
      });
    }
    await tx.deal.create({
      data: {
        id: DEAL_ID,
        dealNumber: 'ТП-LOGISTICS-E2E',
        status: 'RESERVED',
        tenantId: TENANT,
        sellerOrgId: SELLER_ORG,
        buyerOrgId: BUYER_ORG,
        totalKopecks: 1_000_000n,
        currency: 'RUB',
        version: 0n,
      },
    });
    await tx.dealParticipant.create({
      data: {
        id: `participant:${DEAL_ID}:logistician`,
        dealId: DEAL_ID,
        tenantId: TENANT,
        organizationId: CARRIER_ORG,
        userId: LOGISTICIAN_ID,
        role: Role.LOGISTICIAN,
        accessLevel: 'WORK',
        status: 'ACTIVE',
      },
    });

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.carriers (
        id, tenant_id, organization_id, status, valid_from, valid_until,
        verified_at, verified_by_user_id, source_hash
      ) VALUES (
        ${CARRIER_ID}, ${TENANT}, ${CARRIER_ORG}, 'VERIFIED', ${validFrom}, ${validUntil},
        ${now}, ${LOGISTICIAN_ID}, ${carrierHash}
      )
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.drivers (
        id, tenant_id, carrier_id, user_id, status, valid_from, valid_until,
        verified_at, verified_by_user_id, source_hash
      ) VALUES (
        ${DRIVER_REGISTRY_ID}, ${TENANT}, ${CARRIER_ID}, ${DRIVER_ID}, 'ACTIVE', ${validFrom}, ${validUntil},
        ${now}, ${LOGISTICIAN_ID}, ${driverHash}
      )
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.vehicles (
        id, tenant_id, carrier_id, registration_number, vehicle_type, capacity_tons,
        status, valid_from, valid_until, verified_at, verified_by_user_id, source_hash
      ) VALUES (
        ${VEHICLE_ID}, ${TENANT}, ${CARRIER_ID}, 'А111АА77', 'Зерновоз', 100.000000,
        'ACTIVE', ${validFrom}, ${validUntil}, ${now}, ${LOGISTICIAN_ID}, ${vehicleHash}
      )
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.driver_vehicle_links (
        id, tenant_id, driver_id, vehicle_id, status, valid_from, valid_until,
        verified_at, verified_by_user_id, source_hash
      ) VALUES (
        ${LINK_ID}, ${TENANT}, ${DRIVER_REGISTRY_ID}, ${VEHICLE_ID}, 'ACTIVE', ${validFrom}, ${validUntil},
        ${now}, ${LOGISTICIAN_ID}, ${linkHash}
      )
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.facilities (
        id, tenant_id, organization_id, kind, name, status, valid_from, valid_until,
        verified_at, verified_by_user_id, source_hash
      ) VALUES
        (${ORIGIN_ID}, ${TENANT}, ${SELLER_ORG}, 'DISPATCH', 'Origin', 'ACTIVE', ${validFrom}, ${validUntil}, ${now}, ${LOGISTICIAN_ID}, ${originHash}),
        (${DESTINATION_ID}, ${TENANT}, ${BUYER_ORG}, 'ACCEPTANCE', 'Destination', 'ACTIVE', ${validFrom}, ${validUntil}, ${now}, ${LOGISTICIAN_ID}, ${destinationHash})
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO logistics.deal_admissions (
        id, tenant_id, deal_id, carrier_id, driver_id, vehicle_id,
        driver_vehicle_link_id, route_from_facility_id, route_to_facility_id,
        status, valid_from, valid_until, approved_by_user_id, approved_at, source_hash
      ) VALUES (
        ${ADMISSION_ID}, ${TENANT}, ${DEAL_ID}, ${CARRIER_ID}, ${DRIVER_REGISTRY_ID}, ${VEHICLE_ID},
        ${LINK_ID}, ${ORIGIN_ID}, ${DESTINATION_ID}, 'CONFIRMED', ${validFrom}, ${validUntil},
        ${LOGISTICIAN_ID}, ${now}, ${admissionHash}
      )
    `);
  });
}

describe('normalized PostgreSQL logistics admission', () => {
  let prisma: PrismaService;
  let service: PostgresqlDealCommandService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await clean(prisma);
    await seed(prisma);
    const rls = new RlsTransactionService(prisma);
    service = new PostgresqlDealCommandService(
      new DealCommandService(rls),
      new LogisticsAdmissionService(rls),
    );
  });

  afterAll(async () => {
    await clean(prisma);
    await prisma.$disconnect();
  });

  it('assigns Shipment, consumes admission and commits one binding atomically', async () => {
    const result = await service.execute(DEAL_ID, 'assign_logistics', {
      commandId: 'command-logistics-e2e-0001',
      idempotencyKey: 'idempotency-logistics-e2e-0001',
      expectedVersion: '0',
      payload: {
        carrierOrgId: CARRIER_ORG,
        driverUserId: DRIVER_ID,
        vehicleId: VEHICLE_ID,
        routeFromFacilityId: ORIGIN_ID,
        routeToFacilityId: DESTINATION_ID,
      },
    }, logistician) as Record<string, unknown>;

    expect(result).toMatchObject({
      actionId: 'assign_logistics',
      status: 'LOGISTICS_ASSIGNED',
      duplicate: false,
    });

    const [shipment, admissions, bindings, events, audits, receipts] = await Promise.all([
      prisma.shipment.findUnique({ where: { id: SHIPMENT_ID } }),
      prisma.$queryRaw<Array<{ status: string; consumed_by_command_id: string }>>(Prisma.sql`
        SELECT status, consumed_by_command_id
        FROM logistics.deal_admissions
        WHERE id = ${ADMISSION_ID}
      `),
      prisma.$queryRaw<Array<{ shipment_id: string; admission_id: string }>>(Prisma.sql`
        SELECT shipment_id, admission_id
        FROM logistics.shipment_bindings
        WHERE shipment_id = ${SHIPMENT_ID}
      `),
      prisma.dealEvent.count({ where: { dealId: DEAL_ID, eventType: 'ASSIGN_LOGISTICS' } }),
      prisma.auditEvent.count({ where: { dealId: DEAL_ID, action: 'deal.assign_logistics' } }),
      prisma.outboxEntry.count({ where: { dealId: DEAL_ID, type: 'deal.assign_logistics.receipt' } }),
    ]);

    expect(shipment).toMatchObject({
      status: 'ASSIGNED',
      carrierOrgId: CARRIER_ORG,
      driverUserId: DRIVER_ID,
      vehicleNumber: VEHICLE_ID,
      routeFrom: ORIGIN_ID,
      routeTo: DESTINATION_ID,
    });
    expect(admissions).toEqual([{
      status: 'CONSUMED',
      consumed_by_command_id: 'command-logistics-e2e-0001',
    }]);
    expect(bindings).toEqual([{ shipment_id: SHIPMENT_ID, admission_id: ADMISSION_ID }]);
    expect({ events, audits, receipts }).toEqual({ events: 1, audits: 1, receipts: 1 });
  });

  it('replays idempotently without consuming a second admission', async () => {
    const replay = await service.execute(DEAL_ID, 'assign_logistics', {
      commandId: 'command-logistics-e2e-0001',
      idempotencyKey: 'idempotency-logistics-e2e-0001',
      expectedVersion: '0',
      payload: {
        carrierOrgId: CARRIER_ORG,
        driverUserId: DRIVER_ID,
        vehicleId: VEHICLE_ID,
        routeFromFacilityId: ORIGIN_ID,
        routeToFacilityId: DESTINATION_ID,
      },
    }, logistician) as Record<string, unknown>;

    expect(replay.duplicate).toBe(true);
    const [admissionCount, bindingCount] = await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT count(*)::bigint AS count FROM logistics.deal_admissions WHERE deal_id = ${DEAL_ID}
      `),
      prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT count(*)::bigint AS count FROM logistics.shipment_bindings WHERE deal_id = ${DEAL_ID}
      `),
    ]);
    expect(Number(admissionCount[0].count)).toBe(1);
    expect(Number(bindingCount[0].count)).toBe(1);
  });

  it('rejects reassignment after immutable Shipment binding', async () => {
    await expect(prisma.shipment.update({
      where: { id: SHIPMENT_ID },
      data: { vehicleNumber: 'vehicle-forged-reassignment' },
    })).rejects.toThrow(/immutable|shipment logistics binding/i);
    await expect(prisma.shipment.findUnique({ where: { id: SHIPMENT_ID } })).resolves.toMatchObject({
      vehicleNumber: VEHICLE_ID,
    });
  });
});
