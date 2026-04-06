import { Module } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { ObjectPolicyService } from '../../common/security/object-policy.service';
import { AuditModule } from '../audit/audit.module';
import { LotsController } from './lots.controller';
import { LotsService } from './lots.service';

@Module({
  imports: [AuditModule],
  controllers: [LotsController],
  providers: [LotsService, AccessScopeService, ObjectPolicyService],
  exports: [LotsService]
})
export class LotsModule {}
