import { Module } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { AuditModule } from '../audit/audit.module';
import { LabsController } from './labs.controller';
import { LabsService } from './labs.service';

@Module({
  imports: [AuditModule],
  controllers: [LabsController],
  providers: [LabsService, AccessScopeService],
  exports: [LabsService]
})
export class LabsModule {}
