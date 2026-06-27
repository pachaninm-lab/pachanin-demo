import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PartnerApiService } from './partner-api.service';

export interface WebhookPayload {
  eventType: string;
  dealId?: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface DeliveryResult {
  subscriptionId: string;
  url: string;
  status: 'delivered' | 'failed';
  httpStatus?: number;
  error?: string;
}

@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);

  constructor(private readonly partnerApi: PartnerApiService) {}

  async dispatch(eventType: string, data: Record<string, unknown>): Promise<DeliveryResult[]> {
    const subscriptions = this.partnerApi.getActiveSubscriptionsForEvent(eventType);
    const results: DeliveryResult[] = [];

    for (const sub of subscriptions) {
      const payload: WebhookPayload = {
        eventType,
        dealId: data.dealId as string | undefined,
        timestamp: new Date().toISOString(),
        data,
      };

      const result = await this.deliverOne(sub.id, sub.url, sub.secret, payload);
      results.push(result);
    }

    return results;
  }

  private async deliverOne(
    subscriptionId: string,
    url: string,
    secret: string,
    payload: WebhookPayload,
  ): Promise<DeliveryResult> {
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sig = this.sign(secret, timestamp, body);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GrainFlow-Signature': `sha256=${sig}`,
          'X-GrainFlow-Timestamp': timestamp,
          'X-GrainFlow-Event': payload.eventType,
          'User-Agent': 'GrainFlow-Webhook/3.0',
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      const ok = response.ok;
      this.logger.log(`Webhook delivered: sub=${subscriptionId} url=${url} status=${response.status} ok=${ok}`);
      return { subscriptionId, url, status: ok ? 'delivered' : 'failed', httpStatus: response.status };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Webhook delivery failed: sub=${subscriptionId} url=${url} error=${message}`);
      return { subscriptionId, url, status: 'failed', error: message };
    }
  }

  sign(secret: string, timestamp: string, body: string): string {
    return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  }

  verifyIncoming(secret: string, sig: string, timestamp: string, body: string): boolean {
    const maxAgeSeconds = 300;
    const age = Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp, 10));
    if (age > maxAgeSeconds) return false;

    const expected = this.sign(secret, timestamp, body);
    try {
      return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  }
}
