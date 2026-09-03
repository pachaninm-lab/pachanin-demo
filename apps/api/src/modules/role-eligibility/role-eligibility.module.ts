import { Module } from '@nestjs/common';
import { StaffAccessModule } from '../staff-access/staff-access.module';
import { StaffAccessGuard } from '../staff-access/staff-access.guard';
import { AccreditationAdapter } from './adapters/accreditation.adapter';
import { CbrRegistryAdapter } from './adapters/cbr-registry.adapter';
import { FgisGrainAdapter } from './adapters/fgis-grain.adapter';
import { FnsEvidenceAdapter } from './adapters/fns-evidence.adapter';
import { RoleEligibilityAdmissionService } from './role-eligibility-admission.service';
import { RoleEligibilityController } from './role-eligibility.controller';
import { RoleEligibilityEvidenceService } from './role-eligibility-evidence.service';
import { RoleEligibilityEnforcementRepository } from './role-eligibility-enforcement.repository';
import { RoleEligibilityMetricsService } from './role-eligibility-metrics.service';
import { RoleEligibilityRegistryRepository } from './role-eligibility-registry.repository';
import { RoleEligibilityRegistrySyncService } from './role-eligibility-registry-sync.service';
import { RoleEligibilityRepository } from './role-eligibility.repository';
import { RoleEligibilityService } from './role-eligibility.service';
import { RoleEligibilitySourceHealthService } from './role-eligibility-source-health.service';
import { RoleEligibilityWorkerRepository } from './role-eligibility-worker.repository';
import { RoleEligibilityWorkerService } from './role-eligibility-worker.service';

@Module({
  imports: [StaffAccessModule],
  controllers: [RoleEligibilityController],
  providers: [
    RoleEligibilityRepository,
    RoleEligibilityRegistryRepository,
    RoleEligibilityWorkerRepository,
    // Admission/enforcement providers remain dormant while ROLE_ELIGIBILITY_ENFORCEMENT=false.
    RoleEligibilityEnforcementRepository,
    RoleEligibilityEvidenceService,
    RoleEligibilityMetricsService,
    RoleEligibilityService,
    RoleEligibilityAdmissionService,
    RoleEligibilitySourceHealthService,
    RoleEligibilityRegistrySyncService,
    RoleEligibilityWorkerService,
    CbrRegistryAdapter,
    FgisGrainAdapter,
    FnsEvidenceAdapter,
    AccreditationAdapter,
    StaffAccessGuard,
  ],
  exports: [
    RoleEligibilityRepository,
    RoleEligibilityRegistryRepository,
    RoleEligibilityWorkerRepository,
    RoleEligibilityEnforcementRepository,
    RoleEligibilityEvidenceService,
    RoleEligibilityMetricsService,
    RoleEligibilityService,
    RoleEligibilityAdmissionService,
    RoleEligibilitySourceHealthService,
    RoleEligibilityRegistrySyncService,
    RoleEligibilityWorkerService,
  ],
})
export class RoleEligibilityModule {}
