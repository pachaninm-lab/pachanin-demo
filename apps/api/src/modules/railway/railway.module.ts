import { Module } from '@nestjs/common';
import { RailwayController } from './railway.controller';
import { RailwayService } from './railway.service';

@Module({
  controllers: [RailwayController],
  providers: [RailwayService],
  exports: [RailwayService],
})
export class RailwayModule {}
