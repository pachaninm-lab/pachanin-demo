import { Module, type Provider } from '@nestjs/common';
import { RuntimeCoreModule } from '../runtime-core/runtime-core.module';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import { ActionExecutorModule } from '../../common/action-executor/action-executor.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DealsModule } from '../deals/deals.module';
import { IntegrationEventsModule } from '../integration-events/integration-events.module';
import { SettlementEngineController } from './settlement-engine.controller';
import { SettlementEngineService } from './settlement-engine.service';
import { BankKeyRegistryService } from './bank-key-registry.service';
import { PAYMENT_REPOSITORY } from './payment.repository';
import { selectPaymentRepository } from './payment-repository.factory';

/**
 * Payment read repository binding.
 *
 * Default (controlled-pilot / pre-integration): in-memory RuntimeCore adapter.
 * The DB-backed Prisma read adapter is selected ONLY when
 * PLATFORM_V7_PAYMENT_REPOSITORY=prisma is explicitly set. There is no silent
 * Prisma activation, and money mutations never go through this provider.
 */
const paymentRepositoryProvider: Provider = {
  provide: PAYMENT_REPOSITORY,
  useFactory: (runtime: RuntimeCoreService, prisma?: PrismaService) =>
    selectPaymentRepository(runtime, prisma),
  inject: [RuntimeCoreService, { token: PrismaService, optional: true }],
};

@Module({
  imports: [RuntimeCoreModule, ActionExecutorModule, DealsModule, IntegrationEventsModule],
  // The former BankCallbacksController exposed an unsigned runtime mutation behind
  // an environment flag. It is intentionally removed from the module graph.
  controllers: [SettlementEngineController],
  providers: [SettlementEngineService, BankKeyRegistryService, paymentRepositoryProvider],
  exports: [SettlementEngineService, BankKeyRegistryService],
})
export class SettlementEngineModule {}
