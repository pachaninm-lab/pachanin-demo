import { Module } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { EdoWebhookController } from './edo-webhook.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [IntegrationsController, EdoWebhookController],
  providers: [IntegrationsService, AccessScopeService],
  exports: [IntegrationsService]
})
export class IntegrationsModule {}
