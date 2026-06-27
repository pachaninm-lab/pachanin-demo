import { Module } from '@nestjs/common';
import { PartnerApiService } from './partner-api.service';
import { PartnerApiController } from './partner-api.controller';
import { WebhookDispatcherService } from './webhook-dispatcher.service';

@Module({
  providers: [PartnerApiService, WebhookDispatcherService],
  controllers: [PartnerApiController],
  exports: [PartnerApiService, WebhookDispatcherService],
})
export class PartnerApiModule {}
