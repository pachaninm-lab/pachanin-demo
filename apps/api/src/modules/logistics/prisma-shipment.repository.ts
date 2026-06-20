import { Injectable, Optional } from '@nestjs/common';
import type { ShipmentRepository } from './shipment.repository';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * DB-backed shipment repository skeleton (pre-integration, disabled by
 * default). Selected only under PLATFORM_V7_SHIPMENT_REPOSITORY=prisma. Read
 * snapshots (list/getById) only; workspace/create/transition/recordCheckpoint/
 * verifyPin are not supported and fail loudly. No silent fallback to the
 * runtime store; no live GPS / telematics.
 */
@Injectable()
export class PrismaShipmentRepository implements ShipmentRepository {
  constructor(@Optional() private readonly prisma?: PrismaService) {
    if (!this.prisma) {
      throw new Error(
        'PrismaShipmentRepository requires PrismaService, but it is not available. ' +
          'DB-backed shipment path is not active.',
      );
    }
  }

  private get db(): PrismaService {
    if (!this.prisma) {
      throw new Error('PrismaShipmentRepository: PrismaService unavailable — DB-backed shipment path not active.');
    }
    return this.prisma;
  }

  async list(): Promise<any[]> {
    return this.db.shipment.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getById(id: string): Promise<any> {
    const row = await this.db.shipment.findUnique({ where: { id } });
    if (!row) {
      throw new Error(`Shipment ${id} not found in DB-backed shipment repository.`);
    }
    return row;
  }

  workspace(): any {
    throw new Error('PrismaShipmentRepository.workspace is not supported — DB-backed shipment workspace path is not active.');
  }

  create(): any {
    throw new Error('PrismaShipmentRepository.create is not supported — DB-backed shipment write path is not active.');
  }

  transition(): any {
    throw new Error('PrismaShipmentRepository.transition is not supported — DB-backed shipment transition path is not active.');
  }

  recordCheckpoint(): any {
    throw new Error('PrismaShipmentRepository.recordCheckpoint is not supported — DB-backed checkpoint write path is not active.');
  }

  verifyPin(): any {
    throw new Error('PrismaShipmentRepository.verifyPin is not supported — DB-backed driver PIN path is not active.');
  }
}
