import { Module } from '@nestjs/common';
import { ExportTradeController } from './export-trade.controller';
import { ExportTradeService } from './export-trade.service';

@Module({
  controllers: [ExportTradeController],
  providers: [ExportTradeService],
  exports: [ExportTradeService],
})
export class ExportTradeModule {}
