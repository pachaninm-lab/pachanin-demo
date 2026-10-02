import { Injectable } from '@nestjs/common';
import type { ClaimedOutboxEntry } from '../integration-events/durable-outbox.worker';
import {
  MARKETING_SOCIAL_PUBLISH_EVENT_TYPE,
  assertMarketingSocialPublishPayload,
} from './marketing-outbox.contract';
import { MarketingPublisherService } from './marketing-publisher.service';

@Injectable()
export class MarketingOutboxDispatchHandler {
  constructor(private readonly publisher: MarketingPublisherService) {}

  async dispatch(entry: ClaimedOutboxEntry): Promise<void> {
    if (entry.type !== MARKETING_SOCIAL_PUBLISH_EVENT_TYPE) {
      throw new Error('Marketing outbox handler received an unsupported event type');
    }

    const admission = assertMarketingSocialPublishPayload(entry.payload);
    await this.publisher.publish(admission, entry.idempotencyKey);
  }
}
