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
  FGIS_LEGACY_ERROR_CODES,
  denyRetiredLegacyFgisRoute,
} from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine';
import { FgisLegacyQuarantineAuditService } from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine.audit';

/**
 * Incoming ЭДО webhook endpoint per ТЗ 10.4.
 * Verifies HMAC-SHA256 + timestamp replay-protection + in-memory idempotency.
 *
 * Expected headers:
 *   X-Signature:  sha256=<hex>
 *   X-Timestamp:  unix seconds
 *   X-Event-Id:   unique event ID
 *
 * Signature is computed over: `${timestamp}.${rawBody}`
 */

const EDO_WEBHOOK_SECRET = requireSecret('EDO_WEBHOOK_SECRET');
const TIMESTAMP_TOLERANCE_SEC = 300; // 5 minutes

@Public()
@Controller('api/webhooks')
export class EdoWebhookController {
  private readonly logger = new Logger(EdoWebhookController.name);
  private readonly processedEventIds = new Map<string, number>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(private readonly quarantineAudit: FgisLegacyQuarantineAuditService) {
    // Purge old event IDs older than 24h to prevent unbounded growth
    this.cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - 86_400_000;
      for (const [id, ts] of this.processedEventIds.entries()) {
        if (ts < cutoff) this.processedEventIds.delete(id);
      }
    }, 3_600_000);
  }

  @Post('edo')
  @HttpCode(200)
  async edoCallback(
    @Body() body: Record<string, unknown>,
    @Headers('x-signature') sig: string | undefined,
    @Headers('x-timestamp') xTimestamp: string | undefined,
    @Headers('x-event-id') eventId: string | undefined,
  ) {
    const bodyStr = JSON.stringify(body);
    this.verifySignature(sig, xTimestamp, bodyStr);
    this.verifyTimestamp(xTimestamp);
    const idempotent = this.checkIdempotency(eventId);
    if (idempotent) return { status: 'already_processed', eventId };

    const eventType = String(body['eventType'] ?? 'unknown');
    const externalId = String(body['externalId'] ?? '');
    const dealId = body['dealId'] ? String(body['dealId']) : undefined;

    this.logger.log(`EDO webhook received: eventType=${eventType} externalId=${externalId} dealId=${dealId ?? '-'}`);
    this.processEdoEvent(eventType, body);

    return { status: 'accepted', eventType, eventId: eventId ?? null, processedAt: new Date().toISOString() };
  }

  /**
   * Retired in P0.2-1A.
   *
   * This route treated an unsigned-by-ФГИС JSON body as a provider response.
   * Three separate defects made it unusable as regulatory evidence:
   *   - the official contract defines no JSON callback at all, only signed SOAP
   *     `SendResponse` accepted through the canonical regulatory inbox;
   *   - it fell back to the ЭДО secret when `FGIS_WEBHOOK_SECRET` was unset, so
   *     an ЭДО-scoped secret could sign a ФГИС «Зерно» message;
   *   - `X-Timestamp` was optional and idempotency lived in process memory, so
   *     a replay survived a restart and after a second instance was added.
   *
   * Nothing is read from the request: the route is withdrawn, so there is no
   * body to authenticate and no event to deduplicate.
   */
  @Post('fgis')
  fgisCallback(): Promise<never> {
    return denyRetiredLegacyFgisRoute({
      code: FGIS_LEGACY_ERROR_CODES.WEBHOOK_RETIRED,
      message:
        'JSON-webhook ФГИС «Зерно» отключён. Официальный ответ оператора ' +
        'принимается только как подписанный SOAP через регуляторный inbox.',
      nextStep:
        'Настройте канонический обмен ФГИС «Зерно» (SendRequest/SendResponse/Ack).',
      route: 'POST /api/webhooks/fgis',
      // Anonymous by design: the route is public and the body is never read.
      actor: null,
      audit: this.quarantineAudit,
    });
  }

  private verifySignature(
    sig: string | undefined,
    xTimestamp: string | undefined,
    bodyStr: string,
  ): void {
    if (!sig) throw new UnauthorizedException('Missing X-Signature header');
    const payload = xTimestamp ? `${xTimestamp}.${bodyStr}` : bodyStr;
    const expected = 'sha256=' + crypto.createHmac('sha256', EDO_WEBHOOK_SECRET).update(payload).digest('hex');
    if (sig.length !== expected.length) throw new UnauthorizedException('Invalid webhook signature');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  private verifyTimestamp(xTimestamp: string | undefined): void {
    if (!xTimestamp) return; // timestamp is optional in degraded mode
    const ts = Number(xTimestamp);
    if (isNaN(ts)) throw new BadRequestException('Invalid X-Timestamp header');
    const ageSec = Math.abs(Date.now() / 1000 - ts);
    if (ageSec > TIMESTAMP_TOLERANCE_SEC) {
      throw new UnauthorizedException(`Webhook replay detected: timestamp is ${Math.round(ageSec)}s old (max ${TIMESTAMP_TOLERANCE_SEC}s)`);
    }
  }

  private checkIdempotency(eventId: string | undefined, prefix = 'edo'): boolean {
    if (!eventId) return false;
    const key = `${prefix}:${eventId}`;
    if (this.processedEventIds.has(key)) {
      this.logger.warn(`Duplicate webhook event skipped: ${key}`);
      return true;
    }
    this.processedEventIds.set(key, Date.now());
    return false;
  }

  private processEdoEvent(eventType: string, body: Record<string, unknown>): void {
    // Route to the appropriate handler based on EDO event type
    switch (eventType) {
      case 'document.delivered':
      case 'document.signed':
      case 'document.rejected':
      case 'document.sent':
        this.logger.log(`EDO status update: type=${eventType} docId=${body['externalId']}`);
        // In production: update DealDocument status, send notification via NotificationsService
        break;
      case 'upd.received':
        this.logger.log(`УПД received from EDO: docId=${body['externalId']} dealId=${body['dealId']}`);
        // In production: auto-match УПД to deal by INN + amount + date
        break;
      default:
        this.logger.warn(`Unhandled EDO event type: ${eventType}`);
    }
  }
}
