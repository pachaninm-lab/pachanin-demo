import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  type ClaimedOutboxEntry,
  DurableOutboxWorker,
} from '../integration-events/durable-outbox.worker';
import {
  MARKETING_SOCIAL_PUBLISH_EVENT_TYPE,
  assertMarketingSocialPublishPayload,
} from './marketing-outbox.contract';
import { MarketingPublisherService } from './marketing-publisher.service';

@Injectable()
export class MarketingOutboxDispatchHandler implements OnModuleInit {
  constructor(
    private readonly worker: DurableOutboxWorker,
    private readonly publisher: MarketingPublisherService,
  ) {}

  onModuleInit(): void {
    this.worker.registerHandler(
      MARKETING_SOCIAL_PUBLISH_EVENT_TYPE,
      (entry) => this.dispatch(entry),
    );
  }

  async dispatch(entry: ClaimedOutboxEntry): Promise<void> {
    if (entry.type !== MARKETING_SOCIAL_PUBLISH_EVENT_TYPE) {
      throw new Error('Marketing outbox handler received an unsupported event type');
    }

    const request = assertMarketingSocialPublishPayload(entry.payload, entry.idempotencyKey);
    await this.publisher.publish(request);
  }
}
