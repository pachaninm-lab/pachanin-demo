import { Module } from '@nestjs/common';
import { RoutePlannerController } from './route-planner.controller';
import { RoutePlannerService } from './route-planner.service';

@Module({
  controllers: [RoutePlannerController],
  providers: [RoutePlannerService],
  exports: [RoutePlannerService]
})
export class RoutePlannerModule {}
