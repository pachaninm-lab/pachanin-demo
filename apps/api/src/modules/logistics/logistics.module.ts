import { Module } from '@nestjs/common';
import { EtnService } from './etn.service';
import { GeofenceService } from './geofence.service';
import { LogisticsController } from './logistics.controller';
import { LogisticsService } from './logistics.service';
import { PrismaShipmentRepository } from './prisma-shipment.repository';
import { SHIPMENT_REPOSITORY } from './shipment.repository';

/**
 * Production logistics is PostgreSQL-authoritative by construction. RuntimeCore,
 * optional Prisma injection and repository-mode factories are absent from this
 * dependency graph. Development memory adapters may be composed explicitly in
 * isolated tests, but are never registered by this module.
 */
@Module({
  controllers: [LogisticsController],
  providers: [
    LogisticsService,
    EtnService,
    GeofenceService,
    PrismaShipmentRepository,
    { provide: SHIPMENT_REPOSITORY, useExisting: PrismaShipmentRepository },
  ],
  exports: [LogisticsService],
})
export class LogisticsModule {}
