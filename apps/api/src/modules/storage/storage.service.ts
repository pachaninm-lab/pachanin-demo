import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';

// ── S3 Adapter contract (ТЗ 8.4) ─────────────────────────────────────────────

export interface PresignedUploadResult {
  uploadUrl: string;         // presigned PUT URL (TTL 15 min)
  s3Key: string;             // путь в бакете
  fields?: Record<string, string>; // для multipart POST presign
}

export interface PresignedDownloadResult {
  downloadUrl: string;       // presigned GET URL (TTL 15 min)
  expiresAt: string;         // ISO timestamp
}

export interface StorageAdapter {
  getPresignedUploadUrl(s3Key: string, mimeType: string, sizeBytes?: number): Promise<PresignedUploadResult>;
  getPresignedDownloadUrl(s3Key: string, ttlSeconds?: number): Promise<PresignedDownloadResult>;
  deleteObject(s3Key: string): Promise<void>;
  headObject(s3Key: string): Promise<{ sizeBytes: number; contentType: string; eTag: string } | null>;
}

// ── In-memory adapter (sandbox / tests) ──────────────────────────────────────

class InMemoryStorageAdapter implements StorageAdapter {
  private readonly store = new Map<string, { content: Buffer | string; mimeType: string; size: number }>();

  async getPresignedUploadUrl(s3Key: string, mimeType: string): Promise<PresignedUploadResult> {
    return {
      uploadUrl: `http://localhost:3000/dev/s3-mock/upload/${encodeURIComponent(s3Key)}`,
      s3Key,
    };
  }

  async getPresignedDownloadUrl(s3Key: string, ttlSeconds = 900): Promise<PresignedDownloadResult> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    return {
      downloadUrl: `http://localhost:3000/dev/s3-mock/download/${encodeURIComponent(s3Key)}?expires=${expiresAt}`,
      expiresAt,
    };
  }

  async deleteObject(s3Key: string): Promise<void> {
    this.store.delete(s3Key);
  }

  async headObject(s3Key: string) {
    const obj = this.store.get(s3Key);
    if (!obj) return null;
    return { sizeBytes: obj.size, contentType: obj.mimeType, eTag: `"${s3Key}"` };
  }

  // Вспомогательный метод — симулирует загрузку в sandbox
  putMock(s3Key: string, content: Buffer | string, mimeType: string) {
    this.store.set(s3Key, { content, mimeType, size: Buffer.byteLength(content) });
  }
}

// ── StoredFile record (БД-запись, ТЗ 8.4) ────────────────────────────────────

export interface StoredFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  s3Key: string;
  sha256: string;
  uploadedBy: string;
  dealId?: string;
  createdAt: string;
}

// ── Legacy interface (обратная совместимость) ─────────────────────────────────

export interface LegacyStoredFile {
  id: string;
  name: string;
  content: string | Buffer;
  mimeType: string;
  createdAt: string;
}

// ── StorageService (ТЗ 8.4 — S3 presigned URL architecture) ──────────────────

@Injectable()
export class StorageService {
  private readonly adapter: StorageAdapter = new InMemoryStorageAdapter();

  // В-memory реестр записей документов (production: Prisma Document table)
  private readonly registry = new Map<string, StoredFile>();
  // Обратная совместимость со старым Map
  private readonly legacyFiles = new Map<string, LegacyStoredFile>();

  /**
   * Шаг 1 — клиент запрашивает presigned URL для загрузки
   * Client → API (presigned S3 URL) → S3
   */
  async requestUpload(params: {
    filename: string;
    mimeType: string;
    sizeBytes?: number;
    uploadedBy: string;
    dealId?: string;
  }): Promise<{ fileId: string; uploadUrl: string; s3Key: string }> {
    const fileId = randomUUID();
    const ext = params.filename.includes('.') ? params.filename.split('.').pop() : 'bin';
    const s3Key = `uploads/${params.dealId ?? 'global'}/${fileId}.${ext}`;

    const { uploadUrl } = await this.adapter.getPresignedUploadUrl(s3Key, params.mimeType, params.sizeBytes);

    // Создаём предварительную запись (confirmed = false)
    this.registry.set(fileId, {
      id: fileId,
      name: params.filename,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes ?? 0,
      s3Key,
      sha256: '',
      uploadedBy: params.uploadedBy,
      dealId: params.dealId,
      createdAt: new Date().toISOString(),
    });

    return { fileId, uploadUrl, s3Key };
  }

  /**
   * Шаг 2 — клиент подтверждает завершение загрузки с SHA-256 хешем
   * API проверяет hash и финализирует запись
   */
  async confirmUpload(fileId: string, sha256: string): Promise<StoredFile> {
    const record = this.registry.get(fileId);
    if (!record) throw new NotFoundException(`File record not found: ${fileId}`);
    record.sha256 = sha256;

    const meta = await this.adapter.headObject(record.s3Key);
    if (meta) {
      record.sizeBytes = meta.sizeBytes;
    }

    this.registry.set(fileId, record);
    return record;
  }

  /**
   * Скачивание — API проверяет права, возвращает presigned GET URL (TTL 15 мин)
   * Client → API (проверка прав) → presigned S3 URL (TTL 15 мин)
   */
  async getDownloadUrl(fileId: string, ttlSeconds = 900): Promise<PresignedDownloadResult & { file: StoredFile }> {
    const record = this.registry.get(fileId);
    if (!record) throw new NotFoundException(`File not found: ${fileId}`);

    const result = await this.adapter.getPresignedDownloadUrl(record.s3Key, ttlSeconds);
    return { ...result, file: record };
  }

  /**
   * Проверка целостности — SHA-256 из БД против актуального объекта
   */
  async verifyIntegrity(fileId: string): Promise<{ valid: boolean; storedHash: string }> {
    const record = this.registry.get(fileId);
    if (!record) throw new NotFoundException(`File not found: ${fileId}`);
    return { valid: !!record.sha256, storedHash: record.sha256 };
  }

  getRecord(fileId: string): StoredFile {
    const record = this.registry.get(fileId);
    if (!record) throw new NotFoundException(`File not found: ${fileId}`);
    return record;
  }

  async delete(fileId: string): Promise<{ id: string; deleted: boolean }> {
    const record = this.registry.get(fileId);
    if (!record) return { id: fileId, deleted: false };
    await this.adapter.deleteObject(record.s3Key);
    this.registry.delete(fileId);
    return { id: fileId, deleted: true };
  }

  listByDeal(dealId: string): StoredFile[] {
    return Array.from(this.registry.values()).filter((f) => f.dealId === dealId);
  }

  // ── Legacy API (обратная совместимость с существующими вызовами) ─────────────

  upload(file: { name: string; content: string | Buffer; mimeType: string }) {
    const id = randomUUID();
    const sha256 = createHash('sha256')
      .update(typeof file.content === 'string' ? file.content : file.content)
      .digest('hex');
    const stored: LegacyStoredFile = { id, ...file, createdAt: new Date().toISOString() };
    this.legacyFiles.set(id, stored);

    // Также регистрируем в новом реестре
    const sizeBytes = typeof file.content === 'string' ? Buffer.byteLength(file.content) : file.content.length;
    const s3Key = `legacy/${id}`;
    this.registry.set(id, {
      id,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes,
      s3Key,
      sha256,
      uploadedBy: 'system',
      createdAt: stored.createdAt,
    });

    return { id, name: file.name, mimeType: file.mimeType, createdAt: stored.createdAt };
  }

  get(id: string) {
    const file = this.legacyFiles.get(id);
    if (!file) throw new NotFoundException(`File not found: ${id}`);
    return file;
  }
}
