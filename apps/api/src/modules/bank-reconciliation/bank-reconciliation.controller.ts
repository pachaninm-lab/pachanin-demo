import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';
import { BankReconciliationService } from './bank-reconciliation.service';

@Controller('api/bank/reconciliation')
@UseGuards(JwtAuthGuard)
export class BankReconciliationController {
  constructor(private readonly bankReconciliation: BankReconciliationService) {}

  @Post('import')
  importMT940(@Body() body: { content: string }, @CurrentUser() user: RequestUser) {
    return this.bankReconciliation.importMT940(body.content, user);
  }

  @Get('unmatched')
  listUnmatched(@CurrentUser() user: RequestUser) {
    return { items: this.bankReconciliation.listUnmatched(user) };
  }

  @Post('match')
  manualMatch(
    @Body() body: { paymentId: string; dealId: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.bankReconciliation.manualMatch(body.paymentId, body.dealId, user);
  }

  @Get('report')
  getReport(
    @CurrentUser() user: RequestUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.bankReconciliation.getReport(user, { from, to });
  }
}
