import { Module } from '@nestjs/common';
import { RegulatoryIntegrationControlTowerCommandService } from './regulatory-integration.control-tower.command.service';
import { RegulatoryIntegrationControlTowerController } from './regulatory-integration.control-tower.controller';
import { RegulatoryIntegrationControlTowerRepository } from './regulatory-integration.control-tower.repository';
import { RegulatoryIntegrationInboxLifecycleRepository } from './regulatory-integration.inbox-lifecycle.repository';
import { RegulatoryIntegrationInboxRepository } from './regulatory-integration.inbox.repository';

@Module({
  controllers: [RegulatoryIntegrationControlTowerController],
  providers: [
    RegulatoryIntegrationInboxRepository,
    RegulatoryIntegrationInboxLifecycleRepository,
    RegulatoryIntegrationControlTowerRepository,
    RegulatoryIntegrationControlTowerCommandService,
  ],
  exports: [
    RegulatoryIntegrationInboxRepository,
    RegulatoryIntegrationInboxLifecycleRepository,
    RegulatoryIntegrationControlTowerRepository,
    RegulatoryIntegrationControlTowerCommandService,
  ],
})
export class RegulatoryIntegrationModule {}
