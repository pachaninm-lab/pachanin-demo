import { Module } from '@nestjs/common';
import { DealsModule } from '../deals/deals.module';
import { IntegrationEventsModule } from '../integration-events/integration-events.module';
import { BankReconciliationModule } from '../bank-reconciliation/bank-reconciliation.module';
import { SettlementEngineController } from './settlement-engine.controller';
import { SettlementEngineService } from './settlement-engine.service';
import { BankKeyRegistryService } from './bank-key-registry.service';
import { PAYMENT_REPOSITORY } from './payment.repository';
import { PrismaPaymentRepository } from './prisma-payment.repository';

/**
 * Production settlement is PostgreSQL-authoritative by construction.
 * RuntimeCore, repository factories, optional Prisma, ActionExecutor memory
 * authority and process-memory OutboxService are absent from this graph.
 */
@Module({
  imports: [DealsModule, IntegrationEventsModule, BankReconciliationModule],
  controllers: [SettlementEngineController],
  providers: [
    SettlementEngineService,
    BankKeyRegistryService,
    PrismaPaymentRepository,
    { provide: PAYMENT_REPOSITORY, useExisting: PrismaPaymentRepository },
  ],
  exports: [SettlementEngineService, BankKeyRegistryService],
})
export class SettlementEngineModule {}
