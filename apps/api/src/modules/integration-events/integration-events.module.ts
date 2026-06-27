import { Module } from '@nestjs/common';
import { IntegrationEventsService } from './integration-events.service';

@Module({
  providers: [IntegrationEventsService],
  exports: [IntegrationEventsService],
})
export class IntegrationEventsModule {}
