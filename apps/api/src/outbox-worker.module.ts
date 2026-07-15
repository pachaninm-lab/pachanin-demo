import { Module } from '@nestjs/common';
import { OutboxPrismaModule } from './common/prisma/outbox-prisma.module';
import { KafkaProducerService } from './common/kafka/kafka-producer.service';
import { DurableOutboxWorker } from './modules/integration-events/durable-outbox.worker';
import { DurableOutboxRunner } from './modules/integration-events/durable-outbox.runner';

/**
 * Minimal process graph for the durable outbox worker.
 *
 * It deliberately does not import AppModule, controllers, HTTP guards, auth,
 * settlement, documents or other business modules. PostgreSQL remains the only
 * queue authority and the worker can scale independently from the API process.
 * Its Prisma provider validates an outbox-only principal with no Deal access.
 */
@Module({
  imports: [OutboxPrismaModule],
  providers: [
    KafkaProducerService,
    DurableOutboxWorker,
    DurableOutboxRunner,
  ],
})
export class OutboxWorkerModule {}
