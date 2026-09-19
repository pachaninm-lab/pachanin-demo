import { Module } from '@nestjs/common';
import { IntegrationEventsService } from './integration-events.service';
import { IntegrationEventsController } from './integration-events.controller';
import { IndustrialMetricsService } from './industrial-metrics.service';

@Module({
  providers: [
    IntegrationEventsService,
    IndustrialMetricsService,
  ],
  controllers: [IntegrationEventsController],
  exports: [IntegrationEventsService, IndustrialMetricsService],
})
export class IntegrationEventsModule {}
