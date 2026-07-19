import { Module } from '@nestjs/common';
import { DealsModule } from '../deals/deals.module';
import { TaiToolAssertionVerifier } from './tai-tool-assertion';
import { TaiToolAssertionGuard } from './tai-tool-assertion.guard';
import { TaiToolsController } from './tai-tools.controller';
import { TaiToolsService } from './tai-tools.service';

@Module({
  imports: [DealsModule],
  controllers: [TaiToolsController],
  providers: [TaiToolAssertionVerifier, TaiToolAssertionGuard, TaiToolsService],
})
export class TaiToolsModule {}
