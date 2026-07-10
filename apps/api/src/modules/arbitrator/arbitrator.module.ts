import { Module } from '@nestjs/common';
import { ArbitratorService } from './arbitrator.service';
import { ArbitratorController } from './arbitrator.controller';
import { DisputesModule } from '../disputes/disputes.module';

@Module({
  imports: [DisputesModule],
  providers: [ArbitratorService],
  controllers: [ArbitratorController],
  exports: [ArbitratorService],
})
export class ArbitratorModule {}
