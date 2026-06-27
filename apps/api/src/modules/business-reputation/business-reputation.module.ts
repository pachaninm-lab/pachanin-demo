import { Module } from '@nestjs/common';
import { BusinessReputationService } from './business-reputation.service';
import { BusinessReputationController } from './business-reputation.controller';

@Module({
  providers: [BusinessReputationService],
  controllers: [BusinessReputationController],
  exports: [BusinessReputationService],
})
export class BusinessReputationModule {}
