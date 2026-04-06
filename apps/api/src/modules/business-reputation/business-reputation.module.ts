import { Module } from '@nestjs/common';
import { BusinessReputationService } from './business-reputation.service';

@Module({
  providers: [BusinessReputationService],
  exports: [BusinessReputationService],
})
export class BusinessReputationModule {}
