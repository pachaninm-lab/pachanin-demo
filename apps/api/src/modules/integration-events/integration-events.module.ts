import { Module } from '@nestjs/common';
import { IntegrationEventsService } from './integration-events.service';
import { IntegrationEventsController } from './integration-events.controller';
import { DurableOutboxWorker } from './durable-outbox.worker';
import { IndustrialMetricsService } from './industrial-metrics.service';

@Module({
  providers: [IntegrationEventsService, DurableOutboxWorker, IndustrialMetricsService],
  controllers: [IntegrationEventsController],
  exports: [IntegrationEventsService, DurableOutboxWorker, IndustrialMetricsService],
})
export class IntegrationEventsModule {}
