import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthPrismaService } from '../auth/auth-prisma.service';
import { StaffAccessController } from './staff-access.controller';
import { StaffAccessGuard } from './staff-access.guard';
import { StaffAccessRepository } from './staff-access.repository';
import { StaffAccessRequestService } from './staff-access-request.service';
import { StaffAccessService } from './staff-access.service';
import { StaffAssignmentService } from './staff-assignment.service';
import { StaffAuditService } from './staff-audit.service';
import { StaffDelegatedAccessGuard } from './staff-delegated-access.guard';
import { StaffEmergencyService } from './staff-emergency.service';
import { StaffProjectionService } from './staff-projection.service';

@Module({
  imports: [AuthModule],
  controllers: [StaffAccessController],
  providers: [
    {
      provide: StaffAccessRepository,
      inject: [AuthPrismaService],
      useFactory: (prisma: AuthPrismaService) => new StaffAccessRepository(prisma),
    },
    StaffAccessService,
    StaffAccessRequestService,
    StaffAssignmentService,
    StaffAuditService,
    StaffEmergencyService,
    StaffProjectionService,
    StaffAccessGuard,
    StaffDelegatedAccessGuard,
  ],
  exports: [StaffAccessService, StaffAccessRepository],
})
export class StaffAccessModule {}
