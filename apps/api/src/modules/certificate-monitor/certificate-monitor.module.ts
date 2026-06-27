import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { CertificateMonitorController } from './certificate-monitor.controller';
import { CertificateMonitorService } from './certificate-monitor.service';

@Module({
  imports: [NotificationsModule],
  controllers: [CertificateMonitorController],
  providers: [CertificateMonitorService],
  exports: [CertificateMonitorService],
})
export class CertificateMonitorModule {}
