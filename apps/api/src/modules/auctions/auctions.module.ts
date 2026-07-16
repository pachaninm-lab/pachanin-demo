import { Module } from '@nestjs/common';
import { AuctionAuthorityService } from './auction-authority.service';
import { AuctionCommandService } from './auction-command.service';
import { AuctionsController } from './auctions.controller';
import { MarketShowcaseController } from './market-showcase.controller';
import { MarketShowcaseService } from './market-showcase.service';

@Module({
  controllers: [AuctionsController, MarketShowcaseController],
  providers: [AuctionAuthorityService, AuctionCommandService, MarketShowcaseService],
  exports: [AuctionAuthorityService, AuctionCommandService, MarketShowcaseService],
})
export class AuctionsModule {}
