import { Module } from '@nestjs/common';
import { AuctionAuthorityService } from './auction-authority.service';
import { AuctionsController } from './auctions.controller';

@Module({
  controllers: [AuctionsController],
  providers: [AuctionAuthorityService],
  exports: [AuctionAuthorityService],
})
export class AuctionsModule {}
