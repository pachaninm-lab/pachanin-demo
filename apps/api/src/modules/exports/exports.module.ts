import { Module } from '@nestjs/common';
import { ExportsService } from './exports.service';
import { ExportsController } from './exports.controller';

@Module({
  providers: [ExportsService],
  controllers: [ExportsController],
  exports: [ExportsService],
})
export class ExportsModule {}
