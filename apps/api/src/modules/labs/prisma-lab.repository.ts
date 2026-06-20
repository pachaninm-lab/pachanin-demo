import { Injectable, Optional } from '@nestjs/common';
import type { LabRepository } from './lab.repository';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * DB-backed lab repository skeleton (pre-integration, disabled by default).
 * Selected only under PLATFORM_V7_LAB_REPOSITORY=prisma. Read snapshots
 * (list/getById) only; create/collect/recordTest/finalize are not supported
 * and fail loudly. No silent fallback to the runtime store; no live lab
 * integration / external protocol upload; quality-delta semantics stay on
 * RuntimeCore.
 */
@Injectable()
export class PrismaLabRepository implements LabRepository {
  constructor(@Optional() private readonly prisma?: PrismaService) {
    if (!this.prisma) {
      throw new Error(
        'PrismaLabRepository requires PrismaService, but it is not available. ' +
          'DB-backed lab path is not active.',
      );
    }
  }

  private get db(): PrismaService {
    if (!this.prisma) {
      throw new Error('PrismaLabRepository: PrismaService unavailable — DB-backed lab path not active.');
    }
    return this.prisma;
  }

  async list(): Promise<any[]> {
    return this.db.labSample.findMany({ include: { tests: true }, orderBy: { createdAt: 'desc' } });
  }

  async getById(id: string): Promise<any> {
    const row = await this.db.labSample.findUnique({ where: { id }, include: { tests: true } });
    if (!row) {
      throw new Error(`Lab sample ${id} not found in DB-backed lab repository.`);
    }
    return row;
  }

  create(): any {
    throw new Error('PrismaLabRepository.create is not supported — DB-backed lab write path is not active.');
  }

  collect(): any {
    throw new Error('PrismaLabRepository.collect is not supported — DB-backed lab collect path is not active.');
  }

  recordTest(): any {
    throw new Error('PrismaLabRepository.recordTest is not supported — DB-backed lab test path is not active.');
  }

  finalize(): any {
    throw new Error('PrismaLabRepository.finalize is not supported — DB-backed lab finalize path is not active.');
  }
}
