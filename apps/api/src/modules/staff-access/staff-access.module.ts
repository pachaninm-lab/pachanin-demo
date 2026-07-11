import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { StaffAccessController } from './staff-access.controller';
import { StaffAccessGuard } from './staff-access.guard';
import { StaffAccessRepository } from './staff-access.repository';
import { StaffAccessService } from './staff-access.service';
import { StaffAssignmentService } from './staff-assignment.service';

@Module({
  imports: [PrismaModule],
  controllers: [StaffAccessController],
  providers: [
    StaffAccessRepository,
    StaffAccessService,
    StaffAssignmentService,
    StaffAccessGuard,
  ],
  exports: [StaffAccessService, StaffAccessRepository],
})
export class StaffAccessModule {}
