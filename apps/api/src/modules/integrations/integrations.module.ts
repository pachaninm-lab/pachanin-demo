import { Module } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [NotificationsModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, AccessScopeService],
  exports: [IntegrationsService]
})
export class IntegrationsModule {}
