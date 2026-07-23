import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { HealthController } from './health.controller';
import { APP_GUARD } from '@nestjs/core';
import { LogMaskingMiddleware } from './common/middleware/log-masking.middleware';
import { AppAuthGuard } from './common/guards/auth.guard';
import { PreAuthRateLimitGuard } from './common/guards/pre-auth-rate-limit.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { RateLimitModule } from './common/security/rate-limit.module';
import { EvidencePackModule } from './modules/evidence-pack/evidence-pack.module';
import { AuthModule } from './modules/auth/auth.module';
import { LotsModule } from './modules/lots/lots.module';
import { DealsModule } from './modules/deals/deals.module';
import { CommodityProfilesModule } from './modules/commodity-profiles/commodity-profiles.module';
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
import { DatabaseModule } from './common/database/database.module';
import { AdminModule } from './modules/admin/admin.module';
import { MfaModule } from './modules/mfa/mfa.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { ArbitratorModule } from './modules/arbitrator/arbitrator.module';
import { IntegrationEventsModule } from './modules/integration-events/integration-events.module';
import { ExportsModule } from './modules/exports/exports.module';
import { ElevatorModule } from './modules/elevator/elevator.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PartnerApiModule } from './modules/partner-api/partner-api.module';
import { SagaModule } from './modules/saga/saga.module';
import { OutboxModule } from './common/outbox/outbox.module';
import { FactoringModule } from './modules/factoring/factoring.module';
import { BankReconciliationModule } from './modules/bank-reconciliation/bank-reconciliation.module';
import { SupportModule } from './modules/support/support.module';
import { KycModule } from './modules/kyc/kyc.module';
import { CertificateMonitorModule } from './modules/certificate-monitor/certificate-monitor.module';
import { RailwayModule } from './modules/railway/railway.module';
import { ExportTradeModule } from './modules/export-trade/export-trade.module';
import { SearchModule } from './modules/search/search.module';
import { MlClientModule } from './modules/ml-client/ml-client.module';
import { KafkaModule } from './common/kafka/kafka.module';
import { VaultModule } from './common/vault/vault.module';
import { AiInsightsModule } from './modules/ai-insights/ai-insights.module';
import { RuntimeSnapshotModule } from './modules/runtime-snapshot/runtime-snapshot.module';
import { RuntimePersistenceModule } from './modules/runtime-persistence/runtime-persistence.module';
import { StaffAccessModule } from './modules/staff-access/staff-access.module';
import { TaiToolsModule } from './modules/tai-tools/tai-tools.module';

@Module({
  imports: [
    PrismaModule,
    RateLimitModule,
    DatabaseModule,
    StaffAccessModule,
    AdminModule,
    EvidencePackModule,
    RuntimeCoreModule,
    AuthModule,
    LotsModule,
    DealsModule,
    CommodityProfilesModule,
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
    MfaModule,
    ComplianceModule,
    ArbitratorModule,
    IntegrationEventsModule,
    ExportsModule,
    ElevatorModule,
    OrganizationsModule,
    AnalyticsModule,
    PartnerApiModule,
    SagaModule,
    OutboxModule,
    FactoringModule,
    BankReconciliationModule,
    SupportModule,
    KycModule,
    CertificateMonitorModule,
    RailwayModule,
    ExportTradeModule,
    SearchModule,
    MlClientModule,
    KafkaModule,
    VaultModule,
    AiInsightsModule,
    RuntimeSnapshotModule,
    RuntimePersistenceModule,
    TaiToolsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: PreAuthRateLimitGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AppAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LogMaskingMiddleware).forRoutes('*');
  }
}
