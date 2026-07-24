import { Module } from '@nestjs/common';
import { FgisGrain1023ContractCatalog } from './fgis-grain/fgis-grain-1.0.23.contract';
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
    FgisGrain1023ContractCatalog,
  ],
  exports: [
    RegulatoryIntegrationInboxRepository,
    RegulatoryIntegrationInboxLifecycleRepository,
    RegulatoryIntegrationControlTowerRepository,
    RegulatoryIntegrationControlTowerRedriveRepository,
    RegulatoryIntegrationReconciliationRepository,
    RegulatoryIntegrationControlTowerCommandService,
    FgisGrain1023ContractCatalog,
  ],
})
export class RegulatoryIntegrationModule {}
