import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { BadRequestException, Headers, HttpCode, UnauthorizedException, UseGuards } from '@nestjs/common';
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
import { isIndustrialMode } from '../../common/config/industrial-mode';

const BANK_HMAC_SECRET = requireSecret('BANK_HMAC_SECRET');
const BANK_CALLBACK_TOLERANCE_SECONDS = 300;
const BANK_CALLBACK_PATH = '/api/settlement-engine/bank-callback';
const EXPECTED_BANK_PARTNER_ID = process.env.BANK_PARTNER_ID || 'safe-deals';
const EXPECTED_BANK_KEY_ID = process.env.BANK_HMAC_KEY_ID || 'primary';

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
  const bodyHash = crypto.createHash('sha256').update(canonicalizeBankPayload(input.body)).digest('hex');
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
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

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

  /** Request bank release — creates outbox entry, does NOT self-release. */
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

  /** Legacy manual confirmation. Demo profile only — never a bank substitute. */
  @Post('deal/:id/confirm')
  @RateLimit({ name: 'money_legacy_confirm', scope: 'user', limit: 6, windowSeconds: 60, includeParams: ['id'] })
  async confirm(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    // Industrial mode: the platform can never self-confirm money for any deal.
    // Reserve/release state changes arrive exclusively through the verified
    // bank callback below.
    if (isIndustrialMode() || id === CANONICAL_TEST_DEAL_ID) {
      throw new UnauthorizedException('Money state can only be confirmed by a verified bank callback.');
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
  @RateLimit({ name: 'bank_statement_import', scope: 'user', limit: 5, windowSeconds: 300 })
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
   * - X-Bank-Partner-Id: configured partner identity;
   * - X-Bank-Key-Id: configured signing-key version;
   * - X-Bank-Event-Id: globally unique event identifier;
   * - X-Bank-Timestamp: Unix seconds, accepted within ±5 minutes;
   * - X-Bank-Signature: hmac-sha256=<hex> over buildBankSignaturePayload(...).
   *
   * Required body for the canonical deal:
   * { dealId, eventId, operation, operationId, status, bankRef }
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
    if (!Number.isInteger(timestamp) || Math.abs(nowSeconds - timestamp) > BANK_CALLBACK_TOLERANCE_SECONDS) {
      throw new UnauthorizedException('Expired or invalid bank callback timestamp');
    }

    const bodyEventId = typeof body.eventId === 'string' ? body.eventId : '';
    if (!eventIdHeader || eventIdHeader !== bodyEventId) {
      throw new UnauthorizedException('Bank callback event ID mismatch');
    }
    if (partnerIdHeader !== EXPECTED_BANK_PARTNER_ID || keyIdHeader !== EXPECTED_BANK_KEY_ID) {
      throw new UnauthorizedException('Unknown bank partner or signing key');
    }

    const signedPayload = buildBankSignaturePayload({
      partnerId: partnerIdHeader,
      keyId: keyIdHeader,
      timestamp,
      eventId: eventIdHeader,
      body,
    });
    const expected = `hmac-sha256=${crypto.createHmac('sha256', BANK_HMAC_SECRET).update(signedPayload).digest('hex')}`;
    if (!secureSignatureMatch(signature, expected)) {
      throw new UnauthorizedException('Invalid bank signature');
    }

    if (isIndustrialMode() || body.dealId === CANONICAL_TEST_DEAL_ID) {
      // Industrial mode: every verified bank callback is executed through the
      // canonical PostgreSQL command path — idempotent, hash-chained, atomic.
      // There is no runtime fallback: an unknown deal fails without any money effect.
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

    return this.settlementEngine.registerSafeDealsCallback(body);
  }
}
