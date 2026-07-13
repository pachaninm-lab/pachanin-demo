import { Module } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { AuthModule } from '../auth/auth.module';
import { SettlementEngineModule } from '../settlement-engine/settlement-engine.module';
import { SettlementAwareDealCommandService } from '../settlement-engine/settlement-aware-deal-command.service';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { DealCommandService } from './deal-command.service';
import { DealRegistryQueryService } from './deal-registry-query.service';
import { IndustrialDealCommandGateway } from './industrial-deal-command.gateway';
import { CanonicalTestDealSeedService } from './canonical-test-deal.seed';
import { DEAL_REPOSITORY } from './deal.repository';
import { PrismaDealRepository } from './prisma-deal.repository';

/**
 * Deal routes are PostgreSQL-authoritative by construction. Settlement money
 * commands use the same PostgreSQL authority repository as verified callbacks;
 * the registry remains the participant-scoped PostgreSQL read model.
 */
@Module({
  imports: [AuthModule, SettlementEngineModule],
  controllers: [DealsController],
  providers: [
    DealsService,
    SettlementAwareDealCommandService,
    { provide: DealCommandService, useExisting: SettlementAwareDealCommandService },
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
