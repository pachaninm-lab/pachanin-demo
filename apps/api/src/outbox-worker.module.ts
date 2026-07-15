import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { KafkaProducerService } from './common/kafka/kafka-producer.service';
import { DurableOutboxWorker } from './modules/integration-events/durable-outbox.worker';
import { DurableOutboxRunner } from './modules/integration-events/durable-outbox.runner';
import { IndustrialMetricsService } from './modules/integration-events/industrial-metrics.service';

/**
 * Minimal process graph for the durable outbox worker.
 *
 * It deliberately does not import AppModule, controllers, HTTP guards, auth,
 * settlement, documents or other business modules. PostgreSQL remains the only
 * queue authority and the worker can scale independently from the API process.
 */
@Module({
  imports: [PrismaModule],
  providers: [
    KafkaProducerService,
    DurableOutboxWorker,
    DurableOutboxRunner,
    IndustrialMetricsService,
  ],
})
export class OutboxWorkerModule {}
