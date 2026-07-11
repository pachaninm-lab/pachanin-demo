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
import { StaffAuditWriterService } from './staff-audit-writer.service';
import { StaffDelegatedAccessGuard } from './staff-delegated-access.guard';
import { StaffEmergencyService } from './staff-emergency.service';
import { StaffProjectionService } from './staff-projection.service';
import { StaffWorkspaceAuditInterceptor } from './staff-workspace-audit.interceptor';
import { StaffWorkspaceController } from './staff-workspace.controller';
import { StaffWorkspaceService } from './staff-workspace.service';

@Module({
  imports: [AuthModule],
  controllers: [StaffAccessController, StaffWorkspaceController],
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
    StaffAuditWriterService,
    StaffEmergencyService,
    StaffProjectionService,
    StaffWorkspaceService,
    StaffWorkspaceAuditInterceptor,
    StaffAccessGuard,
    StaffDelegatedAccessGuard,
  ],
  exports: [StaffAccessService, StaffAccessRepository, StaffWorkspaceService, StaffAuditWriterService],
})
export class StaffAccessModule {}
