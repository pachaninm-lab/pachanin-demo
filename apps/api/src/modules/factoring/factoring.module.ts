import { Module } from '@nestjs/common';
import { FactoringService } from './factoring.service';
import { FactoringController } from './factoring.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [FactoringService],
  controllers: [FactoringController],
  exports: [FactoringService],
})
export class FactoringModule {}
