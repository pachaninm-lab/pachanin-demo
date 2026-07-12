import { Module } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { AuthModule } from '../auth/auth.module';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { DealCommandService } from './deal-command.service';
import { IndustrialDealCommandGateway } from './industrial-deal-command.gateway';
import { CanonicalTestDealSeedService } from './canonical-test-deal.seed';
import { DEAL_REPOSITORY } from './deal.repository';
import { PrismaDealRepository } from './prisma-deal.repository';
import { LogisticsAdmissionService } from './logistics-admission.service';
import {
  BASE_DEAL_COMMAND_SERVICE,
  PostgresqlDealCommandService,
} from './postgresql-deal-command.service';

/**
 * Deal routes are PostgreSQL-authoritative by construction. The public command
 * token resolves to the guarded facade; the legacy state-machine implementation
 * is private to the module and cannot assign logistics without a normalized
 * admission context.
 */
@Module({
  imports: [AuthModule],
  controllers: [DealsController],
  providers: [
    DealsService,
    IndustrialDealCommandGateway,
    PrismaDealRepository,
    CanonicalTestDealSeedService,
    LogisticsAdmissionService,
    PostgresqlDealCommandService,
    AccessScopeService,
    { provide: BASE_DEAL_COMMAND_SERVICE, useClass: DealCommandService },
    { provide: DealCommandService, useExisting: PostgresqlDealCommandService },
    { provide: DEAL_REPOSITORY, useExisting: PrismaDealRepository },
  ],
  exports: [DealsService, IndustrialDealCommandGateway],
})
export class DealsModule {}
