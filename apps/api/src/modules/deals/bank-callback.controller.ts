import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Public } from '../../common/decorators/public.decorator';
import { requireSecret } from '../../common/config/secrets';
import {
  IndustrialDealCommandGateway,
  VerifiedBankCallbackInput,
} from './industrial-deal-command.gateway';

/**
 * Входящий банковский callback (CANONICAL_SCENARIO.md §5, seam банка РСХБ).
 *
 * Банк — криптографически подтверждённый системный актор, а не пользователь
 * tenant'а. Он подтверждает две денежные операции сделки:
 *   • RESERVE  — резерв оплаты (шаг confirm_reserve),
 *   • RELEASE  — выплата продавцу (шаг confirm_release).
 *
 * Подпись и защита от повторов идентичны входящему ЭДО-вебхуку:
 *   X-Signature:  sha256=<hex>  — HMAC-SHA256 над `${timestamp}.${body}`
 *   X-Timestamp:  unix-секунды  — окно свежести против replay
 *   X-Event-Id:   уникальный ID события банка (идемпотентность)
 *   X-Bank-Partner: идентификатор партнёра (по умолчанию rshb-sandbox)
 *
 * Тело:
 *   { dealId, operation: 'RESERVE'|'RELEASE', status: 'SUCCESS'|'FAILED',
 *     bankRef, operationId?, errorMessage? }
 *
 * Fail-closed: без валидной подписи — 401; тело/операция вне схемы — 400.
 * Денежный эффект возможен только если платформа сама выпустила эту банковскую
 * операцию для сделки (проверяется SECURITY DEFINER-связкой внутри шлюза).
 */

const BANK_WEBHOOK_SECRET = requireSecret('BANK_WEBHOOK_SECRET');
const TIMESTAMP_TOLERANCE_SEC = 300; // 5 минут
const OPERATIONS = new Set<VerifiedBankCallbackInput['operation']>(['RESERVE', 'RELEASE']);
const STATUSES = new Set<VerifiedBankCallbackInput['status']>(['SUCCESS', 'FAILED']);
const DEFAULT_PARTNER = 'rshb-sandbox';

@Public()
@Controller('webhooks')
export class BankCallbackController {
  private readonly logger = new Logger(BankCallbackController.name);
  private readonly processedEventIds = new Map<string, number>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(private readonly gateway: IndustrialDealCommandGateway) {
    // Чистим старые eventId (> 24ч), чтобы карта не росла безгранично.
    this.cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - 86_400_000;
      for (const [id, ts] of this.processedEventIds.entries()) {
        if (ts < cutoff) this.processedEventIds.delete(id);
      }
    }, 3_600_000);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  @Post('bank')
  @HttpCode(200)
  async bankCallback(
    @Body() body: Record<string, unknown>,
    @Headers('x-signature') sig: string | undefined,
    @Headers('x-timestamp') xTimestamp: string | undefined,
    @Headers('x-event-id') eventIdHeader: string | undefined,
    @Headers('x-bank-partner') partnerHeader: string | undefined,
  ) {
    const bodyStr = JSON.stringify(body ?? {});
    this.verifySignature(sig, xTimestamp, bodyStr);
    this.verifyTimestamp(xTimestamp);

    const input = this.parseCallback(body, eventIdHeader, partnerHeader);

    // Идемпотентность на входе — первая линия. Шлюз идемпотентен по eventId
    // повторно (defense-in-depth): повтор с тем же материалом безопасен.
    const idemKey = `bank:${input.partnerId}:${input.eventId}`;
    if (this.processedEventIds.has(idemKey)) {
      this.logger.warn(`Повторный банковский callback пропущен: ${idemKey}`);
      return { status: 'already_processed', eventId: input.eventId };
    }

    this.logger.log(
      `Банковский callback: partner=${input.partnerId} deal=${input.dealId} ` +
        `op=${input.operation} status=${input.status} ref=${input.bankRef}`,
    );

    const result = await this.gateway.executeBankCallback(input);
    this.processedEventIds.set(idemKey, Date.now());

    return {
      status: 'accepted',
      eventId: input.eventId,
      dealId: input.dealId,
      operation: input.operation,
      bankStatus: input.status,
      processedAt: new Date().toISOString(),
      result,
    };
  }

  private parseCallback(
    body: Record<string, unknown>,
    eventIdHeader: string | undefined,
    partnerHeader: string | undefined,
  ): VerifiedBankCallbackInput {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Пустое или некорректное тело банковского callback.');
    }
    const dealId = this.requireString(body['dealId'], 'dealId');
    const operation = String(body['operation'] ?? '').toUpperCase();
    if (!OPERATIONS.has(operation as VerifiedBankCallbackInput['operation'])) {
      throw new BadRequestException(`operation должен быть RESERVE или RELEASE (получено: ${operation || '—'}).`);
    }
    const status = String(body['status'] ?? '').toUpperCase();
    if (!STATUSES.has(status as VerifiedBankCallbackInput['status'])) {
      throw new BadRequestException(`status должен быть SUCCESS или FAILED (получено: ${status || '—'}).`);
    }
    const bankRef = this.requireString(body['bankRef'], 'bankRef');
    const eventId = String(body['eventId'] ?? eventIdHeader ?? '').trim();
    if (!eventId) {
      throw new BadRequestException('Требуется eventId (в теле или заголовке X-Event-Id).');
    }
    const operationId =
      body['operationId'] != null ? String(body['operationId']).trim() || undefined : undefined;
    const errorMessage =
      body['errorMessage'] != null ? String(body['errorMessage']).slice(0, 500) : undefined;
    const partnerId = String(partnerHeader ?? body['partnerId'] ?? DEFAULT_PARTNER).trim() || DEFAULT_PARTNER;

    return {
      dealId,
      eventId,
      operation: operation as VerifiedBankCallbackInput['operation'],
      status: status as VerifiedBankCallbackInput['status'],
      bankRef,
      operationId,
      errorMessage,
      partnerId,
    };
  }

  private requireString(value: unknown, field: string): string {
    const str = value == null ? '' : String(value).trim();
    if (!str) throw new BadRequestException(`Требуется поле ${field}.`);
    return str;
  }

  private verifySignature(
    sig: string | undefined,
    xTimestamp: string | undefined,
    bodyStr: string,
  ): void {
    if (!sig) throw new UnauthorizedException('Отсутствует заголовок X-Signature.');
    const payload = xTimestamp ? `${xTimestamp}.${bodyStr}` : bodyStr;
    const expected =
      'sha256=' + crypto.createHmac('sha256', BANK_WEBHOOK_SECRET).update(payload).digest('hex');
    if (sig.length !== expected.length) throw new UnauthorizedException('Неверная подпись банковского callback.');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      throw new UnauthorizedException('Неверная подпись банковского callback.');
    }
  }

  private verifyTimestamp(xTimestamp: string | undefined): void {
    if (!xTimestamp) {
      throw new UnauthorizedException('Отсутствует заголовок X-Timestamp — защита от повторов обязательна для банка.');
    }
    const ts = Number(xTimestamp);
    if (Number.isNaN(ts)) throw new BadRequestException('Некорректный заголовок X-Timestamp.');
    const ageSec = Math.abs(Date.now() / 1000 - ts);
    if (ageSec > TIMESTAMP_TOLERANCE_SEC) {
      throw new UnauthorizedException(
        `Обнаружен повтор: метка времени старше ${Math.round(ageSec)}с (максимум ${TIMESTAMP_TOLERANCE_SEC}с).`,
      );
    }
  }
}
