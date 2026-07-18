import { Module } from '@nestjs/common';
import { LogisticsController } from './logistics.controller';
import { LogisticsService } from './logistics.service';
import { LogisticsAuthorityService } from './logistics-authority.service';
import { PrismaShipmentRepository } from './prisma-shipment.repository';
import { SHIPMENT_REPOSITORY } from './shipment.repository';

/**
 * Production logistics is PostgreSQL-authoritative by construction.
 * RuntimeCore, repository factories, optional Prisma dependencies, mock GIS EPD
 * and process-memory geofencing are absent from this dependency graph.
 */
@Module({
  controllers: [LogisticsController],
  providers: [
    LogisticsService,
    LogisticsAuthorityService,
    PrismaShipmentRepository,
    { provide: SHIPMENT_REPOSITORY, useExisting: PrismaShipmentRepository },
  ],
  exports: [LogisticsService],
})
export class LogisticsModule {}
