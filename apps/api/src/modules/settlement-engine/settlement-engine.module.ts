import { Module, type Provider } from '@nestjs/common';
import { RuntimeCoreModule } from '../runtime-core/runtime-core.module';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import { ActionExecutorModule } from '../../common/action-executor/action-executor.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DealsModule } from '../deals/deals.module';
import { SettlementEngineController } from './settlement-engine.controller';
import { SettlementEngineService } from './settlement-engine.service';
import { BankCallbackKeyService } from './bank-callback-key.service';
import { PAYMENT_REPOSITORY } from './payment.repository';
import { selectPaymentRepository } from './payment-repository.factory';

/**
 * Payment read repository binding.
 *
 * Default (controlled-pilot / pre-integration): RuntimeCore read adapter.
 * The DB-backed Prisma read adapter is selected only when
 * PLATFORM_V7_PAYMENT_REPOSITORY=prisma is explicitly set. Canonical money
 * mutations continue through the PostgreSQL Deal command boundary.
 */
const paymentRepositoryProvider: Provider = {
  provide: PAYMENT_REPOSITORY,
  useFactory: (runtime: RuntimeCoreService, prisma?: PrismaService) =>
    selectPaymentRepository(runtime, prisma),
  inject: [RuntimeCoreService, { token: PrismaService, optional: true }],
};

@Module({
  imports: [PrismaModule, RuntimeCoreModule, ActionExecutorModule, DealsModule],
  controllers: [SettlementEngineController],
  providers: [SettlementEngineService, BankCallbackKeyService, paymentRepositoryProvider],
  exports: [SettlementEngineService, BankCallbackKeyService],
})
export class SettlementEngineModule {}
