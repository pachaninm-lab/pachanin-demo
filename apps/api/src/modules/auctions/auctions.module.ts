import { Module } from '@nestjs/common';
import { AuctionAuthorityService } from './auction-authority.service';
import { AuctionCommandService } from './auction-command.service';
import { AuctionsController } from './auctions.controller';

@Module({
  controllers: [AuctionsController],
  providers: [AuctionAuthorityService, AuctionCommandService],
  exports: [AuctionAuthorityService, AuctionCommandService],
})
export class AuctionsModule {}
