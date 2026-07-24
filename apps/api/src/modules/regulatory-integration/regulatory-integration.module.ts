import { Module } from '@nestjs/common';
import { RegulatoryIntegrationControlTowerCommandService } from './regulatory-integration.control-tower.command.service';
import { RegulatoryIntegrationControlTowerController } from './regulatory-integration.control-tower.controller';
import { RegulatoryIntegrationControlTowerRepository } from './regulatory-integration.control-tower.repository';
import { RegulatoryIntegrationControlTowerRedriveRepository } from './regulatory-integration.control-tower.redrive.repository';
import { RegulatoryIntegrationInboxLifecycleRepository } from './regulatory-integration.inbox-lifecycle.repository';
import { RegulatoryIntegrationInboxRepository } from './regulatory-integration.inbox.repository';
import { RegulatoryIntegrationReconciliationRepository } from './regulatory-integration.reconciliation.repository';

@Module({
  controllers: [RegulatoryIntegrationControlTowerController],
  providers: [
    RegulatoryIntegrationInboxRepository,
    RegulatoryIntegrationInboxLifecycleRepository,
    RegulatoryIntegrationControlTowerRepository,
    RegulatoryIntegrationControlTowerRedriveRepository,
    RegulatoryIntegrationReconciliationRepository,
    RegulatoryIntegrationControlTowerCommandService,
  ],
  exports: [
    RegulatoryIntegrationInboxRepository,
    RegulatoryIntegrationInboxLifecycleRepository,
    RegulatoryIntegrationControlTowerRepository,
    RegulatoryIntegrationControlTowerRedriveRepository,
    RegulatoryIntegrationReconciliationRepository,
    RegulatoryIntegrationControlTowerCommandService,
  ],
})
export class RegulatoryIntegrationModule {}
