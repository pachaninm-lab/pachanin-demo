import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { LedgerV2Service } from './ledger-v2.service';

@Module({
  providers: [LedgerService, LedgerV2Service],
  exports: [LedgerService, LedgerV2Service],
})
export class LedgerModule {}
