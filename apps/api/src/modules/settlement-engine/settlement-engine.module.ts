import { Module } from '@nestjs/common';
import { SettlementEngineController } from './settlement-engine.controller';
import { SettlementEngineService } from './settlement-engine.service';

@Module({ controllers: [SettlementEngineController], providers: [SettlementEngineService] })
export class SettlementEngineModule {}
