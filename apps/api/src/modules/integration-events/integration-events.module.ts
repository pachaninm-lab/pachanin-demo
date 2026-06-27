import { Module } from '@nestjs/common';
import { IntegrationEventsService } from './integration-events.service';
import { IntegrationEventsController } from './integration-events.controller';

@Module({
  providers: [IntegrationEventsService],
  controllers: [IntegrationEventsController],
  exports: [IntegrationEventsService],
})
export class IntegrationEventsModule {}
