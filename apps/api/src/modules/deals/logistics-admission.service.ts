import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import { canonicalJson, record, requiredString } from './deal-command-payload';
import type { LogisticsCommandContext } from './logistics-admission-context';

export type ResolvedLogisticsAdmission = LogisticsCommandContext & Readonly<{
  carrierName: string;
  driverName: string;
  vehicleRegistrationNumber: string;
  vehicleType: string | null;
  routeFromName: string;
  routeToName: string;
  sourceHash: string;
  evidenceRef: string | null;
}>;

type AdmissionRow = {
  admission_id: string;
  tenant_id: string;
  deal_id: string;
  carrier_id: string;
  carrier_org_id: string;
  carrier_name: string;
  carrier_source_hash: string;
  driver_id: string;
  driver_user_id: string;
  driver_name: string;
  driver_source_hash: string;
  vehicle_id: string;
  vehicle_registration_number: string;
  vehicle_type: string | null;
  vehicle_source_hash: string;
  driver_vehicle_link_id: string;
  driver_vehicle_source_hash: string;
  route_from_facility_id: string;
  route_from_name: string;
  route_from_source_hash: string;
  route_to_facility_id: string;
  route_to_name: string;
  route_to_source_hash: string;
  valid_from: Date;
  valid_until: Date | null;
  admission_source_hash: string;
  evidence_ref: string | null;
};

function admissionMaterial(row: AdmissionRow) {
  return {
    tenantId: row.tenant_id,
    dealId: row.deal_id,
    carrierId: row.carrier_id,
    carrierOrgId: row.carrier_org_id,
    carrierSourceHash: row.carrier_source_hash,
    driverId: row.driver_id,
    driverUserId: row.driver_user_id,
    driverSourceHash: row.driver_source_hash,
    vehicleId: row.vehicle_id,
    vehicleSourceHash: row.vehicle_source_hash,
    driverVehicleLinkId: row.driver_vehicle_link_id,
    driverVehicleSourceHash: row.driver_vehicle_source_hash,
    routeFromFacilityId: row.route_from_facility_id,
    routeFromSourceHash: row.route_from_source_hash,
    routeToFacilityId: row.route_to_facility_id,
    routeToSourceHash: row.route_to_source_hash,
    validFrom: row.valid_from.toISOString(),
    validUntil: row.valid_until?.toISOString() ?? null,
    evidenceRef: row.evidence_ref,
  };
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

@Injectable()
export class LogisticsAdmissionService {
  constructor(private readonly rls: RlsTransactionService) {}

  async resolveForCommand(
    dealId: string,
    rawPayload: unknown,
    user: RequestUser,
    commandId: string,
  ): Promise<ResolvedLogisticsAdmission> {
    const payload = record(rawPayload);
    const carrierOrgId = requiredString(payload, 'carrierOrgId');
    const driverUserId = requiredString(payload, 'driverUserId');
    const vehicleId = requiredString(payload, 'vehicleId');
    const routeFromFacilityId = requiredString(payload, 'routeFromFacilityId');
    const routeToFacilityId = requiredString(payload, 'routeToFacilityId');

    if (!commandId.trim()) {
      throw new UnprocessableEntityException({
        code: 'LOGISTICS_COMMAND_ID_REQUIRED',
        field: 'commandId',
      });
    }

    return this.rls.withTrustedContext(user, async (tx) => {
      const [rows, deal] = await Promise.all([
        tx.$queryRaw<AdmissionRow[]>(Prisma.sql`
          SELECT *
          FROM logistics.resolve_deal_admission(
            ${dealId},
            ${carrierOrgId},
            ${driverUserId},
            ${vehicleId},
            ${routeFromFacilityId},
            ${routeToFacilityId}
          )
        `),
        tx.deal.findUnique({
          where: { id: dealId },
          select: { tenantId: true, sellerOrgId: true, buyerOrgId: true },
        }),
      ]);
      const row = rows[0];
      if (!row || !deal || deal.tenantId !== user.tenantId) {
        throw new UnprocessableEntityException({
          code: 'LOGISTICS_ADMISSION_REQUIRED',
          field: 'payload',
          message: 'Перевозчик, водитель, ТС или точки маршрута не имеют действующего допуска для этой сделки.',
        });
      }

      const expectedHash = digest(admissionMaterial(row));
      if (expectedHash !== row.admission_source_hash) {
        throw new UnprocessableEntityException({
          code: 'LOGISTICS_ADMISSION_HASH_MISMATCH',
          field: 'payload',
          message: 'Контрольная сумма допуска логистики не совпадает с реестром.',
        });
      }

      return Object.freeze({
        commandId,
        admissionId: row.admission_id,
        basis: {
          carriers: [{ id: row.carrier_org_id, status: 'VERIFIED', tenantId: row.tenant_id }],
          drivers: [{
            id: row.driver_user_id,
            carrierOrgId: row.carrier_org_id,
            status: 'ACTIVE',
            vehicleIds: [row.vehicle_id],
          }],
          vehicles: [{ id: row.vehicle_id, carrierOrgId: row.carrier_org_id, status: 'ACTIVE' }],
          facilities: [
            { id: row.route_from_facility_id, organizationId: deal.sellerOrgId, status: 'ACTIVE' },
            { id: row.route_to_facility_id, organizationId: deal.buyerOrgId, status: 'ACTIVE' },
          ],
        },
        carrierName: row.carrier_name,
        driverName: row.driver_name,
        vehicleRegistrationNumber: row.vehicle_registration_number,
        vehicleType: row.vehicle_type,
        routeFromName: row.route_from_name,
        routeToName: row.route_to_name,
        sourceHash: row.admission_source_hash,
        evidenceRef: row.evidence_ref,
      });
    });
  }
}
