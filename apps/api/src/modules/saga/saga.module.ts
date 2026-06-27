import { Module } from '@nestjs/common';
import { DealSagaService } from './deal-saga.service';
import { SagaController } from './saga.controller';

@Module({
  providers: [DealSagaService],
  controllers: [SagaController],
  exports: [DealSagaService],
})
export class SagaModule {}
