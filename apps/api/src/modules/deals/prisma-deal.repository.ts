import { Injectable, Optional } from '@nestjs/common';
import type { DealRepository } from './deal.repository';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * DB-backed deal repository skeleton (pre-integration, disabled by default).
 *
 * Selected only under the explicit PLATFORM_V7_DEAL_REPOSITORY=prisma flag.
 * Only read snapshots (list/get) are implemented; workspace/passport/timeline
 * and all writes are NOT supported yet and fail loudly rather than silently
 * falling back to the runtime store. There is no silent Prisma activation.
 */
@Injectable()
export class PrismaDealRepository implements DealRepository {
  constructor(@Optional() private readonly prisma?: PrismaService) {
    if (!this.prisma) {
      throw new Error(
        'PrismaDealRepository requires PrismaService, but it is not available. ' +
          'DB-backed deal path is not active.',
      );
    }
  }

  private get db(): PrismaService {
    if (!this.prisma) {
      throw new Error('PrismaDealRepository: PrismaService unavailable — DB-backed deal path not active.');
    }
    return this.prisma;
  }

  async list(): Promise<unknown[]> {
    return this.db.deal.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getById(id: string): Promise<any> {
    const row = await this.db.deal.findUnique({ where: { id } });
    if (!row) {
      throw new Error(`Deal ${id} not found in DB-backed deal repository.`);
    }
    return row;
  }

  workspace(): any {
    throw new Error('PrismaDealRepository.workspace is not supported — DB-backed deal workspace path is not active.');
  }

  passport(): any {
    throw new Error('PrismaDealRepository.passport is not supported — DB-backed deal passport path is not active.');
  }

  timeline(): any {
    throw new Error('PrismaDealRepository.timeline is not supported — DB-backed deal timeline path is not active.');
  }

  create(): any {
    throw new Error('PrismaDealRepository.create is not supported — DB-backed deal write path is not active.');
  }

  transition(): any {
    throw new Error('PrismaDealRepository.transition is not supported — DB-backed deal transition path is not active.');
  }
}
