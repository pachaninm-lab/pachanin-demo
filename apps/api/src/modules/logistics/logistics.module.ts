import { Module, type Provider } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { AntiFraudModule } from '../anti-fraud/anti-fraud.module';
import { LogisticsController } from './logistics.controller';
import { LogisticsService } from './logistics.service';
import { EtnService } from './etn.service';
import { SHIPMENT_REPOSITORY } from './shipment.repository';
import { selectShipmentRepository } from './shipment-repository.factory';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Shipment repository binding.
 *
 * Default (controlled-pilot / pre-integration): in-memory RuntimeCore adapter.
 * The DB-backed Prisma adapter is selected ONLY when
 * PLATFORM_V7_SHIPMENT_REPOSITORY=prisma is explicitly set. No silent Prisma
 * activation and no silent fallback between adapters.
 */
const shipmentRepositoryProvider: Provider = {
  provide: SHIPMENT_REPOSITORY,
  useFactory: (runtime: RuntimeCoreService, prisma?: PrismaService) =>
    selectShipmentRepository(runtime, prisma),
  inject: [RuntimeCoreService, { token: PrismaService, optional: true }],
};

@Module({
  imports: [AuditModule, NotificationsModule, IntegrationsModule, AntiFraudModule],
  controllers: [LogisticsController],
  providers: [LogisticsService, EtnService, AccessScopeService, shipmentRepositoryProvider],
  exports: [LogisticsService, EtnService]
})
export class LogisticsModule {}
