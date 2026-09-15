import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MarketingPolicyService } from './marketing-policy.service';
import {
  MarketingPublicationAdmissionService,
  type MarketingPublicationAdmission,
} from './marketing-publication-admission';
import type {
  MarketingChannel,
  MarketingPublishReceipt,
} from './marketing.types';
import { TelegramPublisher } from './connectors/telegram.publisher';
import { VkPublisher } from './connectors/vk.publisher';

@Injectable()
export class MarketingPublisherService {
  constructor(
    private readonly policy: MarketingPolicyService,
    private readonly admission: MarketingPublicationAdmissionService,
    private readonly telegram: TelegramPublisher,
    private readonly vk: VkPublisher,
  ) {}

  async publish(
    admitted: MarketingPublicationAdmission,
    outboxIdempotencyKey: string | null,
  ): Promise<MarketingPublishReceipt> {
    // Re-verify after PostgreSQL serialization and bind the envelope to the
    // exact durable row before a connector can be selected.
    const request = this.admission.verify(admitted, outboxIdempotencyKey);
    const decision = this.policy.assertAllowed({
      ...request.policy,
      channel: request.channel,
      text: request.text,
    });

    const idempotencyKey = request.idempotencyKey.trim();
    if (!idempotencyKey) {
      throw new ServiceUnavailableException('Marketing idempotency key is required.');
    }

    const channel = request.channel as MarketingChannel;
    if (channel === 'TELEGRAM') {
      const receipt = await this.telegram.publish(request.text);
      return Object.freeze({
        channel,
        externalId: receipt.externalId,
        publishedAt: new Date().toISOString(),
      });
    }

    if (channel === 'VK') {
      const receipt = await this.vk.publish(
        request.text,
        idempotencyKey,
        request.policy.classification === 'ADVERTISING',
      );
      return Object.freeze({
        channel,
        externalId: receipt.externalId,
        publishedAt: new Date().toISOString(),
      });
    }

    throw new ServiceUnavailableException(
      `Marketing connector ${channel} is allowlisted but not production-wired. policy=${decision.code}`,
    );
  }
}
