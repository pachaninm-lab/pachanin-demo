import { Module, type Provider } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { AuditModule } from '../audit/audit.module';
import { AntiFraudModule } from '../anti-fraud/anti-fraud.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { LedgerModule } from '../ledger/ledger.module';
import { ActionExecutorModule } from '../../common/action-executor/action-executor.module';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { DealEventService } from './deal-event.service';
import { SagaModule } from '../saga/saga.module';
import { DEAL_REPOSITORY } from './deal.repository';
import { selectDealRepository } from './deal-repository.factory';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Deal repository binding.
 *
 * Default (controlled-pilot / pre-integration): in-memory RuntimeCore adapter.
 * The DB-backed Prisma adapter is selected ONLY when
 * PLATFORM_V7_DEAL_REPOSITORY=prisma is explicitly set. There is no silent
 * Prisma activation and no silent fallback between adapters.
 */
const dealRepositoryProvider: Provider = {
  provide: DEAL_REPOSITORY,
  useFactory: (runtime: RuntimeCoreService, prisma?: PrismaService) =>
    selectDealRepository(runtime, prisma),
  inject: [RuntimeCoreService, { token: PrismaService, optional: true }],
};

@Module({
  imports: [AuditModule, AntiFraudModule, NotificationsModule, IntegrationsModule, LedgerModule, ActionExecutorModule, SagaModule],
  controllers: [DealsController],
  providers: [DealsService, DealEventService, AccessScopeService, dealRepositoryProvider],
  exports: [DealsService, DealEventService],
})
export class DealsModule {}
