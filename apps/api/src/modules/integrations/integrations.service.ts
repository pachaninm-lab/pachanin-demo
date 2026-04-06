import { Injectable } from '@nestjs/common';

@Injectable()
export class IntegrationsService {
  jobs(_user: any) {
    return {
      jobs: [
        { id: 'JOB-001', type: 'EDO_EXPORT', dealId: 'DEAL-001', status: 'COMPLETED', completedAt: '2026-03-25T13:00:00Z' },
        { id: 'JOB-002', type: 'FGIS_PUSH', dealId: 'DEAL-001', status: 'FAILED', failedAt: '2026-03-25T14:00:00Z', error: 'FGIS connector unavailable' },
        { id: 'JOB-003', type: 'BANK_RESERVE', dealId: 'DEAL-002', status: 'COMPLETED', completedAt: '2026-03-20T10:00:00Z' },
        { id: 'JOB-004', type: 'GPS_HEARTBEAT', shipmentId: 'SHIP-001', status: 'COMPLETED', completedAt: new Date().toISOString() },
      ],
    };
  }

  health() {
    return {
      status: 'DEGRADED',
      connectors: [
        { name: 'EDO', status: 'SANDBOX_ONLY', latency: 0, lastCheck: new Date() },
        { name: 'GosLog', status: 'MISSING', latency: 0, lastCheck: new Date() },
        { name: 'Bank', status: 'SANDBOX_ONLY', latency: 145, lastCheck: new Date() },
        { name: 'GPS', status: 'LIVE_OK', latency: 89, lastCheck: new Date() },
        { name: 'FGIS_ZERNO', status: 'MISSING', latency: 0, lastCheck: new Date() },
      ],
    };
  }

  hardening() {
    return {
      status: 'PARTIAL',
      checks: [
        { name: 'TLS_PINNING', passed: true },
        { name: 'REPLAY_PROTECTION', passed: true },
        { name: 'RATE_LIMITING', passed: false, note: 'Not configured for EDO connector' },
        { name: 'SECRET_ROTATION', passed: false, note: 'Pending for FGIS_ZERNO' },
        { name: 'AUDIT_LOGGING', passed: true },
      ],
    };
  }

  exportContract(dealId: string, user: any) {
    return {
      dealId,
      connector: 'EDO',
      status: 'SANDBOX_ONLY',
      message: `Contract for deal ${dealId} queued for EDO export (sandbox)`,
      jobId: `JOB-EDO-${dealId}-${Date.now()}`,
      initiatedByUserId: user?.sub ?? user?.id ?? null,
      initiatedAt: new Date().toISOString(),
    };
  }

  pushFgis(dealId: string, user: any) {
    return {
      dealId,
      connector: 'FGIS_ZERNO',
      status: 'FAILED',
      message: `FGIS_ZERNO connector is not available. Push for deal ${dealId} could not be completed.`,
      jobId: `JOB-FGIS-${dealId}-${Date.now()}`,
      initiatedByUserId: user?.sub ?? user?.id ?? null,
      initiatedAt: new Date().toISOString(),
    };
  }

  reservePrepayment(dealId: string, user: any) {
    return {
      dealId,
      connector: 'Bank',
      status: 'SANDBOX_ONLY',
      message: `Prepayment reservation for deal ${dealId} submitted to bank (sandbox)`,
      jobId: `JOB-BANK-${dealId}-${Date.now()}`,
      initiatedByUserId: user?.sub ?? user?.id ?? null,
      initiatedAt: new Date().toISOString(),
    };
  }

  gpsHeartbeat(shipmentId: string, user: any) {
    return {
      shipmentId,
      connector: 'GPS',
      status: 'LIVE_OK',
      message: `GPS heartbeat recorded for shipment ${shipmentId}`,
      lat: 52.1 + Math.random() * 0.5,
      lng: 41.5 + Math.random() * 0.5,
      recordedAt: new Date().toISOString(),
      initiatedByUserId: user?.sub ?? user?.id ?? null,
    };
  }
}
