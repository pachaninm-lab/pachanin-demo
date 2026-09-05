import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FnsEgrulFileImportService } from './fns-egrul-file-import.service';
import { RoleEligibilityFnsEgrulIngestRepository } from './role-eligibility-fns-egrul-ingest.repository';
import { RoleEligibilityRegistryRepository } from './role-eligibility-registry.repository';
import { RoleEligibilitySourceHealthService } from './role-eligibility-source-health.service';

@Module({
  providers: [
    PrismaService,
    RoleEligibilityRegistryRepository,
    RoleEligibilitySourceHealthService,
    RoleEligibilityFnsEgrulIngestRepository,
    FnsEgrulFileImportService,
  ],
  exports: [FnsEgrulFileImportService],
})
export class RoleEligibilityFnsEgrulImportModule {}
