import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { OutboxService, type OutboxEntry } from '../../common/outbox/outbox.service';
import { MarketingPolicyService } from './marketing-policy.service';
import {
  MARKETING_SOCIAL_PUBLISH_EVENT_TYPE,
  type MarketingSocialPublishPayload,
} from './marketing-outbox.contract';
import type { MarketingPublishRequest } from './marketing.types';

const MAX_IDEMPOTENCY_KEY_LENGTH = 200;

@Injectable()
export class MarketingOutboxService {
  constructor(
    private readonly outbox: OutboxService,
    private readonly policy: MarketingPolicyService,
  ) {}

  async enqueue(request: MarketingPublishRequest): Promise<OutboxEntry> {
    const idempotencyKey = request.idempotencyKey.trim();
    if (!idempotencyKey || idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new ServiceUnavailableException(
        `Marketing idempotency key must contain 1-${MAX_IDEMPOTENCY_KEY_LENGTH} characters.`,
      );
    }

    // Re-evaluated again by the worker at actual delivery time. This first gate
    // prevents knowingly non-compliant commands from entering durable delivery.
    this.policy.assertAllowed({
      ...request.policy,
      channel: request.channel,
      text: request.text,
    });

    const payload: MarketingSocialPublishPayload = {
      schemaVersion: 'marketing.social-publish.v1',
      channel: request.channel,
      text: request.text.trim(),
      policy: request.policy,
    };

    return this.outbox.enqueue({
      type: MARKETING_SOCIAL_PUBLISH_EVENT_TYPE,
      payload,
      idempotencyKey: `marketing:social-publish:v1:${idempotencyKey}`,
      correlationId: `marketing:${idempotencyKey}`,
      maxRetries: 6,
    });
  }
}
