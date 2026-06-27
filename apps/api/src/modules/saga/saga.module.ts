import { Module } from '@nestjs/common';
import { DealSagaService } from './deal-saga.service';
import { SagaController } from './saga.controller';
import { FgisStepService } from './fgis-step.service';

@Module({
  providers: [DealSagaService, FgisStepService],
  controllers: [SagaController],
  exports: [DealSagaService, FgisStepService],
})
export class SagaModule {}
