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
import { RequiresMfaGuard } from '../../common/guards/mfa.guard';
import { requireSecret } from '../../common/config/secrets';
import { IndustrialDealCommandGateway, type VerifiedBankCallbackInput } from '../deals/industrial-deal-command.gateway';
import { CANONICAL_TEST_DEAL_ID } from '../deals/deal-command.policy';

const BANK_HMAC_SECRET = requireSecret('BANK_HMAC_SECRET');
const BANK_CALLBACK_TOLERANCE_SECONDS = 300;

@UseGuards(RolesGuard)
@Roles('ACCOUNTING', 'SUPPORT_MANAGER', 'ADMIN', 'EXECUTIVE')
@Controller('settlement-engine')
export class SettlementEngineController {
  constructor(
    private readonly settlementEngine: SettlementEngineService,
    private readonly industrialCommands: IndustrialDealCommandGateway,
  ) {}

  @Get('deal/:id')
  async worksheet(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.settlementEngine.worksheet(id, user);
  }

  @Get('deal/:id/bank-workspace')
  async bankWorkspace(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.settlementEngine.bankWorkspace(id, user);
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

  /** Request bank reserve — creates outbox entry, does NOT self-confirm. */
  @Post('deal/:id/reserve')
  async requestReserve(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.settlementEngine.requestReserve(id, user);
  }

  /** Request bank release — creates outbox entry, does NOT self-release. */
  @Post('deal/:id/release')
  @UseGuards(RequiresMfaGuard)
  async requestRelease(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.settlementEngine.requestRelease(id, user);
  }

  /** Legacy manual confirmation. It remains outside the canonical deal path. */
  @Post('deal/:id/confirm')
  async confirm(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    if (id === CANONICAL_TEST_DEAL_ID) {
      throw new UnauthorizedException('Canonical money state can only be confirmed by a verified bank callback.');
    }
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
   * The only public bank confirmation path.
   *
   * Required headers:
   * - X-Bank-Event-Id: globally unique event identifier;
   * - X-Bank-Timestamp: Unix seconds, accepted within ±5 minutes;
   * - X-Bank-Signature: hmac-sha256=<hex> over
   *   `${timestamp}.${eventId}.${JSON.stringify(body)}`.
   *
   * Required body for the canonical deal:
   * { dealId, eventId, operation: 'RESERVE'|'RELEASE', status: 'SUCCESS'|'FAILED', bankRef }
   */
  @Public()
  @Post('bank-callback')
  @HttpCode(200)
  async bankCallback(
    @Body() body: Record<string, unknown>,
    @Headers('x-bank-signature') signature: string | undefined,
    @Headers('x-bank-timestamp') timestampHeader: string | undefined,
    @Headers('x-bank-event-id') eventIdHeader: string | undefined,
  ) {
    const timestamp = Number(timestampHeader);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (!Number.isInteger(timestamp) || Math.abs(nowSeconds - timestamp) > BANK_CALLBACK_TOLERANCE_SECONDS) {
      throw new UnauthorizedException('Expired or invalid bank callback timestamp');
    }

    const bodyEventId = typeof body.eventId === 'string' ? body.eventId : '';
    if (!eventIdHeader || eventIdHeader !== bodyEventId) {
      throw new UnauthorizedException('Bank callback event ID mismatch');
    }

    const signedPayload = `${timestamp}.${eventIdHeader}.${JSON.stringify(body)}`;
    const expected = `hmac-sha256=${crypto.createHmac('sha256', BANK_HMAC_SECRET).update(signedPayload).digest('hex')}`;
    const actualBuffer = Buffer.from(signature ?? '', 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
      throw new UnauthorizedException('Invalid bank signature');
    }

    if (body.dealId === CANONICAL_TEST_DEAL_ID) {
      return this.industrialCommands.executeBankCallback(body as unknown as VerifiedBankCallbackInput);
    }

    return this.settlementEngine.registerSafeDealsCallback(body);
  }
}
