import { Module } from '@nestjs/common';
import { AuctionAuthorityService } from './auction-authority.service';
import { AuctionCommandService } from './auction-command.service';
import { AuctionsController } from './auctions.controller';
import { PublicAuctionMarketController } from './public-auction-market.controller';
import { PublicAuctionMarketService } from './public-auction-market.service';
import { FgisLegacyQuarantineModule } from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine.module';

@Module({
  imports: [FgisLegacyQuarantineModule],
  controllers: [AuctionsController, PublicAuctionMarketController],
  providers: [AuctionAuthorityService, AuctionCommandService, PublicAuctionMarketService],
  exports: [AuctionAuthorityService, AuctionCommandService],
})
export class AuctionsModule {}
