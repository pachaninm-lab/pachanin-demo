import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MarketingPolicyService } from './marketing-policy.service';
import type {
  MarketingChannel,
  MarketingPublishReceipt,
  MarketingPublishRequest,
} from './marketing.types';
import { TelegramPublisher } from './connectors/telegram.publisher';
import { VkPublisher } from './connectors/vk.publisher';

@Injectable()
export class MarketingPublisherService {
  constructor(
    private readonly policy: MarketingPolicyService,
    private readonly telegram: TelegramPublisher,
    private readonly vk: VkPublisher,
  ) {}

  async publish(request: MarketingPublishRequest): Promise<MarketingPublishReceipt> {
    const decision = this.policy.assertAllowed({
      ...request.policy,
      channel: request.channel,
      text: request.text,
    });

    const idempotencyKey = request.idempotencyKey.trim();
    if (!idempotencyKey) {
      throw new ServiceUnavailableException('Marketing idempotency key is required.');
    }

    // Keep this assignment after the policy gate: arbitrary channel strings can
    // never reach a connector merely by being cast to MarketingChannel.
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

    // Dzen/Rutube/OK remain fail-closed until their official connector path is
    // verified and implemented. Being allowlisted is not the same as being wired.
    throw new ServiceUnavailableException(
      `Marketing connector ${channel} is allowlisted but not production-wired. policy=${decision.code}`,
    );
  }
}
