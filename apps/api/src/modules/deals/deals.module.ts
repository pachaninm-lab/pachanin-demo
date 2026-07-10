import { Module, type Provider } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { AuditModule } from '../audit/audit.module';
import { AntiFraudModule } from '../anti-fraud/anti-fraud.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { LedgerModule } from '../ledger/ledger.module';
import { AuthModule } from '../auth/auth.module';
import { ActionExecutorModule } from '../../common/action-executor/action-executor.module';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { DealCommandService } from './deal-command.service';
import { IndustrialDealCommandGateway } from './industrial-deal-command.gateway';
import { CanonicalTestDealSeedService } from './canonical-test-deal.seed';
import { DealEventService } from './deal-event.service';
import { DealAutoService } from './deal-auto.service';
import { SagaModule } from '../saga/saga.module';
import { OutboxModule } from '../../common/outbox/outbox.module';
import { DEAL_REPOSITORY } from './deal.repository';
import { selectDealRepository } from './deal-repository.factory';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Legacy deal repository binding.
 *
 * The canonical industrial command path is implemented by DealCommandService and
 * IndustrialDealCommandGateway and always writes through Prisma/PostgreSQL. The
 * legacy repository remains only for existing read surfaces while they are migrated.
 */
const dealRepositoryProvider: Provider = {
  provide: DEAL_REPOSITORY,
  useFactory: (runtime: RuntimeCoreService, prisma?: PrismaService) =>
    selectDealRepository(runtime, prisma),
  inject: [RuntimeCoreService, { token: PrismaService, optional: true }],
};

@Module({
  imports: [AuthModule, AuditModule, AntiFraudModule, NotificationsModule, IntegrationsModule, LedgerModule, ActionExecutorModule, SagaModule, OutboxModule],
  controllers: [DealsController],
  providers: [
    DealsService,
    DealCommandService,
    IndustrialDealCommandGateway,
    CanonicalTestDealSeedService,
    DealEventService,
    DealAutoService,
    AccessScopeService,
    dealRepositoryProvider,
  ],
  exports: [DealsService, IndustrialDealCommandGateway, DealEventService],
})
export class DealsModule {}
