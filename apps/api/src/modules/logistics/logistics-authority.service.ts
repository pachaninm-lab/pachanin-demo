import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { RequestUser, Role } from '../../common/types/request-user';

/**
 * Онбординг логистики как поставщика услуг сделки (аналог LabAuthorityService).
 *
 * Прежде нормализованный граф логистического допуска (carrier / vehicle /
 * driver / driver_vehicle_link / facility / deal_admission) заводился только
 * сидом или внутрисервисно — HTTP-пути не было, перевозчик не мог завести
 * операционные записи через API. Здесь один привилегированный идемпотентный
 * (upsert) вызов оператора заводит весь граф допуска для конкретной сделки,
 * с обязательным verified-immutable доказательством и журналом.
 *
 * БД-триггеры остаются авторитетом: carrier/vehicle/driver/facility должны быть
 * в tenant'е сделки и verified/active, evidence — VERIFIED immutable
 * EVIDENCE_FILE (app_logistics_evidence_valid), водитель — член организации
 * перевозчика, facility маршрута — у продавца (from) и покупателя (to).
 */

const PRIVILEGED: ReadonlySet<string> = new Set<string>([
  Role.ADMIN,
  Role.SUPPORT_MANAGER,
  Role.COMPLIANCE_OFFICER,
  Role.LOGISTICIAN,
]);

export type ProvisionDealAdmissionInput = Readonly<{
  dealId: string;
  carrierOrgId: string;
  driverUserId: string;
  vehicleRegistration: string;
  evidenceRef: string;
  driverPin: string;
  vehicleType?: string;
  validUntil?: string;
  reason?: string;
}>;

@Injectable()
export class LogisticsAuthorityService {
  private readonly logger = new Logger(LogisticsAuthorityService.name);

  constructor(private readonly rls: RlsTransactionService) {}

  async provisionDealAdmission(input: ProvisionDealAdmissionInput, user: RequestUser) {
    if (!PRIVILEGED.has(String(user.role))) {
      throw new ForbiddenException({ code: 'LOGISTICS_AUTHORITY_ROLE_REQUIRED' });
    }
    if (!user.tenantId) {
      throw new ForbiddenException({ code: 'TENANT_CONTEXT_REQUIRED' });
    }
    const dealId = String(input.dealId ?? '').trim();
    const carrierOrgId = String(input.carrierOrgId ?? '').trim();
    const driverUserId = String(input.driverUserId ?? '').trim();
    const registration = String(input.vehicleRegistration ?? '').trim();
    const evidenceRef = String(input.evidenceRef ?? '').trim();
    const pin = String(input.driverPin ?? '');
    if (!dealId || !carrierOrgId || !driverUserId || !registration || !evidenceRef) {
      throw new ConflictException({ code: 'LOGISTICS_ADMISSION_FIELDS_REQUIRED' });
    }
    if (!/^\d{4,8}$/.test(pin)) {
      throw new ConflictException({ code: 'DRIVER_PIN_INVALID', message: 'PIN водителя — 4–8 цифр.' });
    }
    const vehicleType = String(input.vehicleType ?? 'TRUCK').trim().toUpperCase();
    const validUntil = input.validUntil ?? null;
    const pinHash = await bcrypt.hash(pin, 8);

    return this.rls.withTrustedContext(user, async (tx) => {
      const tenantId = user.tenantId!;
      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        select: { id: true, tenantId: true, sellerOrgId: true, buyerOrgId: true },
      });
      if (!deal) throw new NotFoundException(`Сделка ${dealId} не найдена.`);
      if (deal.tenantId !== tenantId) {
        // Как и в labs: онбординг идёт в tenant'е сделки, совпадающем с сессией.
        throw new ForbiddenException({ code: 'DEAL_TENANT_SCOPE_DENIED' });
      }

      // Доказательство — VERIFIED immutable EVIDENCE_FILE этой сделки.
      const evidenceValid = await tx.$queryRaw<Array<{ valid: boolean }>>(Prisma.sql`
        SELECT public.app_logistics_evidence_valid(${evidenceRef}, ${tenantId}, ${dealId}) AS valid
      `);
      if (evidenceValid[0]?.valid !== true) {
        throw new ConflictException({
          code: 'LOGISTICS_EVIDENCE_NOT_VERIFIED',
          message: 'evidenceRef должен быть VERIFIED immutable EVIDENCE_FILE этой сделки.',
        });
      }

      // Перевозчик — допущенная организация в tenant'е сделки.
      const carrier = await tx.organization.findUnique({
        where: { id: carrierOrgId },
        select: { id: true, tenantId: true, status: true, kycStatus: true },
      });
      if (!carrier || carrier.tenantId !== tenantId) {
        throw new ConflictException({ code: 'CARRIER_ORG_NOT_IN_DEAL_TENANT' });
      }
      if (carrier.status !== 'VERIFIED' || carrier.kycStatus !== 'APPROVED') {
        throw new ConflictException({ code: 'CARRIER_ORG_NOT_ADMITTED' });
      }

      // Водитель — активный член организации перевозчика.
      const membership = await tx.userOrg.findUnique({
        where: { userId_organizationId: { userId: driverUserId, organizationId: carrierOrgId } },
        include: { user: { select: { status: true, deletedAt: true } } },
      });
      if (!membership) {
        throw new ConflictException({ code: 'DRIVER_NOT_IN_CARRIER_ORG' });
      }
      if (membership.user.status !== 'ACTIVE' || membership.user.deletedAt) {
        throw new ConflictException({ code: 'DRIVER_INACTIVE' });
      }

      const carrierId = `carrier:${dealId}`;
      const vehicleId = `vehicle:${dealId}`;
      const driverId = `driver:${dealId}`;
      const linkId = `dvlink:${dealId}`;
      const facilityFrom = `facility:from:${dealId}`;
      const facilityTo = `facility:to:${dealId}`;
      const admissionId = `admission:${dealId}`;

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO logistics.carriers (id, tenant_id, organization_id, status, evidence_file_id, valid_from)
        VALUES (${carrierId}, ${tenantId}, ${carrierOrgId}, 'VERIFIED', ${evidenceRef}, now())
        ON CONFLICT (tenant_id, organization_id) DO UPDATE SET
          status = 'VERIFIED', evidence_file_id = EXCLUDED.evidence_file_id, valid_until = NULL, updated_at = now()
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO logistics.vehicles (id, tenant_id, carrier_org_id, registration_number, vehicle_type, status, evidence_file_id, valid_from)
        VALUES (${vehicleId}, ${tenantId}, ${carrierOrgId}, ${registration}, ${vehicleType}, 'ACTIVE', ${evidenceRef}, now())
        ON CONFLICT (id) DO UPDATE SET
          carrier_org_id = EXCLUDED.carrier_org_id, status = 'ACTIVE',
          evidence_file_id = EXCLUDED.evidence_file_id, valid_until = NULL, updated_at = now()
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO logistics.drivers (id, tenant_id, carrier_org_id, user_id, status, evidence_file_id, valid_from)
        VALUES (${driverId}, ${tenantId}, ${carrierOrgId}, ${driverUserId}, 'ACTIVE', ${evidenceRef}, now())
        ON CONFLICT (tenant_id, user_id) DO UPDATE SET
          carrier_org_id = EXCLUDED.carrier_org_id, status = 'ACTIVE',
          evidence_file_id = EXCLUDED.evidence_file_id, valid_until = NULL, updated_at = now()
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO logistics.driver_vehicle_links (id, tenant_id, driver_id, vehicle_id, status, valid_from)
        VALUES (${linkId}, ${tenantId}, ${driverId}, ${vehicleId}, 'ACTIVE', now())
        ON CONFLICT (tenant_id, driver_id, vehicle_id) DO UPDATE SET status = 'ACTIVE', valid_until = NULL
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO logistics.facilities (id, tenant_id, organization_id, facility_type, name, status, evidence_file_id, valid_from)
        VALUES
          (${facilityFrom}, ${tenantId}, ${deal.sellerOrgId}, 'DISPATCH', 'Отгрузка продавца', 'ACTIVE', ${evidenceRef}, now()),
          (${facilityTo}, ${tenantId}, ${deal.buyerOrgId}, 'ACCEPTANCE', 'Приёмка покупателя', 'ACTIVE', ${evidenceRef}, now())
        ON CONFLICT (id) DO UPDATE SET
          status = 'ACTIVE', evidence_file_id = EXCLUDED.evidence_file_id, valid_until = NULL, updated_at = now()
      `);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO logistics.deal_admissions (
          id, tenant_id, deal_id, carrier_org_id, driver_user_id, vehicle_id,
          route_from_facility_id, route_to_facility_id, status, evidence_file_id, driver_pin_hash, valid_from
        ) VALUES (
          ${admissionId}, ${tenantId}, ${dealId}, ${carrierOrgId}, ${driverUserId}, ${vehicleId},
          ${facilityFrom}, ${facilityTo}, 'ACTIVE', ${evidenceRef}, ${pinHash}, now()
        )
        ON CONFLICT (id) DO UPDATE SET
          status = 'ACTIVE', evidence_file_id = EXCLUDED.evidence_file_id,
          driver_pin_hash = EXCLUDED.driver_pin_hash, consumed_at = NULL,
          consumed_by_command_id = NULL, valid_until = NULL, updated_at = now()
      `);

      await tx.auditEvent.create({
        data: {
          action: 'LOGISTICS_ADMISSION_PROVISIONED',
          actorUserId: user.id,
          actorRole: String(user.role),
          tenantId,
          dealId,
          orgId: carrierOrgId,
          objectType: 'logistics_deal_admission',
          objectId: admissionId,
          afterState: { carrierOrgId, driverUserId, vehicleId },
          outcome: 'PROVISIONED',
          reason: String(input.reason ?? 'Онбординг логистического допуска сделки оператором.'),
        },
      }).catch((e) => this.logger.error(`Audit write failed for logistics admission ${admissionId}: ${e.message}`));

      return {
        admissionId,
        dealId,
        carrierOrgId,
        driverUserId,
        vehicleId,
        routeFromFacilityId: facilityFrom,
        routeToFacilityId: facilityTo,
        status: 'ACTIVE',
      };
    });
  }
}
