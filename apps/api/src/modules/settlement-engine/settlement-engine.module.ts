import { Module } from '@nestjs/common';
import { RuntimeCoreModule } from '../runtime-core/runtime-core.module';
import { BankCallbacksController } from './bank-callbacks.controller';
import { SettlementEngineController } from './settlement-engine.controller';
import { SettlementEngineService } from './settlement-engine.service';

@Module({
  imports: [RuntimeCoreModule],
  controllers: [SettlementEngineController, BankCallbacksController],
  providers: [SettlementEngineService],
  exports: [SettlementEngineService],
})
export class SettlementEngineModule {}
