import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { RequestUser, Role } from '../../common/types/request-user';
import {
  OBJECT_STORAGE_ADAPTER,
  ObjectInspection,
  ObjectStorageAdapter,
  PresignedObjectUrl,
  normalizeMimeType,
} from './object-storage.adapter';
import { StorageFinalizationRepository } from './storage-finalization.repository';

const STORAGE_DOCUMENT_TYPE = 'EVIDENCE_FILE';
const STATUS_PENDING = 'UPLOAD_PENDING';
const STATUS_VERIFIED = 'VERIFIED';
const STATUS_DELETED = 'DELETED';
const STATUS_DELETE_PENDING = 'DELETE_PENDING';
const STATUS_DELETE_FAILED = 'DELETE_FAILED';
const STATUS_EXPIRED = 'UPLOAD_EXPIRED';
const QUARANTINED_PREFIX = 'QUARANTINED_';
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const HARD_MAX_BYTES = 200 * 1024 * 1024;
const DEFAULT_UPLOAD_TTL_SECONDS = 900;
const MAX_DOWNLOAD_TTL_SECONDS = 900;
const MAX_EVIDENCE_METADATA_BYTES = 16 * 1024;

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

const PRIVILEGED_FILE_MANAGERS = new Set<Role>([
  Role.ADMIN,
  Role.SUPPORT_MANAGER,
  Role.COMPLIANCE_OFFICER,
]);

export type StoredFileRecord = {
  id: string;
  dealId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  objectKey: string;
  sha256: string | null;
  uploadedBy: string;
  status: string;
  version: number;
  immutable: boolean;
  createdAt: string;
};

export type UploadRequest = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  dealId: string;
  metadata?: Prisma.InputJsonObject;
};

@Injectable()
export class StorageService {
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
    private readonly finalization: StorageFinalizationRepository,
  ) {}

  async requestUpload(
    params: UploadRequest,
    user: RequestUser,
  ): Promise<{
    fileId: string;
    objectKey: string;
    uploadUrl: string;
    expiresAt: string;
    requiredHeaders?: Record<string, string>;
  }> {
    this.assertWriteRole(user);
    const dealId = requiredIdentifier(params.dealId, 'dealId');
    const filename = sanitizeFilename(params.filename);
    const mimeType = this.assertAllowedMime(params.mimeType);
    const sizeBytes = this.assertAllowedSize(params.sizeBytes);
    const metadata = normalizeEvidenceMetadata(params.metadata);
    const fileId = `file_${randomUUID()}`;
    const objectKey = buildObjectKey(user.tenantId ?? '', dealId, fileId, filename);
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
          type: STORAGE_DOCUMENT_TYPE,
          status: STATUS_PENDING,
          name: filename,
          mimeType,
          s3Key: objectKey,
          sizeBytes,
          uploadedByUserId: context.userId,
          version: 1,
          isImmutable: false,
          ...(metadata ? { metadata } : {}),
        },
      });
    });

    return {
      fileId,
      objectKey,
      uploadUrl: presigned.url,
      expiresAt: presigned.expiresAt,
      requiredHeaders: presigned.requiredHeaders,
    };
  }

  async confirmUpload(fileId: string, claimedSha256: string, user: RequestUser): Promise<StoredFileRecord> {
    this.assertWriteRole(user);
    const normalizedHash = normalizeSha256(claimedSha256);
    const record = await this.requireVisibleRecord(fileId, user);
    this.assertManagePermission(record, user);
    if (record.status !== STATUS_PENDING) {
      throw new ConflictException(`Upload cannot be confirmed from status ${record.status}.`);
    }
    if (Date.now() - record.uploadedAt.getTime() > this.uploadTtlSeconds * 1000) {
      await this.transitionStatus(record, STATUS_EXPIRED, user);
      throw new ConflictException('Upload confirmation window has expired.');
    }
    if (!record.s3Key || !record.mimeType || !record.sizeBytes) {
      throw new ConflictException('Upload metadata is incomplete.');
    }

    let inspection: ObjectInspection;
    try {
      inspection = await this.adapter.inspectAndHashObject(record.s3Key, this.maxBytes);
    } catch (error) {
      throw new BadRequestException({
        code: 'OBJECT_NOT_READY',
        message: 'Uploaded object is unavailable or exceeds the verification boundary.',
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    const quarantine = this.quarantineReason(record, inspection, normalizedHash);
    if (quarantine) {
      await this.finalization.quarantine(record, quarantine, inspection, user);
      throw new BadRequestException({
        code: quarantine,
        message: 'Uploaded object failed integrity validation and was quarantined.',
      });
    }

    const updated = await this.finalization.markVerified(record, inspection, user);
    return toStoredFileRecord(updated);
  }

  async getDownloadUrl(
    fileId: string,
    ttlSeconds: number,
    user: RequestUser,
  ): Promise<PresignedObjectUrl & { file: StoredFileRecord }> {
    const record = await this.requireVisibleRecord(fileId, user);
    if (record.status !== STATUS_VERIFIED || !record.isImmutable || !record.hash || !record.s3Key) {
      throw new ConflictException('Only verified immutable objects can be downloaded.');
    }
    const ttl = boundedInteger(ttlSeconds, 60, MAX_DOWNLOAD_TTL_SECONDS, MAX_DOWNLOAD_TTL_SECONDS);
    const result = await this.adapter.getPresignedDownloadUrl(record.s3Key, ttl);
    return { ...result, file: toStoredFileRecord(record) };
  }

  async verifyIntegrity(
    fileId: string,
    user: RequestUser,
  ): Promise<{
    valid: boolean;
    storedHash: string;
    actualHash: string;
    sizeBytes: number;
    contentType: string;
  }> {
    const record = await this.requireVisibleRecord(fileId, user);
    if (record.status !== STATUS_VERIFIED || !record.hash || !record.s3Key) {
      throw new ConflictException('Object has not reached VERIFIED status.');
    }
    const inspection = await this.adapter.inspectAndHashObject(record.s3Key, this.maxBytes);
    const valid = timingSafeStringEqual(record.hash, inspection.sha256)
      && record.sizeBytes === inspection.sizeBytes
      && normalizeMimeType(record.mimeType ?? '') === normalizeMimeType(inspection.contentType);
    return {
      valid,
      storedHash: record.hash,
      actualHash: inspection.sha256,
      sizeBytes: inspection.sizeBytes,
      contentType: inspection.contentType,
    };
  }

  async getRecord(fileId: string, user: RequestUser): Promise<StoredFileRecord> {
    return toStoredFileRecord(await this.requireVisibleRecord(fileId, user));
  }

  async listByDeal(dealId: string, user: RequestUser): Promise<StoredFileRecord[]> {
    const id = requiredIdentifier(dealId, 'dealId');
    return this.rls.withTrustedContext(user, async (tx, context) => {
      const deal = await tx.deal.findUnique({
        where: { id },
        select: { id: true, tenantId: true },
      });
      if (!deal || deal.tenantId !== context.tenantId) {
        throw new NotFoundException('Deal is not available in the authenticated scope.');
      }
      const rows = await tx.dealDocument.findMany({
        where: {
          dealId: id,
          type: STORAGE_DOCUMENT_TYPE,
          status: { not: STATUS_DELETED },
        },
        orderBy: [{ uploadedAt: 'desc' }, { id: 'asc' }],
      });
      return rows.map(toStoredFileRecord);
    });
  }

  async delete(fileId: string, user: RequestUser): Promise<{ id: string; deleted: true }> {
    this.assertWriteRole(user);
    const record = await this.requireVisibleRecord(fileId, user);
    this.assertManagePermission(record, user);
    if (record.isImmutable || record.status === STATUS_VERIFIED || record.status.startsWith(QUARANTINED_PREFIX)) {
      throw new ConflictException('Verified or quarantined evidence is immutable and cannot be deleted through the API.');
    }
    if (![STATUS_PENDING, STATUS_EXPIRED, STATUS_DELETE_FAILED].includes(record.status)) {
      throw new ConflictException(`Object cannot be deleted from status ${record.status}.`);
    }
    if (!record.s3Key) throw new ConflictException('Object key is missing.');

    await this.rls.withTrustedContext(user, async (tx) => {
      const result = await tx.dealDocument.updateMany({
        where: { id: record.id, version: record.version, status: record.status },
        data: { status: STATUS_DELETE_PENDING, version: { increment: 1 } },
      });
      if (result.count !== 1) throw new ConflictException('Delete request lost an optimistic concurrency race.');
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    try {
      await this.adapter.deleteObject(record.s3Key);
    } catch (error) {
      await this.rls.withTrustedContext(user, async (tx) => {
        await tx.dealDocument.updateMany({
          where: { id: record.id, status: STATUS_DELETE_PENDING },
          data: { status: STATUS_DELETE_FAILED, version: { increment: 1 } },
        });
      });
      throw error;
    }

    await this.rls.withTrustedContext(user, async (tx) => {
      const result = await tx.dealDocument.updateMany({
        where: { id: record.id, status: STATUS_DELETE_PENDING },
        data: { status: STATUS_DELETED, version: { increment: 1 } },
      });
      if (result.count !== 1) throw new ConflictException('Object was removed but metadata finalization failed.');
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return { id: record.id, deleted: true };
  }

  private async requireVisibleRecord(fileId: string, user: RequestUser) {
    const id = requiredIdentifier(fileId, 'fileId');
    const record = await this.rls.withTrustedContext(user, (tx) => tx.dealDocument.findFirst({
      where: { id, type: STORAGE_DOCUMENT_TYPE, status: { not: STATUS_DELETED } },
    }));
    if (!record) throw new NotFoundException('File is not available in the authenticated scope.');
    return record;
  }

  private assertWriteRole(user: RequestUser): void {
    if (user.role === Role.GUEST || user.role === Role.EXECUTIVE) {
      throw new ForbiddenException('Role is read-only for evidence object storage.');
    }
  }

  private assertManagePermission(record: { uploadedByUserId: string | null }, user: RequestUser): void {
    if (record.uploadedByUserId !== user.id && !PRIVILEGED_FILE_MANAGERS.has(user.role)) {
      throw new ForbiddenException('Only the uploader or a privileged control role can manage this object.');
    }
  }

  private assertAllowedMime(value: string): string {
    const mimeType = normalizeMimeType(String(value ?? ''));
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException({ code: 'MIME_NOT_ALLOWED', mimeType });
    }
    return mimeType;
  }

  private assertAllowedSize(value: number): number {
    if (!Number.isSafeInteger(value) || value <= 0 || value > this.maxBytes) {
      throw new BadRequestException({
        code: 'SIZE_NOT_ALLOWED',
        maxBytes: this.maxBytes,
      });
    }
    return value;
  }

  private quarantineReason(
    record: { sizeBytes: number | null; mimeType: string | null },
    inspection: ObjectInspection,
    claimedHash: string,
  ): string | null {
    if (record.sizeBytes !== inspection.sizeBytes) return 'SIZE_MISMATCH';
    if (normalizeMimeType(record.mimeType ?? '') !== normalizeMimeType(inspection.contentType)) return 'MIME_MISMATCH';
    if (!timingSafeStringEqual(claimedHash, inspection.sha256)) return 'CLIENT_HASH_MISMATCH';
    return null;
  }

  private async transitionStatus(
    record: { id: string; version: number; status: string },
    status: string,
    user: RequestUser,
  ): Promise<void> {
    await this.rls.withTrustedContext(user, async (tx) => {
      const result = await tx.dealDocument.updateMany({
        where: { id: record.id, status: record.status, version: record.version },
        data: { status, version: { increment: 1 } },
      });
      if (result.count !== 1) {
        throw new ConflictException('Storage status transition lost an optimistic concurrency race.');
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

function toStoredFileRecord(record: {
  id: string;
  dealId: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  s3Key: string | null;
  hash: string | null;
  uploadedByUserId: string | null;
  status: string;
  version: number;
  isImmutable: boolean;
  uploadedAt: Date;
}): StoredFileRecord {
  if (!record.s3Key || !record.mimeType || !record.uploadedByUserId) {
    throw new ConflictException('Persistent file metadata is incomplete.');
  }
  return {
    id: record.id,
    dealId: record.dealId,
    name: record.name,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes ?? 0,
    objectKey: record.s3Key,
    sha256: record.hash,
    uploadedBy: record.uploadedByUserId,
    status: record.status,
    version: record.version,
    immutable: record.isImmutable,
    createdAt: record.uploadedAt.toISOString(),
  };
}

function buildObjectKey(tenantId: string, dealId: string, fileId: string, filename: string): string {
  const tenant = requiredIdentifier(tenantId, 'tenantId');
  return `tenant/${tenant}/deal/${dealId}/${fileId}/${filename}`;
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

function normalizeEvidenceMetadata(value: unknown): Prisma.InputJsonObject | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException({ code: 'INVALID_EVIDENCE_METADATA' });
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new BadRequestException({ code: 'INVALID_EVIDENCE_METADATA' });
  }
  if (!serialized || Buffer.byteLength(serialized, 'utf8') > MAX_EVIDENCE_METADATA_BYTES) {
    throw new BadRequestException({
      code: 'EVIDENCE_METADATA_TOO_LARGE',
      maxBytes: MAX_EVIDENCE_METADATA_BYTES,
    });
  }

  const normalized = JSON.parse(serialized) as Prisma.InputJsonObject;
  if (Object.keys(normalized).length === 0) {
    throw new BadRequestException({ code: 'EMPTY_EVIDENCE_METADATA' });
  }
  return normalized;
}

function normalizeSha256(value: string): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_SHA256' });
  }
  return normalized;
}

function timingSafeStringEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function boundedInteger(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
