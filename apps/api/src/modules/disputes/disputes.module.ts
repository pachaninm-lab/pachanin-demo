import { Module } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [DisputesController],
  providers: [DisputesService, AccessScopeService],
  exports: [DisputesService]
})
export class DisputesModule {}
