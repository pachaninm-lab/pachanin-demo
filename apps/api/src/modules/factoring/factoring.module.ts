import { Module } from '@nestjs/common';
import { FactoringService } from './factoring.service';
import { FactoringController } from './factoring.controller';

@Module({
  providers: [FactoringService],
  controllers: [FactoringController],
  exports: [FactoringService],
})
export class FactoringModule {}
