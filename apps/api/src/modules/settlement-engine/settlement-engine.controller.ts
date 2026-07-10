import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { BadRequestException, Headers, HttpCode, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { SettlementEngineService } from './settlement-engine.service';
import { RequestUser } from '../../common/types/request-user';
import { RequiresMfaGuard } from '../../common/guards/mfa.guard';
import { IndustrialDealCommandGateway, type VerifiedBankCallbackInput } from '../deals/industrial-deal-command.gateway';
import { CANONICAL_TEST_DEAL_ID } from '../deals/deal-command.policy';
import { BankCallbackKeyService } from './bank-callback-key.service';
import {
  canonicalizeBankPayload,
  buildBankSignaturePayload,
  expectedBankOperationId,
  type JsonRecord,
} from './bank-callback-signature';

export { canonicalizeBankPayload, buildBankSignaturePayload, expectedBankOperationId } from './bank-callback-signature';

@UseGuards(RolesGuard)
@Roles('ACCOUNTING', 'SUPPORT_MANAGER', 'ADMIN', 'EXECUTIVE')
@Controller('settlement-engine')
export class SettlementEngineController {
  constructor(
    private readonly settlementEngine: SettlementEngineService,
    private readonly industrialCommands: IndustrialDealCommandGateway,
    private readonly bankCallbackKeys: BankCallbackKeyService,
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

  @Post('deal/:id/reserve')
  @RateLimit({
    name: 'money_reserve_request',
    scope: 'org',
    limit: 6,
    windowSeconds: 60,
    limitEnv: 'RATE_LIMIT_MONEY_REQUEST',
    windowEnv: 'RATE_LIMIT_MONEY_WINDOW_SECONDS',
    includeParams: ['id'],
  })
  async requestReserve(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.settlementEngine.requestReserve(id, user);
  }

  @Post('deal/:id/release')
  @UseGuards(RequiresMfaGuard)
  @RateLimit({
    name: 'money_release_request',
    scope: 'org',
    limit: 6,
    windowSeconds: 60,
    limitEnv: 'RATE_LIMIT_MONEY_REQUEST',
    windowEnv: 'RATE_LIMIT_MONEY_WINDOW_SECONDS',
    includeParams: ['id'],
  })
  async requestRelease(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.settlementEngine.requestRelease(id, user);
  }

  @Post('deal/:id/confirm')
  @RateLimit({ name: 'money_legacy_confirm', scope: 'user', limit: 6, windowSeconds: 60, includeParams: ['id'] })
  async confirm(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    if (id === CANONICAL_TEST_DEAL_ID) {
      throw new UnauthorizedException('Canonical money state can only be confirmed by a verified bank callback.');
    }
    return this.settlementEngine.confirmWorksheet(id, user);
  }

  @Post('deal/:id/adjust')
  @RateLimit({ name: 'money_adjust', scope: 'user', limit: 10, windowSeconds: 60, includeParams: ['id'] })
  async adjust(
    @Param('id') id: string,
    @Body() body: { adjustments: any[] },
    @CurrentUser() user: RequestUser,
  ) {
    return this.settlementEngine.adjustWorksheet(id, body.adjustments, user);
  }

  @Post('import-bank-statement')
  @RateLimit({ name: 'bank_statement_legacy_import', scope: 'user', limit: 2, windowSeconds: 300 })
  async importBankStatement(
    @Body() body: { content: string; format: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.settlementEngine.importBankStatement(body.content, body.format, user);
  }

  @Get('bank-callback-keys')
  @Roles('ADMIN', 'COMPLIANCE_OFFICER')
  listBankCallbackKeys(
    @Query('partnerId') partnerId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.bankCallbackKeys.listKeys(partnerId, user);
  }

  @Post('bank-callback-keys')
  @Roles('ADMIN')
  @UseGuards(RequiresMfaGuard)
  @RateLimit({ name: 'bank_callback_key_register', scope: 'user', limit: 10, windowSeconds: 300 })
  registerBankCallbackKey(
    @Body() body: {
      partnerId: string;
      keyId: string;
      secretRef: string;
      validFrom: string;
      validUntil?: string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    return this.bankCallbackKeys.registerKey(body, user);
  }

  @Post('bank-callback-keys/:partnerId/:keyId/revoke')
  @Roles('ADMIN')
  @UseGuards(RequiresMfaGuard)
  @RateLimit({ name: 'bank_callback_key_revoke', scope: 'user', limit: 10, windowSeconds: 300 })
  revokeBankCallbackKey(
    @Param('partnerId') partnerId: string,
    @Param('keyId') keyId: string,
    @Body() body: { reason: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.bankCallbackKeys.revokeKey(partnerId, keyId, body.reason, user);
  }

  /**
   * The only public bank confirmation path. Key metadata is resolved from
   * PostgreSQL; HMAC secret material remains in Vault/environment by secretRef.
   */
  @Public()
  @Post('bank-callback')
  @HttpCode(200)
  @RateLimit({
    name: 'bank_callback',
    scope: 'ip',
    limit: 120,
    windowSeconds: 60,
    limitEnv: 'RATE_LIMIT_BANK_CALLBACK',
    windowEnv: 'RATE_LIMIT_BANK_CALLBACK_WINDOW_SECONDS',
  })
  async bankCallback(
    @Body() body: JsonRecord,
    @Headers('x-bank-signature') signature: string | undefined,
    @Headers('x-bank-timestamp') timestampHeader: string | undefined,
    @Headers('x-bank-event-id') eventIdHeader: string | undefined,
    @Headers('x-bank-partner-id') partnerIdHeader: string | undefined,
    @Headers('x-bank-key-id') keyIdHeader: string | undefined,
  ) {
    const verified = await this.bankCallbackKeys.verifyCallback({
      partnerId: partnerIdHeader,
      keyId: keyIdHeader,
      timestampHeader,
      eventIdHeader,
      signature,
      body,
    });

    if (body.dealId === CANONICAL_TEST_DEAL_ID) {
      const dealId = String(body.dealId);
      const operationId = typeof body.operationId === 'string' ? body.operationId : '';
      const requiredOperationId = expectedBankOperationId(dealId, body.operation);
      if (operationId !== requiredOperationId) {
        throw new BadRequestException({
          code: 'BANK_OPERATION_ID_MISMATCH',
          expectedOperationId: requiredOperationId,
        });
      }

      return this.industrialCommands.executeBankCallback({
        ...(body as unknown as VerifiedBankCallbackInput),
        operationId,
        partnerId: verified.partnerId,
      });
    }

    return this.settlementEngine.registerSafeDealsCallback(body);
  }
}
