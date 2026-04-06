import { Module } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { AuditModule } from '../audit/audit.module';
import { AntiFraudModule } from '../anti-fraud/anti-fraud.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { LedgerModule } from '../ledger/ledger.module';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';

@Module({
  imports: [AuditModule, AntiFraudModule, NotificationsModule, IntegrationsModule, LedgerModule],
  controllers: [DealsController],
  providers: [DealsService, AccessScopeService],
  exports: [DealsService]
})
export class DealsModule {}
