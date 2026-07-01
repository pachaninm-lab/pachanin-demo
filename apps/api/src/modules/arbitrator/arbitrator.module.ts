import { Module } from '@nestjs/common';
import { ArbitratorService } from './arbitrator.service';
import { ArbitratorController } from './arbitrator.controller';
import { AuditModule } from '../audit/audit.module';
import { LedgerV2Service } from '../ledger/ledger-v2.service';
import { ActionExecutorModule } from '../../common/action-executor/action-executor.module';

@Module({
  imports: [AuditModule, ActionExecutorModule],
  providers: [ArbitratorService, LedgerV2Service],
  controllers: [ArbitratorController],
  exports: [ArbitratorService],
})
export class ArbitratorModule {}
