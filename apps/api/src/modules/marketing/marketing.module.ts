import { Module } from '@nestjs/common';
import { OutboxModule } from '../../common/outbox/outbox.module';
import { MarketingPolicyService } from './marketing-policy.service';
import { MarketingPublisherService } from './marketing-publisher.service';
import { MarketingOutboxService } from './marketing-outbox.service';
import { MarketingPublicationAdmissionService } from './marketing-publication-admission';
import { TelegramPublisher } from './connectors/telegram.publisher';
import { VkPublisher } from './connectors/vk.publisher';

@Module({
  imports: [OutboxModule],
  providers: [
    MarketingPolicyService,
    MarketingPublisherService,
    MarketingOutboxService,
    MarketingPublicationAdmissionService,
    TelegramPublisher,
    VkPublisher,
  ],
  exports: [
    MarketingPolicyService,
    MarketingPublisherService,
    MarketingOutboxService,
    MarketingPublicationAdmissionService,
  ],
})
export class MarketingModule {}
