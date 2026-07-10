import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequestUser } from '../../common/types/request-user';
import { BankReconciliationService } from './bank-reconciliation.service';

@Controller('bank/reconciliation')
@UseGuards(RolesGuard)
@Roles('ANY_AUTHENTICATED')
export class BankReconciliationController {
  constructor(private readonly bankReconciliation: BankReconciliationService) {}

  @Post('import')
  @RateLimit({
    name: 'bank_reconciliation_import',
    scope: 'user',
    limit: 10,
    windowSeconds: 300,
  })
  importMT940(
    @Body() body: { partnerId: string; cursor: string; content: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.bankReconciliation.importMT940(body.content, user, {
      partnerId: body.partnerId,
      cursor: body.cursor,
    });
  }

  @Get('unmatched')
  listUnmatched(
    @CurrentUser() user: RequestUser,
    @Query('partnerId') partnerId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.bankReconciliation.listUnmatched(user, {
      partnerId,
      limit: limit === undefined ? undefined : Number(limit),
      offset: offset === undefined ? undefined : Number(offset),
    }).then((items) => ({ items }));
  }

  @Post('match')
  @RateLimit({
    name: 'bank_reconciliation_manual_match',
    scope: 'user',
    limit: 30,
    windowSeconds: 300,
  })
  manualMatch(
    @Body() body: { recordId: string; dealId: string; reason: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.bankReconciliation.manualMatch(body.recordId, body.dealId, body.reason, user);
  }

  @Get('report')
  getReport(
    @CurrentUser() user: RequestUser,
    @Query('partnerId') partnerId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.bankReconciliation.getReport(user, { partnerId, from, to });
  }
}
