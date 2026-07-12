import { Module } from '@nestjs/common';
import { IntegrationEventsService } from './integration-events.service';
import { IntegrationEventsController } from './integration-events.controller';
import { DurableOutboxWorker } from './durable-outbox.worker';

@Module({
  providers: [IntegrationEventsService, DurableOutboxWorker],
  controllers: [IntegrationEventsController],
  exports: [IntegrationEventsService, DurableOutboxWorker],
})
export class IntegrationEventsModule {}
