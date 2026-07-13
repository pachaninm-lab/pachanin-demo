import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../common/types/request-user';
import { ServerBoundEvidenceUploadService } from '../storage/server-bound-evidence-upload.service';
import {
  type LabOperationEvidencePurpose,
  type RequestProvisioningEvidenceUploadDto,
  type RequestSampleEvidenceUploadDto,
} from './dto/request-lab-evidence-upload.dto';

const PROVISIONING_ROLES = new Set<Role>([
  Role.ADMIN,
  Role.SUPPORT_MANAGER,
  Role.COMPLIANCE_OFFICER,
]);

const ACTOR_BY_PURPOSE: Record<LabOperationEvidencePurpose, string> = {
  COLLECTION: 'SAMPLER',
  SEALED: 'COURIER',
  HANDOFF: 'COURIER',
  RECEIVED: 'RECEIVER',
  OPENED: 'ANALYST',
  TEST: 'ANALYST',
  PROTOCOL: 'SIGNATORY',
};

type SampleScope = Readonly<{
  id: string;
  dealId: string;
  shipmentId: string | null;
  acceptanceId: string | null;
  tenantId: string;
  laboratoryOrgId: string | null;
}>;

/**
 * Derives immutable laboratory evidence metadata from authoritative PostgreSQL
 * state. The caller selects an operation, but never supplies tenant, sample,
 * shipment, acceptance or laboratory bindings for an existing sample.
 */
@Injectable()
export class LabEvidenceUploadService {
  constructor(
    private readonly rls: RlsTransactionService,
    private readonly uploads: ServerBoundEvidenceUploadService,
  ) {}

  async requestForSample(
    sampleId: string,
    dto: RequestSampleEvidenceUploadDto,
    user: RequestUser,
  ) {
    const scope = await this.rls.withTrustedContext(user, async (tx, context) => {
      const rows = await tx.$queryRaw<SampleScope[]>(Prisma.sql`
        SELECT
          sample."id",
          sample."dealId",
          sample."shipmentId",
          sample."acceptanceId",
          sample."tenantId",
          sample."labId" AS "laboratoryOrgId"
        FROM public."lab_samples" sample
        WHERE sample."id" = ${sampleId}
          AND sample."tenantId" = ${context.tenantId}
        LIMIT 1
      `);
      const sample = rows[0];
      if (!sample || !sample.laboratoryOrgId) {
        throw new NotFoundException({ code: 'LAB_SAMPLE_NOT_AVAILABLE' });
      }

      const actorType = ACTOR_BY_PURPOSE[dto.purpose];
      const actor = await tx.$queryRaw<Array<{ valid: boolean }>>(Prisma.sql`
        SELECT public.app_labs_actor_valid(
          ${context.tenantId}, ${sample.laboratoryOrgId}, ${context.userId},
          ${actorType}, now()
        ) AS valid
      `);
      if (!actor[0]?.valid) {
        throw new ForbiddenException({
          code: 'LAB_PHYSICAL_ACTOR_TYPE_REQUIRED',
          actorType,
        });
      }
      return sample;
    });

    const protocolNumber = dto.purpose === 'PROTOCOL'
      ? requiredProtocolNumber(dto.protocolNumber)
      : undefined;
    if (dto.purpose !== 'PROTOCOL' && dto.protocolNumber !== undefined) {
      throw new UnprocessableEntityException({
        code: 'LAB_PROTOCOL_NUMBER_NOT_ALLOWED',
        field: 'protocolNumber',
      });
    }

    return this.uploads.request({
      dealId: scope.dealId,
      filename: dto.filename,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      metadata: {
        labPurpose: dto.purpose,
        sampleId: scope.id,
        shipmentId: scope.shipmentId,
        acceptanceId: scope.acceptanceId,
        laboratoryOrgId: scope.laboratoryOrgId,
        ...(protocolNumber ? { protocolNumber } : {}),
      },
    }, user);
  }

  async requestForProvisioning(
    dto: RequestProvisioningEvidenceUploadDto,
    user: RequestUser,
  ) {
    if (!PROVISIONING_ROLES.has(user.role)) {
      throw new ForbiddenException({ code: 'LAB_PROVISIONING_ROLE_REQUIRED' });
    }

    const scope = await this.rls.withTrustedContext(user, async (tx, context) => {
      const deal = await tx.deal.findUnique({
        where: { id: dto.dealId },
        select: { id: true, tenantId: true },
      });
      if (!deal || deal.tenantId !== context.tenantId) {
        throw new NotFoundException({ code: 'LAB_PROVISIONING_DEAL_NOT_AVAILABLE' });
      }
      const laboratory = await tx.organization.findUnique({
        where: { id: dto.laboratoryOrgId },
        select: { id: true, tenantId: true, status: true, kycStatus: true },
      });
      if (
        !laboratory
        || laboratory.tenantId !== context.tenantId
        || laboratory.status !== 'VERIFIED'
        || laboratory.kycStatus !== 'APPROVED'
      ) {
        throw new NotFoundException({ code: 'LABORATORY_ORGANIZATION_NOT_AVAILABLE' });
      }

      if (dto.purpose === 'ADMISSION') {
        if (!dto.shipmentId || !dto.acceptanceId) {
          throw new UnprocessableEntityException({
            code: 'LAB_ADMISSION_SCOPE_REQUIRED',
            fields: ['shipmentId', 'acceptanceId'],
          });
        }
        const [shipment, acceptance] = await Promise.all([
          tx.shipment.findFirst({
            where: { id: dto.shipmentId, dealId: dto.dealId },
            select: { id: true },
          }),
          tx.acceptanceRecord.findFirst({
            where: { id: dto.acceptanceId, dealId: dto.dealId, shipmentId: dto.shipmentId },
            select: { id: true },
          }),
        ]);
        if (!shipment || !acceptance) {
          throw new NotFoundException({ code: 'LAB_ADMISSION_SCOPE_NOT_AVAILABLE' });
        }
      } else if (dto.shipmentId !== undefined || dto.acceptanceId !== undefined) {
        throw new UnprocessableEntityException({
          code: 'LAB_PROVISIONING_SCOPE_NOT_ALLOWED',
          fields: ['shipmentId', 'acceptanceId'],
        });
      }

      return {
        dealId: deal.id,
        tenantId: context.tenantId,
        laboratoryOrgId: laboratory.id,
      };
    });

    return this.uploads.request({
      dealId: scope.dealId,
      filename: dto.filename,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      metadata: {
        labPurpose: dto.purpose,
        laboratoryOrgId: scope.laboratoryOrgId,
        ...(dto.purpose === 'ADMISSION'
          ? {
              shipmentId: dto.shipmentId as string,
              acceptanceId: dto.acceptanceId as string,
            }
          : {}),
      },
    }, user);
  }
}

function requiredProtocolNumber(value: string | undefined): string {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > 200) {
    throw new UnprocessableEntityException({
      code: 'LAB_PROTOCOL_NUMBER_REQUIRED',
      field: 'protocolNumber',
    });
  }
  return normalized;
}
