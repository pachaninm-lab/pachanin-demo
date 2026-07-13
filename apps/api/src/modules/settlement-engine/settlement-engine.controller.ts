import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import * as crypto from 'crypto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { SettlementEngineService } from './settlement-engine.service';
import { RequestUser } from '../../common/types/request-user';
import { RequiresMfaGuard } from '../../common/guards/mfa.guard';
import {
  IndustrialDealCommandGateway,
  type VerifiedBankCallbackInput,
} from '../deals/industrial-deal-command.gateway';
import { ExecuteDealCommandDto } from '../deals/dto/execute-deal-command.dto';
import { BankKeyError, BankKeyRegistryService } from './bank-key-registry.service';
import { IntegrationEventsService } from '../integration-events/integration-events.service';

const BANK_CALLBACK_TOLERANCE_SECONDS = 300;
const BANK_CALLBACK_PATH = '/api/settlement-engine/bank-callback';

type JsonRecord = Record<string, unknown>;

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableJsonValue(item)]),
    );
  }
  return value;
}

export function canonicalizeBankPayload(body: JsonRecord): string {
  return JSON.stringify(stableJsonValue(body));
}

export function expectedBankOperationId(dealId: string, operation: unknown): string {
  if (operation === 'RESERVE') return `bank-reserve:${dealId}`;
  if (operation === 'RELEASE') return `bank-release:${dealId}`;
  throw new BadRequestException('Unsupported bank operation');
}

export function buildBankSignaturePayload(input: {
  partnerId: string;
  keyId: string;
  timestamp: number;
  eventId: string;
  body: JsonRecord;
}): string {
  const bodyHash = crypto
    .createHash('sha256')
    .update(canonicalizeBankPayload(input.body))
    .digest('hex');
  return [
    'POST',
    BANK_CALLBACK_PATH,
    input.partnerId,
    input.keyId,
    String(input.timestamp),
    input.eventId,
    bodyHash,
  ].join('\n');
}

function secureSignatureMatch(actual: string | undefined, expected: string): boolean {
  const actualBuffer = Buffer.from(actual ?? '', 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

@UseGuards(RolesGuard)
@Roles('ACCOUNTING', 'SUPPORT_MANAGER', 'ADMIN', 'EXECUTIVE')
@Controller('settlement-engine')
export class SettlementEngineController {
  constructor(
    private readonly settlementEngine: SettlementEngineService,
    private readonly industrialCommands: IndustrialDealCommandGateway,
    private readonly bankKeys: BankKeyRegistryService,
    private readonly integrationEvents: IntegrationEventsService,
  ) {}

  @Get('deal/:id')
  worksheet(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.settlementEngine.worksheet(id, user);
  }

  @Get('deal/:id/bank-workspace')
  bankWorkspace(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.settlementEngine.bankWorkspace(id, user);
  }

  @Get('payments')
  payments(@CurrentUser() user: RequestUser) {
    return this.settlementEngine.listPayments(user);
  }

  @Get('payments/:id')
  paymentDetail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.settlementEngine.paymentDetail(id, user);
  }

  @Get('outbox')
  outbox(
    @Query('dealId') dealId: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settlementEngine.getOutboxStatus(dealId, user);
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
  async exportContractors(
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = await this.settlementEngine.exportContractors(user);
    res.setHeader('Content-Type', payload.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${payload.fileName}"`);
    return payload.body;
  }

  /** Request bank reserve; confirmation is callback-only. */
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
  requestReserve(
    @Param('id') id: string,
    @Body() command: ExecuteDealCommandDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settlementEngine.requestReserve(id, command, user);
  }

  /** Request bank release; confirmation is callback-only. */
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
  requestRelease(
    @Param('id') id: string,
    @Body() command: ExecuteDealCommandDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settlementEngine.requestRelease(id, command, user);
  }

  /** Retained as a fail-closed compatibility endpoint. */
  @Post('deal/:id/confirm')
  @RateLimit({
    name: 'money_legacy_confirm',
    scope: 'user',
    limit: 6,
    windowSeconds: 60,
    includeParams: ['id'],
  })
  confirm() {
    return this.settlementEngine.confirmWorksheet();
  }

  @Post('deal/:id/adjust')
  @RateLimit({
    name: 'money_adjust',
    scope: 'user',
    limit: 10,
    windowSeconds: 60,
    includeParams: ['id'],
  })
  adjust(
    @Param('id') id: string,
    @Body() body: { adjustments: unknown[] },
    @CurrentUser() user: RequestUser,
  ) {
    return this.settlementEngine.adjustWorksheet(id, body.adjustments, user);
  }

  @Post('import-bank-statement')
  @RateLimit({
    name: 'bank_statement_import',
    scope: 'user',
    limit: 5,
    windowSeconds: 300,
  })
  importBankStatement(
    @Body() body: { content: string; format: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.settlementEngine.importBankStatement(body.content, body.format, user);
  }

  @Post('bank-keys/:keyId/revoke')
  @Roles('ADMIN')
  @UseGuards(RequiresMfaGuard)
  @RateLimit({ name: 'bank_key_revoke', scope: 'user', limit: 5, windowSeconds: 60 })
  async revokeBankKey(
    @Param('keyId') keyId: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: RequestUser,
  ) {
    const reason = String(body?.reason ?? '').trim();
    if (reason.length < 5) {
      throw new BadRequestException('Причина отзыва ключа обязательна.');
    }
    const result = await this.bankKeys.revoke(keyId, user.id, reason);
    await this.integrationEvents.log({
      adapterName: 'bank-callback',
      direction: 'OUTBOUND',
      eventType: 'KEY_REVOKED',
      externalId: keyId,
      status: 'SUCCESS',
      requestPayload: { keyId, reason, revokedByUserId: user.id },
    });
    return result;
  }

  /**
   * The only bank confirmation path. The signed callback is always routed to
   * the canonical PostgreSQL command gateway; no runtime fallback exists.
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
    const timestamp = Number(timestampHeader);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      !Number.isInteger(timestamp)
      || Math.abs(nowSeconds - timestamp) > BANK_CALLBACK_TOLERANCE_SECONDS
    ) {
      throw new UnauthorizedException('Expired or invalid bank callback timestamp');
    }

    const bodyEventId = typeof body.eventId === 'string' ? body.eventId : '';
    if (!eventIdHeader || eventIdHeader !== bodyEventId) {
      throw new UnauthorizedException('Bank callback event ID mismatch');
    }
    if (!partnerIdHeader || !keyIdHeader) {
      throw new UnauthorizedException('Bank partner and signing key headers are required');
    }

    let signingSecret: string;
    try {
      const key = await this.bankKeys.resolveActiveKey(partnerIdHeader, keyIdHeader);
      signingSecret = key.secret;
    } catch (error) {
      if (error instanceof BankKeyError) {
        await this.integrationEvents.log({
          adapterName: 'bank-callback',
          direction: 'INBOUND',
          eventType: `KEY_REJECTED:${error.rejection}`,
          externalId: eventIdHeader,
          status: 'ERROR',
          errorMessage: `partner=${partnerIdHeader} keyId=${keyIdHeader} rejection=${error.rejection}`,
        });
      }
      throw error;
    }

    const signedPayload = buildBankSignaturePayload({
      partnerId: partnerIdHeader,
      keyId: keyIdHeader,
      timestamp,
      eventId: eventIdHeader,
      body,
    });
    const expected = `hmac-sha256=${crypto
      .createHmac('sha256', signingSecret)
      .update(signedPayload)
      .digest('hex')}`;
    if (!secureSignatureMatch(signature, expected)) {
      throw new UnauthorizedException('Invalid bank signature');
    }

    const dealId = String(body.dealId ?? '');
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
      dealId,
      operationId,
      partnerId: partnerIdHeader,
    });
  }
}
