import { Module } from '@nestjs/common';
import { MarketingPolicyService } from './marketing-policy.service';
import { MarketingPublisherService } from './marketing-publisher.service';
import { TelegramPublisher } from './connectors/telegram.publisher';

@Module({
  providers: [MarketingPolicyService, MarketingPublisherService, TelegramPublisher],
  exports: [MarketingPolicyService, MarketingPublisherService],
})
export class MarketingModule {}
