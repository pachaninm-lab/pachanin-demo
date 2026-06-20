import { Injectable, Optional } from '@nestjs/common';
import type { PaymentRepository } from './payment.repository';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * DB-backed payment read snapshot skeleton (pre-integration, disabled by
 * default).
 *
 * Selected only under the explicit PLATFORM_V7_PAYMENT_REPOSITORY=prisma flag.
 * Only list/detail read snapshots are implemented; worksheet/bankWorkspace are
 * NOT supported and fail loudly. This adapter never performs money mutations
 * and never silently falls back to the runtime store.
 */
@Injectable()
export class PrismaPaymentRepository implements PaymentRepository {
  constructor(@Optional() private readonly prisma?: PrismaService) {
    if (!this.prisma) {
      throw new Error(
        'PrismaPaymentRepository requires PrismaService, but it is not available. ' +
          'DB-backed payment path is not active.',
      );
    }
  }

  private get db(): PrismaService {
    if (!this.prisma) {
      throw new Error('PrismaPaymentRepository: PrismaService unavailable — DB-backed payment path not active.');
    }
    return this.prisma;
  }

  async list(): Promise<unknown[]> {
    return this.db.payment.findMany();
  }

  async detail(id: string): Promise<any> {
    const row = await this.db.payment.findUnique({ where: { id } });
    if (!row) {
      throw new Error(`Payment ${id} not found in DB-backed payment repository.`);
    }
    return row;
  }

  worksheet(): any {
    throw new Error('PrismaPaymentRepository.worksheet is not supported — DB-backed settlement worksheet path is not active.');
  }

  bankWorkspace(): any {
    throw new Error('PrismaPaymentRepository.bankWorkspace is not supported — DB-backed bank workspace path is not active.');
  }
}
