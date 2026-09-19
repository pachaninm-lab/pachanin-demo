import { Injectable, OnModuleDestroy, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';

export type CertificateStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface Certificate {
  id: string;
  userId: string;
  organizationId: string;
  serialNumber: string;
  subjectName: string;
  issuerName: string;
  thumbprint: string;
  validFrom: string;
  validTo: string;
  status: CertificateStatus;
  registeredAt: string;
  lastCheckedAt?: string;
}

export interface RegisterCertificateDto {
  userId: string;
  organizationId: string;
  serialNumber: string;
  subjectName: string;
  issuerName: string;
  thumbprint: string;
  validFrom: string;
  validTo: string;
}

const EXPIRY_THRESHOLDS_DAYS = [30, 14, 7, 1];
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

@Injectable()
export class CertificateMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly certificates = new Map<string, Certificate>();
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly notifications: NotificationsService) {}

  onModuleInit() {
    this.timer = setInterval(() => this.checkExpirations(), CHECK_INTERVAL_MS);
    // Seed demo certificate so the endpoint is immediately useful
    this.register({
      userId: 'user-farmer-001',
      organizationId: 'org-farmer-001',
      serialNumber: '0123456789ABCDEF',
      subjectName: 'CN=Demo Farmer, O=ООО «АгроДемо», INN=7701000001',
      issuerName: 'CN=КриптоПро DSS CA, O=CryptoPro',
      thumbprint: 'A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2',
      validFrom: new Date(Date.now() - 180 * 86400_000).toISOString(),
      validTo: new Date(Date.now() + 14 * 86400_000).toISOString(), // expires in 14 days — triggers notification
    });
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  register(dto: RegisterCertificateDto): Certificate {
    const existing = [...this.certificates.values()].find(
      c => c.thumbprint === dto.thumbprint,
    );
    if (existing) return existing;

    const now = new Date().toISOString();
    const validTo = new Date(dto.validTo);
    const status: CertificateStatus = validTo < new Date() ? 'EXPIRED' : 'ACTIVE';

    const cert: Certificate = {
      id: randomUUID(),
      ...dto,
      status,
      registeredAt: now,
    };
    this.certificates.set(cert.id, cert);
    return cert;
  }

  revoke(certId: string, requestingUserId: string): Certificate {
    const cert = this.certificates.get(certId);
    if (!cert) throw new NotFoundException(`Certificate ${certId} not found`);
    if (cert.userId !== requestingUserId) {
      const isAdmin = false; // caller checks role
      if (!isAdmin) throw new BadRequestException('Cannot revoke another user\'s certificate');
    }
    cert.status = 'REVOKED';
    return cert;
  }

  revokeAdmin(certId: string): Certificate {
    const cert = this.certificates.get(certId);
    if (!cert) throw new NotFoundException(`Certificate ${certId} not found`);
    cert.status = 'REVOKED';
    return cert;
  }

  listForUser(userId: string): Certificate[] {
    return [...this.certificates.values()].filter(c => c.userId === userId);
  }

  listForOrg(orgId: string): Certificate[] {
    return [...this.certificates.values()].filter(c => c.organizationId === orgId);
  }

  getById(certId: string): Certificate | undefined {
    return this.certificates.get(certId);
  }

  checkExpirations(): { checked: number; notified: number; expired: number } {
    const now = new Date();
    let notified = 0;
    let expired = 0;

    for (const cert of this.certificates.values()) {
      if (cert.status === 'REVOKED') continue;

      const validTo = new Date(cert.validTo);
      const msLeft = validTo.getTime() - now.getTime();
      const daysLeft = Math.round(msLeft / 86400_000);

      cert.lastCheckedAt = now.toISOString();

      if (daysLeft < 0 && cert.status !== 'EXPIRED') {
        cert.status = 'EXPIRED';
        expired++;
        this.notifications.send(
          cert.userId,
          `Сертификат УКЭП («${cert.subjectName}») истёк. Обновите сертификат для продолжения подписания документов.`,
          'certificate:expired',
          { title: 'Сертификат УКЭП истёк' },
        );
      } else if (EXPIRY_THRESHOLDS_DAYS.includes(daysLeft)) {
        notified++;
        this.notifications.send(
          cert.userId,
          `Сертификат УКЭП («${cert.subjectName}») истекает через ${daysLeft} ${this.dayLabel(daysLeft)}. Заблаговременно обновите сертификат.`,
          'certificate:expiring_soon',
          { title: `Сертификат УКЭП истекает через ${daysLeft} ${this.dayLabel(daysLeft)}` },
        );
      }
    }

    return { checked: this.certificates.size, notified, expired };
  }

  private dayLabel(days: number): string {
    if (days === 1) return 'день';
    if (days >= 2 && days <= 4) return 'дня';
    return 'дней';
  }
}
