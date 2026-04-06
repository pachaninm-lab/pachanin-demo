import { Module } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { AntiFraudModule } from '../anti-fraud/anti-fraud.module';
import { LogisticsController } from './logistics.controller';
import { LogisticsService } from './logistics.service';

@Module({
  imports: [AuditModule, NotificationsModule, IntegrationsModule, AntiFraudModule],
  controllers: [LogisticsController],
  providers: [LogisticsService, AccessScopeService],
  exports: [LogisticsService]
})
export class LogisticsModule {}
