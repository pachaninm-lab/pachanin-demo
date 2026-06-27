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

  @Get('commission-preview')
  commissionPreview(
    @Query('amount') amount: string,
    @Query('volumeTons') volumeTons?: string,
    @Query('culture') culture?: string,
    @Query('isSubscriber') isSubscriber?: string,
  ) {
    const dealAmountKopecks = Math.round(Number(amount ?? 0) * 100);
    return this.analytics.calculateCommission({
      dealAmountKopecks,
      culture,
      volumeTons: volumeTons ? Number(volumeTons) : undefined,
      isSubscriber: isSubscriber === 'true',
    });
  }

  @Get('price-prediction')
  pricePrediction(
    @Query('culture') culture: string,
    @Query('region') region: string,
    @Query('cropClass') cropClass?: string,
    @Query('volumeTons') volumeTons?: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.analytics.getPricePrediction(
      { culture: culture ?? 'пшеница', region: region ?? 'Краснодарский край', cropClass, volumeTons: volumeTons ? Number(volumeTons) : undefined },
      user,
    );
  }
}
