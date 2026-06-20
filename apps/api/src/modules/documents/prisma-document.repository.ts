import { Injectable, Optional } from '@nestjs/common';
import type { DocumentRepository } from './document.repository';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * DB-backed document repository skeleton (pre-integration, disabled by
 * default). Selected only under PLATFORM_V7_DOCUMENT_REPOSITORY=prisma.
 * Read snapshots (list/getById) only; upload/sign/generateDealPackage are not
 * supported and fail loudly. No silent fallback to the runtime store; no file
 * storage / signature integration.
 */
@Injectable()
export class PrismaDocumentRepository implements DocumentRepository {
  constructor(@Optional() private readonly prisma?: PrismaService) {
    if (!this.prisma) {
      throw new Error(
        'PrismaDocumentRepository requires PrismaService, but it is not available. ' +
          'DB-backed document path is not active.',
      );
    }
  }

  private get db(): PrismaService {
    if (!this.prisma) {
      throw new Error('PrismaDocumentRepository: PrismaService unavailable — DB-backed document path not active.');
    }
    return this.prisma;
  }

  async list(): Promise<any[]> {
    return this.db.dealDocument.findMany();
  }

  async getById(id: string): Promise<any> {
    const row = await this.db.dealDocument.findUnique({ where: { id } });
    if (!row) {
      throw new Error(`Document ${id} not found in DB-backed document repository.`);
    }
    return row;
  }

  upload(): any {
    throw new Error('PrismaDocumentRepository.upload is not supported — DB-backed document write/storage path is not active.');
  }

  sign(): any {
    throw new Error('PrismaDocumentRepository.sign is not supported — DB-backed document signature path is not active.');
  }

  generateDealPackage(): any {
    throw new Error('PrismaDocumentRepository.generateDealPackage is not supported — DB-backed document package path is not active.');
  }
}
