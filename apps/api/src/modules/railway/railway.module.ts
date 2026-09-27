import { Module } from '@nestjs/common';
import { RailwayController } from './railway.controller';
import { RailwayService } from './railway.service';
import { ObjectAccessService } from '../../common/security/object-access.service';

@Module({
  controllers: [RailwayController],
  providers: [RailwayService, ObjectAccessService],
  exports: [RailwayService],
})
export class RailwayModule {}
