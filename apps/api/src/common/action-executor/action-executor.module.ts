import { Module } from '@nestjs/common';
import { ActionExecutorService } from './action-executor.service';
import { OutboxService } from '../outbox/outbox.service';
import { AuditModule } from '../../modules/audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [ActionExecutorService, OutboxService],
  exports: [ActionExecutorService, OutboxService],
})
export class ActionExecutorModule {}
