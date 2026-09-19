import { Module } from '@nestjs/common';
import { IntegrationEventsModule } from '../integration-events/integration-events.module';
import { SettlementAccessService } from './settlement-access.service';
import { SettlementEngineController } from './settlement-engine.controller';
import { SettlementEngineService } from './settlement-engine.service';
import { SettlementFinancialMfaGuard } from './settlement-financial-mfa.guard';
import { SettlementPostgresqlRepository } from './settlement-postgresql.repository';
import { BankKeyRegistryService } from './bank-key-registry.service';

/**
 * Production Settlement is PostgreSQL-authoritative by construction.
 * RuntimeCore, ActionExecutor, optional Prisma, repository factories and the
 * process-memory outbox are absent from this dependency graph.
 */
@Module({
  imports: [IntegrationEventsModule],
  controllers: [SettlementEngineController],
  providers: [
    SettlementAccessService,
    SettlementFinancialMfaGuard,
    SettlementEngineService,
    SettlementPostgresqlRepository,
    BankKeyRegistryService,
  ],
  exports: [
    SettlementAccessService,
    SettlementEngineService,
    SettlementPostgresqlRepository,
    BankKeyRegistryService,
  ],
})
export class SettlementEngineModule {}
