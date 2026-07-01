import { Module } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { ComplianceController } from './compliance.controller';
import { AuditModule } from '../audit/audit.module';
import { ActionExecutorModule } from '../../common/action-executor/action-executor.module';

@Module({
  imports: [AuditModule, ActionExecutorModule],
  providers: [ComplianceService],
  controllers: [ComplianceController],
  exports: [ComplianceService],
})
export class ComplianceModule {}
