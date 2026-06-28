import { Module } from '@nestjs/common';
import { ArbitratorService } from './arbitrator.service';
import { ArbitratorController } from './arbitrator.controller';
import { AuditModule } from '../audit/audit.module';
import { LedgerV2Service } from '../ledger/ledger-v2.service';

@Module({
  imports: [AuditModule],
  providers: [ArbitratorService, LedgerV2Service],
  controllers: [ArbitratorController],
  exports: [ArbitratorService],
})
export class ArbitratorModule {}
