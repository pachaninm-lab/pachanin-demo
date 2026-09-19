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

  @Get('yield-forecast')
  yieldForecast(
    @Query('region') region: string,
    @Query('culture') culture: string,
    @Query('areaSqHa') areaSqHa: string,
    @Query('season') season?: string,
  ) {
    return this.analytics.getYieldForecast({
      region: region ?? 'Krasnodar Krai',
      culture: culture ?? 'wheat',
      areaSqHa: Number(areaSqHa ?? 100),
      season: season ? Number(season) : undefined,
    });
  }

  @Get('deal-duration-forecast')
  dealDurationForecast(
    @Query('culture') culture?: string,
    @Query('region') region?: string,
    @Query('volumeTons') volumeTons?: string,
    @Query('dealType') dealType?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.analytics.getDealDurationForecast(
      { culture, region, volumeTons: volumeTons ? Number(volumeTons) : undefined, dealType },
      user!,
    );
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

  @Get('unit-economics/scenarios')
  unitEconomicsScenarios(
    @CurrentUser() user: RequestUser,
    @Query('baseGmvRub') baseGmvRub?: string,
    @Query('takeRatePct') takeRatePct?: string,
  ) {
    return this.analytics.getUnitEconomicsScenarios(user, {
      baseGmvRub: baseGmvRub ? Number(baseGmvRub) : undefined,
      takeRatePct: takeRatePct ? Number(takeRatePct) : undefined,
    });
  }

  @Get('price-prediction')
  pricePrediction(
    @Query('culture') culture: string,
    @Query('region') region: string,
    @Query('cropClass') cropClass?: string,
    @Query('volumeTons') volumeTons?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.analytics.getPricePrediction(
      { culture: culture ?? 'wheat', region: region ?? 'Krasnodar Krai', cropClass, volumeTons: volumeTons ? Number(volumeTons) : undefined },
      user!,
    );
  }
}
