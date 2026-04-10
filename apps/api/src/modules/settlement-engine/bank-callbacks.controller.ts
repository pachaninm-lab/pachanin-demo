import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { SettlementEngineService } from './settlement-engine.service';

@Controller('bank-callbacks')
export class BankCallbacksController {
  constructor(private readonly settlementEngine: SettlementEngineService) {}

  @Public({ envFlag: 'ENABLE_PUBLIC_RUNTIME_MUTATIONS' })
  @Post('safe-deals')
  receiveSafeDeals(@Body() body: any) {
    return this.settlementEngine.registerSafeDealsCallback(body);
  }
}
