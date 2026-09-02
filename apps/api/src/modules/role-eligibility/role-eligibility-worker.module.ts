import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AccreditationAdapter } from './adapters/accreditation.adapter';
import { CbrRegistryAdapter } from './adapters/cbr-registry.adapter';
import { FgisGrainAdapter } from './adapters/fgis-grain.adapter';
import { FnsEvidenceAdapter } from './adapters/fns-evidence.adapter';
import { RoleEligibilityEvidenceService } from './role-eligibility-evidence.service';
import { RoleEligibilityRegistryRepository } from './role-eligibility-registry.repository';
import { RoleEligibilityRegistrySyncService } from './role-eligibility-registry-sync.service';
import { RoleEligibilityRepository } from './role-eligibility.repository';
import { RoleEligibilitySourceHealthService } from './role-eligibility-source-health.service';
import { RoleEligibilityWorkerRepository } from './role-eligibility-worker.repository';
import { RoleEligibilityWorkerService } from './role-eligibility-worker.service';

@Module({
  imports: [PrismaModule],
  providers: [
    RoleEligibilityRepository,
    RoleEligibilityRegistryRepository,
    RoleEligibilityWorkerRepository,
    RoleEligibilityEvidenceService,
    RoleEligibilitySourceHealthService,
    RoleEligibilityRegistrySyncService,
    RoleEligibilityWorkerService,
    CbrRegistryAdapter,
    FgisGrainAdapter,
    FnsEvidenceAdapter,
    AccreditationAdapter,
  ],
  exports: [RoleEligibilityRegistrySyncService, RoleEligibilityWorkerService],
})
export class RoleEligibilityWorkerModule {}
