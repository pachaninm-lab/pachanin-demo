import { Module } from '@nestjs/common';
import { StaffAccessModule } from '../staff-access/staff-access.module';
import { FounderControlController } from './founder-control.controller';
import { FounderControlRepository } from './founder-control.repository';
import { FounderControlService } from './founder-control.service';

@Module({
  imports: [StaffAccessModule],
  controllers: [FounderControlController],
  providers: [FounderControlRepository, FounderControlService],
  exports: [FounderControlService],
})
export class FounderControlModule {}
