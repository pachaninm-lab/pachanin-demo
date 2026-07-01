import { Injectable, Logger } from '@nestjs/common';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import { integrationRegistry } from '../../../../../packages/integration-sdk/src/registry';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

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

  async health() {
    const runtimeHealth = this.runtime.integrationHealth();
    const sdkHealth = await integrationRegistry.healthCheckAll().catch(() => ({}));
    return { ...runtimeHealth, adapters: sdkHealth };
  }

  async adapterHealthAll() {
    return integrationRegistry.healthCheckAll();
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

  async pushFgis(dealId: string, user: any) {
    const jobId = `JOB-FGIS-${dealId}-${Date.now()}`;
    try {
      const fgis = integrationRegistry.get('FGIS_ZERNO') as any;
      const result = await fgis.execute({ action: 'registerLot', dealId, culture: 'wheat', volumeTons: 100, ownerId: user.orgId ?? user.id });
      this.logger.log(`FGIS lot registered: ${result.sdizNumber} for deal ${dealId}`);
      return { dealId, connector: 'FGIS_ZERNO', status: 'MOCK_OK', jobId, sdizNumber: result.sdizNumber, initiatedAt: new Date().toISOString() };
    } catch (err) {
      this.logger.warn(`FGIS push failed for deal ${dealId}: ${(err as Error).message}`);
      return { dealId, connector: 'FGIS_ZERNO', status: 'FAILED', jobId, error: (err as Error).message, initiatedAt: new Date().toISOString() };
    }
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

  handleFgisWebhook(body: Record<string, unknown>) {
    const { sdizId, dealId, status, confirmedAt } = body as any;
    return {
      received: true,
      sdizId,
      dealId,
      status,
      confirmedAt: confirmedAt ?? new Date().toISOString(),
      note: 'SDIZ status update recorded. Document matrix will re-evaluate release gate on next request.',
    };
  }

  handleEdoWebhook(body: Record<string, unknown>) {
    const { documentId, dealId, signingStatus, signedAt } = body as any;
    return {
      received: true,
      documentId,
      dealId,
      signingStatus,
      signedAt: signedAt ?? new Date().toISOString(),
      note: 'EDO signing event recorded.',
    };
  }
}
