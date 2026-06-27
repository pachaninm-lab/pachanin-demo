import { Module } from '@nestjs/common';
import { PartnerApiService } from './partner-api.service';
import { PartnerApiController } from './partner-api.controller';

@Module({
  providers: [PartnerApiService],
  controllers: [PartnerApiController],
  exports: [PartnerApiService],
})
export class PartnerApiModule {}
