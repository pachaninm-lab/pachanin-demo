import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { RoleGrantService } from './role-grant.service';
import { AuthModule } from '../auth/auth.module';
import { OutboxModule } from '../../common/outbox/outbox.module';

@Module({
  imports: [AuthModule, OutboxModule],
  controllers: [AdminController],
  providers: [RoleGrantService],
})
export class AdminModule {}
