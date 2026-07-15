import { Module } from '@nestjs/common';
import { IntegrationEventsService } from './integration-events.service';
import { IntegrationEventsController } from './integration-events.controller';
import { DurableOutboxWorker } from './durable-outbox.worker';
import { DurableOutboxRunner } from './durable-outbox.runner';
import { IndustrialMetricsService } from './industrial-metrics.service';

@Module({
  providers: [
    IntegrationEventsService,
    DurableOutboxWorker,
    DurableOutboxRunner,
    IndustrialMetricsService,
  ],
  controllers: [IntegrationEventsController],
  exports: [
    IntegrationEventsService,
    DurableOutboxWorker,
    DurableOutboxRunner,
    IndustrialMetricsService,
  ],
})
export class IntegrationEventsModule {}
