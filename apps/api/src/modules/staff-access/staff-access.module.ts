import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthPrismaService } from '../auth/auth-prisma.service';
import { RegistrationCancellationController } from './registration-cancellation.controller';
import { StaffAccessController } from './staff-access.controller';
import { StaffAccessGuard } from './staff-access.guard';
import { StaffAccessRepository } from './staff-access.repository';
import { StaffAccessRequestService } from './staff-access-request.service';
import { StaffAccessService } from './staff-access.service';
import { StaffAssignmentService } from './staff-assignment.service';
import { StaffAuditService } from './staff-audit.service';
import { StaffAuditWriterService } from './staff-audit-writer.service';
import { StaffAuthorityPrismaService } from './staff-authority-prisma.service';
import { StaffCapabilitiesController } from './staff-capabilities.controller';
import { StaffCapabilitiesService } from './staff-capabilities.service';
import { StaffDelegatedAccessGuard } from './staff-delegated-access.guard';
import { StaffEmergencyService } from './staff-emergency.service';
import { StaffProjectionService } from './staff-projection.service';
import { StaffRuntimeAccessRepository } from './staff-runtime-access.repository';
import { StaffSupportService } from './staff-support.service';
import { StaffWorkspaceAuditInterceptor } from './staff-workspace-audit.interceptor';
import { StaffWorkspaceController } from './staff-workspace.controller';
import { StaffWorkspaceService } from './staff-workspace.service';

@Module({
  imports: [AuthModule],
  controllers: [
    StaffAccessController,
    RegistrationCancellationController,
    StaffCapabilitiesController,
    StaffWorkspaceController,
  ],
  providers: [
    StaffAuthorityPrismaService,
    {
      provide: StaffAccessRepository,
      inject: [AuthPrismaService, StaffAuthorityPrismaService],
      useFactory: (prisma: AuthPrismaService, staffAuthorityPrisma: StaffAuthorityPrismaService) =>
        new StaffRuntimeAccessRepository(prisma, staffAuthorityPrisma),
    },
    StaffAccessService,
    StaffAccessRequestService,
    StaffAssignmentService,
    StaffAuditService,
    StaffAuditWriterService,
    StaffCapabilitiesService,
    StaffEmergencyService,
    StaffProjectionService,
    StaffSupportService,
    StaffWorkspaceService,
    StaffWorkspaceAuditInterceptor,
    StaffAccessGuard,
    StaffDelegatedAccessGuard,
  ],
  exports: [
    StaffAccessService,
    StaffAccessRepository,
    StaffAuthorityPrismaService,
    StaffSupportService,
    StaffWorkspaceService,
    StaffAuditWriterService,
  ],
})
export class StaffAccessModule {}
