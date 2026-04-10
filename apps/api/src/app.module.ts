import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppAuthGuard } from './common/guards/auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { LotsModule } from './modules/lots/lots.module';
import { DealsModule } from './modules/deals/deals.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { LabsModule } from './modules/labs/labs.module';
import { LogisticsModule } from './modules/logistics/logistics.module';
import { SettlementEngineModule } from './modules/settlement-engine/settlement-engine.module';
import { ServiceProvidersModule } from './modules/service-providers/service-providers.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RoutePlannerModule } from './modules/route-planner/route-planner.module';
import { StorageModule } from './modules/storage/storage.module';
import { AuditModule } from './modules/audit/audit.module';
import { AntiFraudModule } from './modules/anti-fraud/anti-fraud.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { BusinessReputationModule } from './modules/business-reputation/business-reputation.module';
import { RuntimeCoreModule } from './modules/runtime-core/runtime-core.module';

@Module({
  imports: [
    RuntimeCoreModule,
    AuthModule,
    LotsModule,
    DealsModule,
    DisputesModule,
    DocumentsModule,
    LabsModule,
    LogisticsModule,
    SettlementEngineModule,
    ServiceProvidersModule,
    IntegrationsModule,
    NotificationsModule,
    RoutePlannerModule,
    StorageModule,
    AuditModule,
    AntiFraudModule,
    LedgerModule,
    BusinessReputationModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppAuthGuard,
    },
  ],
})
export class AppModule {}
