import { Module } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { AuthModule } from '../auth/auth.module';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { DealCommandService } from './deal-command.service';
import { DealRegistryQueryService } from './deal-registry-query.service';
import { IndustrialDealCommandGateway } from './industrial-deal-command.gateway';
import { CanonicalTestDealSeedService } from './canonical-test-deal.seed';
import { DEAL_REPOSITORY } from './deal.repository';
import { PostgresqlDealCommandService } from './postgresql-deal-command.service';
import { PrismaDealRepository } from './prisma-deal.repository';

/**
 * Deal routes are PostgreSQL-authoritative by construction. There is no
 * RuntimeCore provider, repository factory, optional Prisma dependency,
 * best-effort DealEvent adapter or mode fallback in the production DI graph.
 */
@Module({
  imports: [AuthModule],
  controllers: [DealsController],
  providers: [
    DealsService,
    PostgresqlDealCommandService,
    { provide: DealCommandService, useExisting: PostgresqlDealCommandService },
    DealRegistryQueryService,
    IndustrialDealCommandGateway,
    PrismaDealRepository,
    CanonicalTestDealSeedService,
    AccessScopeService,
    { provide: DEAL_REPOSITORY, useExisting: PrismaDealRepository },
  ],
  exports: [DealsService, DealRegistryQueryService, IndustrialDealCommandGateway],
})
export class DealsModule {}
