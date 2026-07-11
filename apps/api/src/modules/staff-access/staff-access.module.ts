import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { StaffAccessController } from './staff-access.controller';
import { StaffAccessGuard } from './staff-access.guard';
import { StaffAccessRepository } from './staff-access.repository';
import { StaffAccessService } from './staff-access.service';
import { StaffAssignmentService } from './staff-assignment.service';
import { StaffAuditService } from './staff-audit.service';
import { StaffDelegatedAccessGuard } from './staff-delegated-access.guard';
import { StaffEmergencyService } from './staff-emergency.service';

@Module({
  imports: [PrismaModule],
  controllers: [StaffAccessController],
  providers: [
    StaffAccessRepository,
    StaffAccessService,
    StaffAssignmentService,
    StaffAuditService,
    StaffEmergencyService,
    StaffAccessGuard,
    StaffDelegatedAccessGuard,
  ],
  exports: [StaffAccessService, StaffAccessRepository],
})
export class StaffAccessModule {}
