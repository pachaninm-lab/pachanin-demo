import { Module } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { AuthModule } from '../auth/auth.module';
import { OutboxModule } from '../../common/outbox/outbox.module';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { DealCommandService } from './deal-command.service';
import { IndustrialDealCommandGateway } from './industrial-deal-command.gateway';
import { CanonicalTestDealSeedService } from './canonical-test-deal.seed';
import { DealEventService } from './deal-event.service';
import { DEAL_REPOSITORY } from './deal.repository';
import { PrismaDealRepository } from './prisma-deal.repository';

/**
 * Deal routes are PostgreSQL-authoritative by construction. There is no
 * RuntimeCore provider, repository factory, optional Prisma dependency or mode
 * fallback in the production DI graph.
 */
@Module({
  imports: [AuthModule, OutboxModule],
  controllers: [DealsController],
  providers: [
    DealsService,
    DealCommandService,
    IndustrialDealCommandGateway,
    PrismaDealRepository,
    CanonicalTestDealSeedService,
    DealEventService,
    AccessScopeService,
    { provide: DEAL_REPOSITORY, useExisting: PrismaDealRepository },
  ],
  exports: [DealsService, IndustrialDealCommandGateway, DealEventService],
})
export class DealsModule {}
