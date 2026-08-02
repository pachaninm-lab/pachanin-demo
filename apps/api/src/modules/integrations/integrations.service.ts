import { Injectable, Logger } from '@nestjs/common';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';
import { integrationRegistry } from '../../../../../packages/integration-sdk/src/registry';
import {
  FGIS_LEGACY_ERROR_CODES,
  denyRetiredLegacyFgisRoute,
} from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine';

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

  /**
   * Retired in P0.2-1A. This used to call the mock ФГИС adapter with a
   * hardcoded `wheat` / `100 t` payload — regardless of what the deal actually
   * contained — and answer `MOCK_OK` with a synthetic СДИЗ number. Nothing was
   * ever sent to the external register, so any operator reading `MOCK_OK`
   * believed a legal registration had happened when none had.
   *
   * Registration of a real lot is a client action against the official SOAP
   * contract, not a staff-triggered push. The route now denies without touching
   * deal, document or job state.
   */
  pushFgis(dealId: string, user: any): never {
    return denyRetiredLegacyFgisRoute({
      code: FGIS_LEGACY_ERROR_CODES.PUSH_RETIRED,
      message:
        'Отправка партии во ФГИС «Зерно» через этот маршрут отключена. ' +
        'Он не выполнял реальную регистрацию.',
      nextStep:
        'Подключите организацию к ФГИС «Зерно» и создайте лот из подтверждённой партии.',
      route: `POST /integrations/fgis-zerno/deals/${dealId}/push`,
      actorUserId: user?.sub ?? user?.id ?? null,
      logger: this.logger,
    });
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

  /**
   * Retired in P0.2-1A. The official ФГИС «Зерно» contract has no JSON callback:
   * a provider response arrives as a signed SOAP `SendResponse` and is accepted
   * only through the canonical regulatory inbox, which validates schema and
   * signature, commits durably, and only then acknowledges.
   *
   * This handler accepted an unsigned JSON body as if it were a provider
   * response. It is refused without reading the body — an attacker-supplied
   * `status` must not reach any projection, not even a log line.
   */
  handleFgisWebhook(_body: Record<string, unknown>): never {
    return denyRetiredLegacyFgisRoute({
      code: FGIS_LEGACY_ERROR_CODES.WEBHOOK_RETIRED,
      message:
        'JSON-webhook ФГИС «Зерно» отключён. Официальный ответ оператора ' +
        'принимается только как подписанный SOAP через регуляторный inbox.',
      nextStep:
        'Настройте канонический обмен ФГИС «Зерно» (SendRequest/SendResponse/Ack).',
      route: 'POST /integrations/fgis/webhook',
      logger: this.logger,
    });
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
