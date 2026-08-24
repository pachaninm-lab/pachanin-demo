import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MarketingPolicyService } from './marketing-policy.service';
import type {
  MarketingChannel,
  MarketingPublishReceipt,
  MarketingPublishRequest,
} from './marketing.types';
import { TelegramPublisher } from './connectors/telegram.publisher';

@Injectable()
export class MarketingPublisherService {
  constructor(
    private readonly policy: MarketingPolicyService,
    private readonly telegram: TelegramPublisher,
  ) {}

  async publish(request: MarketingPublishRequest): Promise<MarketingPublishReceipt> {
    const decision = this.policy.assertAllowed({
      ...request.policy,
      channel: request.channel,
      text: request.text,
    });

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

    // VK/Dzen/Rutube/OK are intentionally allowlisted at the policy layer but
    // remain fail-closed until their official connector path has been verified
    // and implemented. This prevents a false "supported" state.
    throw new ServiceUnavailableException(
      `Marketing connector ${channel} is allowlisted but not production-wired. policy=${decision.code}`,
    );
  }
}
