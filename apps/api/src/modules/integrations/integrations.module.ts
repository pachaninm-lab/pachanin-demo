import { Module } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { EdoWebhookController } from './edo-webhook.controller';
import { FgisLegacyQuarantineModule } from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine.module';

@Module({
  imports: [NotificationsModule, FgisLegacyQuarantineModule],
  controllers: [IntegrationsController, EdoWebhookController],
  providers: [IntegrationsService, AccessScopeService],
  exports: [IntegrationsService]
})
export class IntegrationsModule {}
