import { Module } from '@nestjs/common';
import { OutboxPrismaModule } from './common/prisma/outbox-prisma.module';
import { MarketingDurableOutboxWorker } from './modules/marketing/marketing-durable-outbox.worker';
import { MarketingOutboxDispatchHandler } from './modules/marketing/marketing-outbox-dispatch.handler';
import { MarketingOutboxRunner } from './modules/marketing/marketing-outbox.runner';
import { MarketingPolicyService } from './modules/marketing/marketing-policy.service';
import { MarketingPublisherService } from './modules/marketing/marketing-publisher.service';
import { TelegramPublisher } from './modules/marketing/connectors/telegram.publisher';
import { VkPublisher } from './modules/marketing/connectors/vk.publisher';

/**
 * Dedicated process graph for social delivery.
 *
 * It imports only the outbox-scoped database principal plus marketing policy and
 * connector code. No AppModule, auth, tenants, deals, documents, staff, FGIS or
 * other private/business modules are reachable from this worker topology.
 */
@Module({
  imports: [OutboxPrismaModule],
  providers: [
    MarketingDurableOutboxWorker,
    MarketingPolicyService,
    TelegramPublisher,
    VkPublisher,
    MarketingPublisherService,
    MarketingOutboxDispatchHandler,
    MarketingOutboxRunner,
  ],
})
export class MarketingOutboxWorkerModule {}
