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
import { FgisGrainOutboxDispatchHandler } from './modules/regulatory-integration/fgis-grain/fgis-grain-outbox-dispatch.handler';

/**
 * Minimal process graph for the durable outbox worker.
 *
 * It deliberately does not import AppModule, controllers, HTTP guards, auth,
 * settlement, documents or other business modules. PostgreSQL remains the only
 * queue authority and the worker can scale independently from the API process.
 * Its Prisma provider validates an outbox-only principal with no Deal access.
 *
 * FGIS-specific delivery is registered as one type handler on the same durable
 * worker. Every external capability is fail-closed until a separately approved
 * provider implementation is wired; no second queue or relay exists.
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
    FgisGrainOutboxDispatchHandler,
    DurableOutboxRunner,
  ],
})
export class OutboxWorkerModule {}
