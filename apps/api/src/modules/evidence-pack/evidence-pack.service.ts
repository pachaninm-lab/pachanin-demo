import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

export type EvidenceType = 'photo' | 'gps_track' | 'weight_ticket' | 'lab_protocol' | 'signature' | 'document';

export interface UploadEvidenceDto {
  dealId: string;
  shipmentId?: string;
  disputeId?: string;
  type: EvidenceType;
  filename: string;
  mimeType: string;
  content: Buffer | string;
  metadata?: Record<string, unknown>;
}

function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

@Injectable()
export class EvidencePackService {
  // In-memory fallback for when DB is unavailable
  private readonly inMemory: Map<string, any[]> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  async upload(dto: UploadEvidenceDto, uploaderUserId: string) {
    const content = typeof dto.content === 'string' ? Buffer.from(dto.content, 'base64') : dto.content;
    const hash = sha256(content);
    const sizeBytes = content.length;

    try {
      // Find the previous entry in this deal's chain to link hashes
      const prev = await this.prisma.evidenceFile.findFirst({
        where: { dealId: dto.dealId },
        orderBy: { uploadedAt: 'desc' },
        select: { hash: true },
      });

      const entry = await this.prisma.evidenceFile.create({
        data: {
          dealId: dto.dealId,
          shipmentId: dto.shipmentId,
          disputeId: dto.disputeId,
          type: dto.type,
          filename: dto.filename,
          mimeType: dto.mimeType,
          sizeBytes,
          hash,
          prevHash: prev?.hash ?? null,
          uploadedBy: uploaderUserId,
          metadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
        },
      });

      return { id: entry.id, hash, chainIntact: true };
    } catch {
      // Fallback: store in-memory without chain verification
      const id = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const list = this.inMemory.get(dto.dealId) ?? [];
      const fallbackEntry = { id, dealId: dto.dealId, shipmentId: dto.shipmentId, disputeId: dto.disputeId, type: dto.type, filename: dto.filename, hash, sizeBytes, uploadedBy: uploaderUserId, uploadedAt: new Date().toISOString() };
      list.push(fallbackEntry);
      this.inMemory.set(dto.dealId, list);
      return { id, hash, chainIntact: false, warning: 'DB unavailable — stored in memory only' };
    }
  }

  async listByDeal(dealId: string) {
    try {
      const files = await this.prisma.evidenceFile.findMany({
        where: { dealId },
        orderBy: { uploadedAt: 'asc' },
      });
      return { files, chainVerified: this.verifyChain(files) };
    } catch {
      return { files: this.inMemory.get(dealId) ?? [], chainVerified: false };
    }
  }

  async listByDispute(disputeId: string) {
    try {
      return await this.prisma.evidenceFile.findMany({
        where: { disputeId },
        orderBy: { uploadedAt: 'asc' },
      });
    } catch {
      const all = [...this.inMemory.values()].flat();
      return all.filter((e) => e.disputeId === disputeId);
    }
  }

  async verifyDealChain(dealId: string): Promise<{ valid: boolean; brokenAt?: string; totalFiles: number }> {
    try {
      const files = await this.prisma.evidenceFile.findMany({
        where: { dealId },
        orderBy: { uploadedAt: 'asc' },
      });
      const valid = this.verifyChain(files);
      const brokenAt = valid ? undefined : files.find((f, i) => i > 0 && f.prevHash !== files[i - 1].hash)?.id;
      return { valid, brokenAt, totalFiles: files.length };
    } catch {
      return { valid: false, totalFiles: 0 };
    }
  }

  private verifyChain(files: any[]): boolean {
    for (let i = 1; i < files.length; i++) {
      if (files[i].prevHash !== files[i - 1].hash) return false;
    }
    return true;
  }
}
