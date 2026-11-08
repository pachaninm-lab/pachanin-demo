import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { PublicAuctionMarketService } from './public-auction-market.service';

@Controller('market')
export class PublicAuctionMarketController {
  constructor(private readonly market: PublicAuctionMarketService) {}

  @Public()
  @RateLimit({ name: 'public_market_lots', scope: 'ip', limit: 60, windowSeconds: 60 })
  @Get('lots')
  listLots() {
    return this.market.listLots();
  }
}
