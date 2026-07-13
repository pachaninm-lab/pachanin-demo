import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import {
  OBJECT_STORAGE_ADAPTER,
  type ObjectStorageAdapter,
  normalizeMimeType,
} from './object-storage.adapter';

const STORAGE_DOCUMENT_TYPE = 'EVIDENCE_FILE';
const STATUS_PENDING = 'UPLOAD_PENDING';
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const HARD_MAX_BYTES = 200 * 1024 * 1024;
const DEFAULT_UPLOAD_TTL_SECONDS = 900;
const MAX_METADATA_BYTES = 16 * 1024;

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

export type ServerBoundEvidenceUpload = Readonly<{
  filename: string;
  mimeType: string;
  sizeBytes: number;
  dealId: string;
  metadata: Prisma.InputJsonObject;
}>;

/**
 * Internal-only evidence writer.
 *
 * Public storage requests cannot choose evidence-purpose metadata. A domain
 * service derives the exact purpose and object scope, then uses this writer to
 * persist those immutable facts on the first INSERT before bytes are uploaded.
 */
@Injectable()
export class ServerBoundEvidenceUploadService {
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

  async request(
    input: ServerBoundEvidenceUpload,
    user: RequestUser,
  ): Promise<{
    fileId: string;
    objectKey: string;
    uploadUrl: string;
    expiresAt: string;
    requiredHeaders?: Record<string, string>;
  }> {
    const dealId = requiredIdentifier(input.dealId, 'dealId');
    const filename = sanitizeFilename(input.filename);
    const mimeType = allowedMime(input.mimeType);
    const sizeBytes = allowedSize(input.sizeBytes, this.maxBytes);
    const metadata = normalizeMetadata(input.metadata);
    const tenantId = requiredIdentifier(user.tenantId ?? '', 'tenantId');
    const fileId = `file_${randomUUID()}`;
    const objectKey = `tenant/${tenantId}/deal/${dealId}/${fileId}/${filename}`;
    const presigned = await this.adapter.getPresignedUploadUrl(
      objectKey,
      mimeType,
      this.uploadTtlSeconds,
    );

    await this.rls.withTrustedContext(user, async (tx, context) => {
      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        select: { id: true, tenantId: true },
      });
      if (!deal || deal.tenantId !== context.tenantId) {
        throw new NotFoundException('Deal is not available in the authenticated scope.');
      }
      await tx.dealDocument.create({
        data: {
          id: fileId,
          dealId,
          tenantId: context.tenantId,
          type: STORAGE_DOCUMENT_TYPE,
          status: STATUS_PENDING,
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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return {
      fileId,
      objectKey,
      uploadUrl: presigned.url,
      expiresAt: presigned.expiresAt,
      requiredHeaders: presigned.requiredHeaders,
    };
  }
}

function normalizeMetadata(value: Prisma.InputJsonObject): Prisma.InputJsonObject {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new BadRequestException({ code: 'INVALID_EVIDENCE_METADATA' });
  }
  if (!serialized || Buffer.byteLength(serialized, 'utf8') > MAX_METADATA_BYTES) {
    throw new BadRequestException({ code: 'INVALID_EVIDENCE_METADATA_SIZE', maxBytes: MAX_METADATA_BYTES });
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
