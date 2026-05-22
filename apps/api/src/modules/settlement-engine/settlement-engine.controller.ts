import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Headers, HttpCode, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as crypto from 'crypto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { SettlementEngineService } from './settlement-engine.service';
import { RequestUser } from '../../common/types/request-user';

const BANK_HMAC_SECRET = process.env.BANK_HMAC_SECRET ?? 'pachanin-demo-bank-secret-dev';

@UseGuards(RolesGuard)
@Roles('ACCOUNTING', 'SUPPORT_MANAGER', 'ADMIN', 'EXECUTIVE')
@Controller('settlement-engine')
export class SettlementEngineController {
  constructor(private readonly settlementEngine: SettlementEngineService) {}

  @Get('deal/:id')
  async worksheet(@Param('id') id: string) {
    return this.settlementEngine.worksheet(id);
  }

  @Get('deal/:id/bank-workspace')
  async bankWorkspace(@Param('id') id: string) {
    return this.settlementEngine.bankWorkspace(id);
  }

  @Get('payments')
  async payments(@CurrentUser() user: RequestUser) {
    return this.settlementEngine.listPayments(user);
  }

  @Get('payments/:id')
  async paymentDetail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.settlementEngine.paymentDetail(id, user);
  }

  @Get('outbox')
  async outbox(@Query('dealId') dealId: string | undefined) {
    return this.settlementEngine.getOutboxStatus(dealId);
  }

  @Get('export')
  async exportDeals(
    @Query('format') format: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = await this.settlementEngine.exportDeals({ format, from, to }, user);
    res.setHeader('Content-Type', payload.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${payload.fileName}"`);
    return payload.body;
  }

  @Get('export/contractors')
  async exportContractors(@CurrentUser() user: RequestUser, @Res({ passthrough: true }) res: Response) {
    const payload = await this.settlementEngine.exportContractors(user);
    res.setHeader('Content-Type', payload.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${payload.fileName}"`);
    return payload.body;
  }

  /** Request bank reserve — creates outbox entry, does NOT self-confirm */
  @Post('deal/:id/reserve')
  async requestReserve(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.settlementEngine.requestReserve(id, user);
  }

  /** Request bank release — creates outbox entry, does NOT self-release */
  @Post('deal/:id/release')
  async requestRelease(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.settlementEngine.requestRelease(id, user);
  }

  /** Manual operator override — reserve confirm (operator/admin only) */
  @Post('deal/:id/confirm')
  async confirm(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.settlementEngine.confirmWorksheet(id, user);
  }

  @Post('deal/:id/adjust')
  async adjust(
    @Param('id') id: string,
    @Body() body: { adjustments: any[] },
    @CurrentUser() user: RequestUser,
  ) {
    return this.settlementEngine.adjustWorksheet(id, body.adjustments, user);
  }

  @Post('import-bank-statement')
  async importBankStatement(
    @Body() body: { content: string; format: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.settlementEngine.importBankStatement(body.content, body.format, user);
  }

  /**
   * Bank callback — the ONLY path to confirm or fail a reserve/release.
   * Authenticated via HMAC-SHA256 signature, not JWT.
   * Body: { dealId, status: 'SUCCESS'|'FAILED', outboxId?, errorMessage? }
   * Header: X-Bank-Signature: hmac-sha256=<hex>
   */
  @Public()
  @Post('bank-callback')
  @HttpCode(200)
  async bankCallback(
    @Body() body: Record<string, unknown>,
    @Headers('x-bank-signature') sig: string | undefined,
  ) {
    const bodyStr = JSON.stringify(body);
    const expected = 'hmac-sha256=' + crypto.createHmac('sha256', BANK_HMAC_SECRET).update(bodyStr).digest('hex');
    if (!sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      throw new UnauthorizedException('Invalid bank signature');
    }
    return this.settlementEngine.registerSafeDealsCallback(body);
  }
}
