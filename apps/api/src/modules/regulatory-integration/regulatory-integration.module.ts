import { Module } from '@nestjs/common';
import { RegulatoryIntegrationInboxLifecycleRepository } from './regulatory-integration.inbox-lifecycle.repository';
import { RegulatoryIntegrationInboxRepository } from './regulatory-integration.inbox.repository';

@Module({
  providers: [
    RegulatoryIntegrationInboxRepository,
    RegulatoryIntegrationInboxLifecycleRepository,
  ],
  exports: [
    RegulatoryIntegrationInboxRepository,
    RegulatoryIntegrationInboxLifecycleRepository,
  ],
})
export class RegulatoryIntegrationModule {}
