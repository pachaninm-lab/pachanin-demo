import { Module } from '@nestjs/common';
import { StaffAccessModule } from '../staff-access/staff-access.module';
import { StaffAccessGuard } from '../staff-access/staff-access.guard';
import { RoleEligibilityController } from './role-eligibility.controller';
import { RoleEligibilityRepository } from './role-eligibility.repository';
import { RoleEligibilityService } from './role-eligibility.service';
import { RoleEligibilitySourceHealthService } from './role-eligibility-source-health.service';

@Module({
  imports: [StaffAccessModule],
  controllers: [RoleEligibilityController],
  providers: [
    RoleEligibilityRepository,
    RoleEligibilityService,
    RoleEligibilitySourceHealthService,
    StaffAccessGuard,
  ],
  exports: [
    RoleEligibilityRepository,
    RoleEligibilityService,
    RoleEligibilitySourceHealthService,
  ],
})
export class RoleEligibilityModule {}
