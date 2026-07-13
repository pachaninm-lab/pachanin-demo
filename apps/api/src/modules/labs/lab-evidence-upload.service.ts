import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  RlsTransactionService,
  type TrustedRlsContext,
} from '../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../common/types/request-user';
import {
  OBJECT_STORAGE_ADAPTER,
  type ObjectStorageAdapter,
  normalizeMimeType,
} from '../storage/object-storage.adapter';
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

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/json',
  'application/xml',
  'text/xml',
  'application/pkcs7-signature',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const HARD_MAX_BYTES = 200 * 1024 * 1024;
const DEFAULT_UPLOAD_TTL_SECONDS = 900;
const MAX_METADATA_BYTES = 16 * 1024;

type SampleScope = Readonly<{
  id: string;
  dealId: string;
  shipmentId: string | null;
  acceptanceId: string | null;
  tenantId: string;
  laboratoryOrgId: string | null;
  sampleCode: string | null;
}>;

type BoundUploadBinding = Readonly<{
  dealId: string;
  metadata: Prisma.InputJsonObject;
}>;

type BoundUploadAuthorizer = (
  tx: Prisma.TransactionClient,
  context: TrustedRlsContext,
) => Promise<BoundUploadBinding>;

@Injectable()
export class LabEvidenceUploadService {
  private readonly maxBytes = boundedInteger(
    Number(process.env.OBJECT_STORAGE_MAX_BYTES ?? DEFAULT_MAX_BYTES),
    1,
    HARD_MAX_BYTES,
    DEFAULT_MAX_BYTES,
  );

  private readonly uploadTtlSeconds = boundedInteger(
    Number(process.env.OBJECT_STORAGE_UPLOAD_TTL_SECONDS ?? DEFAULT_UPLOAD_TTL_SECONDS),
    60,
    DEFAULT_UPLOAD_TTL_SECONDS,
    DEFAULT_UPLOAD_TTL_SECONDS,
  );

  constructor(
    private readonly rls: RlsTransactionService,
    @Inject(OBJECT_STORAGE_ADAPTER) private readonly adapter: ObjectStorageAdapter,
  ) {}

  async requestForSample(
    sampleIdInput: string,
    dto: RequestSampleEvidenceUploadDto,
    user: RequestUser,
  ) {
    const sampleId = requiredIdentifier(sampleIdInput, 'sampleId');
    const requestedSupersedesId = dto.supersedesId
      ? requiredIdentifier(dto.supersedesId, 'supersedesId')
      : undefined;

    if (requestedSupersedesId && dto.purpose !== 'TEST') {
      throw new UnprocessableEntityException({
        code: 'LAB_CORRECTION_ONLY_ALLOWED_FOR_TEST_EVIDENCE',
        field: 'supersedesId',
      });
    }

    return this.requestBoundUpload(
      {
        filename: dto.filename,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
      },
      user,
      async (tx, context) => {
        const rows = await tx.$queryRaw<SampleScope[]>(Prisma.sql`
          SELECT
            sample."id", sample."dealId", sample."shipmentId", sample."acceptanceId",
            sample."tenantId", sample."labId" AS "laboratoryOrgId", sample."sampleCode"
          FROM public."lab_samples" sample
          WHERE sample."id" = ${sampleId}
            AND sample."tenantId" = ${context.tenantId}
            AND public.app_labs_deal_authorized(sample."dealId", sample."labId", true)
          LIMIT 1
          FOR SHARE
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
          throw new ForbiddenException({ code: 'LAB_PHYSICAL_ACTOR_TYPE_REQUIRED', actorType });
        }

        if (requestedSupersedesId) {
          const correction = await tx.$queryRaw<Array<{ valid: boolean }>>(Prisma.sql`
            SELECT EXISTS (
              SELECT 1
              FROM public."lab_tests" predecessor
              WHERE predecessor."id" = ${requestedSupersedesId}
                AND predecessor."sampleId" = ${sample.id}
                AND predecessor."tenantId" = ${context.tenantId}
                AND NOT EXISTS (
                  SELECT 1 FROM public."lab_tests" successor
                  WHERE successor."supersedesId" = predecessor."id"
                )
            ) AS valid
          `);
          if (!correction[0]?.valid) {
            throw new ConflictException({ code: 'LAB_CORRECTION_PREDECESSOR_NOT_ACTIVE' });
          }
        }

        let protocolNumber: string | undefined;
        if (dto.purpose === 'PROTOCOL') {
          if (!sample.sampleCode) {
            throw new UnprocessableEntityException({
              code: 'LAB_SAMPLE_CODE_REQUIRED',
              field: 'sampleId',
            });
          }
          protocolNumber = `LAB-${sample.sampleCode}-V1`;
        }

        return {
          dealId: sample.dealId,
          metadata: {
            labPurpose: dto.purpose,
            sampleId: sample.id,
            shipmentId: sample.shipmentId,
            acceptanceId: sample.acceptanceId,
            laboratoryOrgId: sample.laboratoryOrgId,
            ...(protocolNumber ? { protocolNumber } : {}),
            ...(requestedSupersedesId ? { supersedesId: requestedSupersedesId } : {}),
          },
        };
      },
    );
  }

  async requestForProvisioning(
    dto: RequestProvisioningEvidenceUploadDto,
    user: RequestUser,
  ) {
    if (!PROVISIONING_ROLES.has(user.role)) {
      throw new ForbiddenException({ code: 'LAB_PROVISIONING_ROLE_REQUIRED' });
    }

    const dealId = requiredIdentifier(dto.dealId, 'dealId');
    const laboratoryOrgId = requiredIdentifier(dto.laboratoryOrgId, 'laboratoryOrgId');
    const shipmentId = dto.shipmentId
      ? requiredIdentifier(dto.shipmentId, 'shipmentId')
      : undefined;
    const acceptanceId = dto.acceptanceId
      ? requiredIdentifier(dto.acceptanceId, 'acceptanceId')
      : undefined;

    if (dto.purpose === 'ADMISSION' && (!shipmentId || !acceptanceId)) {
      throw new UnprocessableEntityException({
        code: 'LAB_ADMISSION_SCOPE_REQUIRED',
        fields: ['shipmentId', 'acceptanceId'],
      });
    }
    if (dto.purpose !== 'ADMISSION' && (shipmentId !== undefined || acceptanceId !== undefined)) {
      throw new UnprocessableEntityException({
        code: 'LAB_PROVISIONING_SCOPE_NOT_ALLOWED',
        fields: ['shipmentId', 'acceptanceId'],
      });
    }

    return this.requestBoundUpload(
      {
        filename: dto.filename,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
      },
      user,
      async (tx, context) => {
        const deal = await tx.deal.findUnique({
          where: { id: dealId },
          select: { id: true, tenantId: true },
        });
        if (!deal || deal.tenantId !== context.tenantId) {
          throw new NotFoundException({ code: 'LAB_PROVISIONING_DEAL_NOT_AVAILABLE' });
        }

        const laboratory = await tx.organization.findUnique({
          where: { id: laboratoryOrgId },
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
          const [shipment, acceptance] = await Promise.all([
            tx.shipment.findFirst({
              where: { id: shipmentId as string, dealId },
              select: { id: true },
            }),
            tx.acceptanceRecord.findFirst({
              where: {
                id: acceptanceId as string,
                dealId,
                shipmentId: shipmentId as string,
              },
              select: { id: true },
            }),
          ]);
          if (!shipment || !acceptance) {
            throw new NotFoundException({ code: 'LAB_ADMISSION_SCOPE_NOT_AVAILABLE' });
          }
        }

        return {
          dealId,
          metadata: {
            labPurpose: dto.purpose,
            laboratoryOrgId: laboratory.id,
            ...(dto.purpose === 'ADMISSION'
              ? {
                  shipmentId: shipmentId as string,
                  acceptanceId: acceptanceId as string,
                }
              : {}),
          },
        };
      },
    );
  }

  private async requestBoundUpload(
    input: Readonly<{
      filename: string;
      mimeType: string;
      sizeBytes: number;
    }>,
    user: RequestUser,
    authorizeAndBind: BoundUploadAuthorizer,
  ) {
    const filename = sanitizeFilename(input.filename);
    const mimeType = allowedMime(input.mimeType);
    const sizeBytes = allowedSize(input.sizeBytes, this.maxBytes);
    const fileId = `file_${randomUUID()}`;

    const persisted = await this.rls.withTrustedContext(user, async (tx, context) => {
      const binding = await authorizeAndBind(tx, context);
      const dealId = requiredIdentifier(binding.dealId, 'dealId');
      const metadata = normalizeMetadata(binding.metadata);
      const objectKey = `tenant/${context.tenantId}/deal/${dealId}/${fileId}/${filename}`;

      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        select: { id: true, tenantId: true },
      });
      if (!deal || deal.tenantId !== context.tenantId) {
        throw new NotFoundException({ code: 'LAB_EVIDENCE_DEAL_NOT_AVAILABLE' });
      }

      await tx.dealDocument.create({
        data: {
          id: fileId,
          dealId,
          tenantId: context.tenantId,
          type: 'EVIDENCE_FILE',
          status: 'UPLOAD_PENDING',
          name: filename,
          mimeType,
          s3Key: objectKey,
          sizeBytes,
          uploadedByUserId: context.userId,
          metadata,
          version: 1,
          isImmutable: false,
        },
      });

      return { objectKey };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const presigned = await this.adapter.getPresignedUploadUrl(
      persisted.objectKey,
      mimeType,
      this.uploadTtlSeconds,
    );

    return {
      fileId,
      objectKey: persisted.objectKey,
      uploadUrl: presigned.url,
      expiresAt: presigned.expiresAt,
      requiredHeaders: presigned.requiredHeaders,
    };
  }
}

function normalizeMetadata(value: Prisma.InputJsonObject): Prisma.InputJsonObject {
  const serialized = JSON.stringify(value);
  if (!serialized || Buffer.byteLength(serialized, 'utf8') > MAX_METADATA_BYTES) {
    throw new BadRequestException({
      code: 'INVALID_EVIDENCE_METADATA_SIZE',
      maxBytes: MAX_METADATA_BYTES,
    });
  }
  const normalized = JSON.parse(serialized) as Prisma.InputJsonObject;
  if (Object.keys(normalized).length === 0) {
    throw new BadRequestException({ code: 'EMPTY_EVIDENCE_METADATA' });
  }
  return normalized;
}

function allowedMime(value: string): string {
  const mimeType = normalizeMimeType(String(value ?? ''));
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new BadRequestException({ code: 'MIME_NOT_ALLOWED', mimeType });
  }
  return mimeType;
}

function allowedSize(value: number, maxBytes: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maxBytes) {
    throw new BadRequestException({ code: 'SIZE_NOT_ALLOWED', maxBytes });
  }
  return value;
}

function sanitizeFilename(input: string): string {
  const raw = String(input ?? '').normalize('NFKC').trim();
  const leaf = raw.split(/[\\/]/).pop() ?? '';
  const sanitized = leaf
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^\p{L}\p{N}._()\- ]/gu, '_')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .trim();
  if (!sanitized || sanitized.length > 180) {
    throw new BadRequestException({ code: 'INVALID_FILENAME' });
  }
  return sanitized;
}

function requiredIdentifier(value: string, field: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > 180 || !/^[A-Za-z0-9:_-]+$/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_IDENTIFIER', field });
  }
  return normalized;
}

function boundedInteger(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
