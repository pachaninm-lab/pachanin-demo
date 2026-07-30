import { Module } from '@nestjs/common';
import { FgisGrainAckRepository } from './fgis-grain/fgis-grain-ack.repository';
import { FgisGrainContractCatalogService } from './fgis-grain/fgis-grain-contract-catalog.service';
import { FgisGrainDispatchRepository } from './fgis-grain/fgis-grain-dispatch.repository';
import { FgisGrainExchangeCorrelationRepository } from './fgis-grain/fgis-grain-exchange-correlation.repository';
import { FgisGrainProviderAttestationRepository } from './fgis-grain/fgis-grain-provider-attestation.repository';
import { FgisGrainSdizProjectionRepository } from './fgis-grain/fgis-grain-sdiz-projection.repository';
import { FgisGrainTenantReadController } from './fgis-grain/fgis-grain-tenant-read.controller';
import { FgisGrainTenantReadRepository } from './fgis-grain/fgis-grain-tenant-read.repository';
import {
  DisabledFgisGrainTenantReadTransport,
  FGIS_GRAIN_TENANT_READ_TRANSPORT,
} from './fgis-grain/fgis-grain-tenant-read.transport';
import { FgisGrainXmlCodecService } from './fgis-grain/fgis-grain-xml-codec.service';
import { RegulatoryIntegrationControlTowerCommandService } from './regulatory-integration.control-tower.command.service';
import { RegulatoryIntegrationControlTowerController } from './regulatory-integration.control-tower.controller';
import { RegulatoryIntegrationControlTowerRepository } from './regulatory-integration.control-tower.repository';
import { RegulatoryIntegrationControlTowerRedriveRepository } from './regulatory-integration.control-tower.redrive.repository';
import { RegulatoryIntegrationInboxLifecycleRepository } from './regulatory-integration.inbox-lifecycle.repository';
import { RegulatoryIntegrationInboxRepository } from './regulatory-integration.inbox.repository';
import { RegulatoryIntegrationReconciliationRepository } from './regulatory-integration.reconciliation.repository';

@Module({
  controllers: [
    RegulatoryIntegrationControlTowerController,
    FgisGrainTenantReadController,
  ],
  providers: [
    RegulatoryIntegrationInboxRepository,
    RegulatoryIntegrationInboxLifecycleRepository,
    RegulatoryIntegrationControlTowerRepository,
    RegulatoryIntegrationControlTowerRedriveRepository,
    RegulatoryIntegrationReconciliationRepository,
    RegulatoryIntegrationControlTowerCommandService,
    FgisGrainContractCatalogService,
    FgisGrainXmlCodecService,
    FgisGrainDispatchRepository,
    FgisGrainExchangeCorrelationRepository,
    FgisGrainAckRepository,
    FgisGrainProviderAttestationRepository,
    FgisGrainSdizProjectionRepository,
    FgisGrainTenantReadRepository,
    DisabledFgisGrainTenantReadTransport,
    {
      provide: FGIS_GRAIN_TENANT_READ_TRANSPORT,
      useExisting: DisabledFgisGrainTenantReadTransport,
    },
  ],
  exports: [
    RegulatoryIntegrationInboxRepository,
    RegulatoryIntegrationInboxLifecycleRepository,
    RegulatoryIntegrationControlTowerRepository,
    RegulatoryIntegrationControlTowerRedriveRepository,
    RegulatoryIntegrationReconciliationRepository,
    RegulatoryIntegrationControlTowerCommandService,
    FgisGrainContractCatalogService,
    FgisGrainXmlCodecService,
    FgisGrainDispatchRepository,
    FgisGrainExchangeCorrelationRepository,
    FgisGrainAckRepository,
    FgisGrainProviderAttestationRepository,
    FgisGrainSdizProjectionRepository,
    FgisGrainTenantReadRepository,
    FGIS_GRAIN_TENANT_READ_TRANSPORT,
  ],
})
export class RegulatoryIntegrationModule {}
