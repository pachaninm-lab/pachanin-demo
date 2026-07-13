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
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import { IntegrationEventsService } from '../integration-events/integration-events.service';
import { BankKeyError, BankKeyRegistryService } from './bank-key-registry.service';
import {
  type SettlementCommandEnvelope,
  SettlementEngineService,
  type SettlementRefundRequest,
  type SettlementReleaseRequest,
} from './settlement-engine.service';
import { SettlementFinancialMfaGuard } from './settlement-financial-mfa.guard';
import type {
  ConfigureSettlementTermsInput,
  PlaceSettlementHoldInput,
  ReconcileSettlementOperationInput,
  ReleaseSettlementHoldInput,
  SettlementOperationType,
} from './settlement-postgresql.repository';

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

/**
 * Retained only as an input validator for clients compiled against the previous
 * helper. Settlement operation ids are generated per PostgreSQL request and
 * must be returned by that request; they are never derived from a deal id.
 */
export function expectedBankOperationId(_dealId: string, operation: unknown): string {
  if (!['RESERVE', 'RELEASE', 'REFUND'].includes(String(operation ?? '').toUpperCase())) {
    throw new BadRequestException('Unsupported bank operation');
  }
  throw new BadRequestException({
    code: 'BANK_OPERATION_ID_MUST_COME_FROM_REQUEST_RECEIPT',
  });
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
@Roles('BUYER', 'ACCOUNTING', 'SUPPORT_MANAGER', 'ADMIN', 'EXECUTIVE', 'ARBITRATOR')
@Controller('settlement-engine')
export class SettlementEngineController {
  constructor(
    private readonly settlementEngine: SettlementEngineService,
    private readonly bankKeys: BankKeyRegistryService,
    private readonly integrationEvents: IntegrationEventsService,
  ) {}

  @Get('deal/:id')
  worksheet(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.settlementEngine.getWorksheet(id, user);
  }

  @Get('deal/:id/bank-workspace')
  bankWorkspace(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.settlementEngine.getBankWorkspace(id, user);
  }

  @Get('payments')
  payments(@CurrentUser() user: RequestUser) {
    return this.settlementEngine.listPayments(user);
  }

  @Get('payments/:id')
  paymentDetail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.settlementEngine.getPayment(id, user);
  }

  @Get('outbox')
  outbox(
    @Query('dealId') dealId: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settlementEngine.getOutboxStatus(dealId, user);
  }

  @Post('deal/:id/terms')
  @Roles('BUYER', 'ACCOUNTING', 'SUPPORT_MANAGER', 'ADMIN')
  @UseGuards(SettlementFinancialMfaGuard)
  @RateLimit({ name: 'settlement_terms', scope: 'org', limit: 6, windowSeconds: 60, includeParams: ['id'] })
  configureTerms(
    @Param('id') id: string,
    @Body() body: Omit<ConfigureSettlementTermsInput, 'dealId'>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settlementEngine.configureTerms({ ...body, dealId: id }, user);
  }

  /** Creates a durable reserve request and PENDING outbox. It cannot confirm money. */
  @Post('deal/:id/reserve')
  @Roles('BUYER', 'ACCOUNTING', 'SUPPORT_MANAGER', 'ADMIN')
  @UseGuards(SettlementFinancialMfaGuard)
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
    @Body() body: SettlementCommandEnvelope,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settlementEngine.requestReserve(id, user, body ?? {});
  }

  /** Creates a partial/full beneficiary payout request. Bank callback remains authoritative. */
  @Post('deal/:id/release')
  @Roles('ACCOUNTING', 'SUPPORT_MANAGER', 'ADMIN')
  @UseGuards(SettlementFinancialMfaGuard)
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
    @Body() body: SettlementReleaseRequest,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settlementEngine.requestRelease(id, user, body ?? {});
  }

  @Post('deal/:id/refund')
  @Roles('ACCOUNTING', 'SUPPORT_MANAGER', 'ADMIN')
  @UseGuards(SettlementFinancialMfaGuard)
  @RateLimit({ name: 'money_refund_request', scope: 'org', limit: 6, windowSeconds: 60, includeParams: ['id'] })
  requestRefund(
    @Param('id') id: string,
    @Body() body: SettlementRefundRequest,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settlementEngine.requestRefund(id, user, body);
  }

  @Post('deal/:id/holds')
  @Roles('ACCOUNTING', 'SUPPORT_MANAGER', 'ADMIN', 'ARBITRATOR')
  @UseGuards(SettlementFinancialMfaGuard)
  @RateLimit({ name: 'money_hold', scope: 'org', limit: 10, windowSeconds: 60, includeParams: ['id'] })
  placeHold(
    @Param('id') id: string,
    @Body() body: Omit<PlaceSettlementHoldInput, 'dealId'>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settlementEngine.placeHold({ ...body, dealId: id }, user);
  }

  @Post('deal/:id/holds/:holdId/release')
  @Roles('ACCOUNTING', 'SUPPORT_MANAGER', 'ADMIN')
  @UseGuards(SettlementFinancialMfaGuard)
  @RateLimit({ name: 'money_hold_release', scope: 'org', limit: 10, windowSeconds: 60, includeParams: ['id', 'holdId'] })
  releaseHold(
    @Param('id') id: string,
    @Param('holdId') holdId: string,
    @Body() body: Omit<ReleaseSettlementHoldInput, 'dealId' | 'holdId'>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settlementEngine.releaseHold({ ...body, dealId: id, holdId }, user);
  }

  @Post('deal/:id/reconciliation')
  @Roles('ACCOUNTING', 'SUPPORT_MANAGER', 'ADMIN')
  @UseGuards(SettlementFinancialMfaGuard)
  @RateLimit({ name: 'settlement_reconciliation', scope: 'org', limit: 20, windowSeconds: 60, includeParams: ['id'] })
  reconcile(
    @Param('id') id: string,
    @Body() body: Omit<ReconcileSettlementOperationInput, 'dealId'>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settlementEngine.reconcileOperation({ ...body, dealId: id }, user);
  }

  @Post('bank-keys/:keyId/revoke')
  @Roles('ADMIN')
  @UseGuards(SettlementFinancialMfaGuard)
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
   * The only money-confirmation path. Signature verification binds partner,
   * key version, event id and the exact canonical body fingerprint before the
   * PostgreSQL callback transaction starts.
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

    const dealId = typeof body.dealId === 'string' ? body.dealId : '';
    const operationId = typeof body.operationId === 'string' ? body.operationId : '';
    const operation = String(body.operation ?? '').toUpperCase() as SettlementOperationType;
    const status = String(body.status ?? '').toUpperCase();
    const bankRef = typeof body.bankRef === 'string' ? body.bankRef : '';
    if (!dealId || !operationId || !bankRef) {
      throw new BadRequestException({ code: 'BANK_CALLBACK_BINDING_REQUIRED' });
    }
    if (!['RESERVE', 'RELEASE', 'REFUND'].includes(operation)) {
      throw new BadRequestException({ code: 'UNSUPPORTED_BANK_OPERATION' });
    }
    if (!['SUCCESS', 'FAILED'].includes(status)) {
      throw new BadRequestException({ code: 'INVALID_BANK_CALLBACK_STATUS' });
    }

    const payloadFingerprint = crypto
      .createHash('sha256')
      .update(canonicalizeBankPayload(body))
      .digest('hex');
    const result = await this.settlementEngine.registerBankCallback({
      dealId,
      operationId,
      eventId: eventIdHeader,
      operation,
      status: status as 'SUCCESS' | 'FAILED',
      bankRef,
      partnerId: partnerIdHeader,
      keyId: keyIdHeader,
      payloadFingerprint,
      payload: body,
      errorMessage: typeof body.errorMessage === 'string' ? body.errorMessage : undefined,
    });

    await this.integrationEvents.log({
      adapterName: 'bank-callback',
      direction: 'INBOUND',
      eventType: `${operation}_${status}`,
      externalId: eventIdHeader,
      status: status === 'SUCCESS' ? 'SUCCESS' : 'ERROR',
      requestPayload: {
        partnerId: partnerIdHeader,
        keyId: keyIdHeader,
        operationId,
        payloadFingerprint,
      },
      responsePayload: result as Record<string, unknown>,
      errorMessage: status === 'FAILED' && typeof body.errorMessage === 'string'
        ? body.errorMessage
        : undefined,
    });
    return result;
  }
}
