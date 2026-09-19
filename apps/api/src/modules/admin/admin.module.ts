import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { OutboxModule } from '../../common/outbox/outbox.module';

@Module({
  imports: [AuthModule, OutboxModule],
  controllers: [AdminController],
})
export class AdminModule {}
