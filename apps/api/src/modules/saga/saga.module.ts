import { Module } from '@nestjs/common';
import { DealSagaService } from './deal-saga.service';
import { SagaController } from './saga.controller';
import { FgisStepService } from './fgis-step.service';
import { FgisLegacyQuarantineModule } from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine.module';

@Module({
  imports: [FgisLegacyQuarantineModule],
  providers: [DealSagaService, FgisStepService],
  controllers: [SagaController],
  exports: [DealSagaService, FgisStepService],
})
export class SagaModule {}
