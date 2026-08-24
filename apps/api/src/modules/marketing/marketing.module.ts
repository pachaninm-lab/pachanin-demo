import { Module } from '@nestjs/common';
import { MarketingPolicyService } from './marketing-policy.service';
import { MarketingPublisherService } from './marketing-publisher.service';
import { TelegramPublisher } from './connectors/telegram.publisher';
import { VkPublisher } from './connectors/vk.publisher';

@Module({
  providers: [MarketingPolicyService, MarketingPublisherService, TelegramPublisher, VkPublisher],
  exports: [MarketingPolicyService, MarketingPublisherService],
})
export class MarketingModule {}
