import { Injectable } from '@nestjs/common';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';

@Injectable()
export class IntegrationsService {
  constructor(private readonly runtime: RuntimeCoreService) {}

  jobs(_user: any) {
    return {
      jobs: [
        { id: 'JOB-001', type: 'EDO_EXPORT', dealId: 'DEAL-001', status: 'SANDBOX_ONLY' },
        { id: 'JOB-002', type: 'FGIS_PUSH', dealId: 'DEAL-001', status: 'SANDBOX_ONLY' },
        { id: 'JOB-003', type: 'BANK_RESERVE', dealId: 'DEAL-002', status: 'PENDING_CALLBACK' },
        { id: 'JOB-004', type: 'GPS_HEARTBEAT', shipmentId: 'SHIP-001', status: 'LIVE_SIMULATED' },
      ],
    };
  }

  health() {
    return this.runtime.integrationHealth();
  }

  hardening() {
    return {
      status: 'PARTIAL',
      checks: [
        { name: 'TLS_PINNING', passed: true },
        { name: 'REPLAY_PROTECTION', passed: true },
        { name: 'RATE_LIMITING', passed: true },
        { name: 'SECRET_ROTATION', passed: false, note: 'Pending for production connectors' },
        { name: 'AUDIT_LOGGING', passed: true },
      ],
    };
  }

  exportContract(dealId: string, user: any) {
    return {
      dealId,
      connector: 'EDO',
      status: 'SANDBOX_ONLY',
      jobId: `JOB-EDO-${dealId}-${Date.now()}`,
      initiatedByUserId: user?.sub ?? user?.id ?? null,
      initiatedAt: new Date().toISOString(),
    };
  }

  pushFgis(dealId: string, user: any) {
    return {
      dealId,
      connector: 'FGIS_ZERNO',
      status: 'SANDBOX_ONLY',
      jobId: `JOB-FGIS-${dealId}-${Date.now()}`,
      initiatedByUserId: user?.sub ?? user?.id ?? null,
      initiatedAt: new Date().toISOString(),
    };
  }

  reservePrepayment(dealId: string, user: any) {
    return this.runtime.reservePrepayment(dealId, user);
  }

  gpsHeartbeat(shipmentId: string, user: any) {
    const heartbeat = this.runtime.appendGpsHeartbeat(shipmentId, user);
    return {
      shipmentId,
      connector: 'GPS',
      status: 'LIVE_SIMULATED',
      recordedAt: new Date().toISOString(),
      ...heartbeat,
    };
  }
}
