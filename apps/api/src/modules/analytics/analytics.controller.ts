import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';
import { AnalyticsService } from './analytics.service';

@Controller('api/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('unit-economics')
  unitEconomics(
    @CurrentUser() user: RequestUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getUnitEconomics(user, { from, to });
  }

  @Get('ledger-summary')
  ledgerSummary(@CurrentUser() user: RequestUser) {
    return this.analytics.getLedgerSummary(user);
  }
}
