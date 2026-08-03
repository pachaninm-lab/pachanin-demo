import { Module } from '@nestjs/common';
import { AuctionAuthorityService } from './auction-authority.service';
import { AuctionCommandService } from './auction-command.service';
import { AuctionsController } from './auctions.controller';
import { FgisLegacyQuarantineModule } from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine.module';

@Module({
  imports: [FgisLegacyQuarantineModule],
  controllers: [AuctionsController],
  providers: [AuctionAuthorityService, AuctionCommandService],
  exports: [AuctionAuthorityService, AuctionCommandService],
})
export class AuctionsModule {}
