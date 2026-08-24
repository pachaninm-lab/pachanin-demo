import { Module } from '@nestjs/common';
import { KafkaProducerService } from './common/kafka/kafka-producer.service';
import { OutboxPrismaModule } from './common/prisma/outbox-prisma.module';
import { DurableOutboxRunner } from './modules/integration-events/durable-outbox.runner';
import { DurableOutboxWorker } from './modules/integration-events/durable-outbox.worker';
import {
  FgisGrainCanonicalizationPort,
  FgisGrainImmutablePayloadStorePort,
  FgisGrainProviderConfigurationPort,
  FgisGrainSignedEnvelopeAssemblerPort,
  FgisGrainSigningProviderPort,
  FgisGrainSoapTransportPort,
} from './modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.dispatch.contract';
import {
  FailClosedFgisGrainCanonicalizationPort,
  FailClosedFgisGrainImmutablePayloadStorePort,
  FailClosedFgisGrainProviderConfigurationPort,
  FailClosedFgisGrainSignedEnvelopeAssemblerPort,
  FailClosedFgisGrainSigningProviderPort,
  FailClosedFgisGrainSoapTransportPort,
} from './modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.dispatch.fail-closed';
import { FgisGrainExchangeReceiptRepository } from './modules/regulatory-integration/fgis-grain/fgis-grain-exchange-receipt.repository';
import { FgisGrainOutboxDispatchHandler } from './modules/regulatory-integration/fgis-grain/fgis-grain-outbox-dispatch.handler';
import { MarketingPolicyService } from './modules/marketing/marketing-policy.service';
import { MarketingPublisherService } from './modules/marketing/marketing-publisher.service';
import { MarketingOutboxDispatchHandler } from './modules/marketing/marketing-outbox-dispatch.handler';
import { TelegramPublisher } from './modules/marketing/connectors/telegram.publisher';
import { VkPublisher } from './modules/marketing/connectors/vk.publisher';

/**
 * Minimal process graph for the durable outbox worker.
 *
 * It deliberately does not import AppModule, controllers, HTTP guards, auth,
 * settlement, documents or other business modules. PostgreSQL remains the only
 * queue authority and the worker can scale independently from the API process.
 * Its Prisma provider validates an outbox-only principal with no Deal access.
 *
 * FGIS and marketing delivery are registered as bounded type handlers on the
 * same durable worker. Marketing transport needs only connector credentials and
 * the deterministic policy gate; it does not import private platform modules.
 */
@Module({
  imports: [OutboxPrismaModule],
  providers: [
    KafkaProducerService,
    DurableOutboxWorker,
    {
      provide: FgisGrainProviderConfigurationPort,
      useClass: FailClosedFgisGrainProviderConfigurationPort,
    },
    {
      provide: FgisGrainImmutablePayloadStorePort,
      useClass: FailClosedFgisGrainImmutablePayloadStorePort,
    },
    {
      provide: FgisGrainCanonicalizationPort,
      useClass: FailClosedFgisGrainCanonicalizationPort,
    },
    {
      provide: FgisGrainSigningProviderPort,
      useClass: FailClosedFgisGrainSigningProviderPort,
    },
    {
      provide: FgisGrainSignedEnvelopeAssemblerPort,
      useClass: FailClosedFgisGrainSignedEnvelopeAssemblerPort,
    },
    {
      provide: FgisGrainSoapTransportPort,
      useClass: FailClosedFgisGrainSoapTransportPort,
    },
    FgisGrainExchangeReceiptRepository,
    FgisGrainOutboxDispatchHandler,
    MarketingPolicyService,
    TelegramPublisher,
    VkPublisher,
    MarketingPublisherService,
    MarketingOutboxDispatchHandler,
    DurableOutboxRunner,
  ],
})
export class OutboxWorkerModule {}
