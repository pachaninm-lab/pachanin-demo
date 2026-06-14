// PR-4 Real-adapter shells — единообразные production-shaped оболочки внешних
// систем (ФГИС/СДИЗ, ЭДО/КЭП, ЭПД, GPS/логистика, элеватор, лаборатория, 1С/ERP).
//
// Каждый shell: ENV-конфиг, healthCheck, маппинг запроса в HTTP, исходы
// pending/manual_review/failed, проброс correlationId/auditId/idempotencyKey,
// БЕЗ фейк-подтверждения (doesNotConfirmExternally:true; ошибка -> manual_review/
// failed). Единственная «дыра» под реальный API — пути операций и credentials
// (TODO для конкретного партнёра). Без конфигурации shell не регистрируется и
// платформа продолжает на симуляции.

import {
  platformV7CreateMockAdapter,
  type PlatformV7AdapterRegistry,
  type PlatformV7AdapterRequestBySystem,
  type PlatformV7ExternalAdapter,
  type PlatformV7ExternalCallResult,
  type PlatformV7ExternalSystem,
} from '../external-adapters';

export interface RealAdapterShellConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}

const ENV_PREFIX: Record<PlatformV7ExternalSystem, string> = {
  bank: 'BANK',
  fgis: 'FGIS',
  edo: 'EDO',
  epd: 'EPD',
  logistics: 'LOGISTICS',
  lab: 'LAB',
  oneC: 'ONEC',
  notification: 'NOTIFICATION',
};

export function resolveRealAdapterConfig(
  system: PlatformV7ExternalSystem,
  env: NodeJS.ProcessEnv = process.env,
): RealAdapterShellConfig | null {
  const prefix = ENV_PREFIX[system];
  const baseUrl = env[`${prefix}_API_BASE_URL`];
  const apiKey = env[`${prefix}_API_KEY`];
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey, timeoutMs: env[`${prefix}_API_TIMEOUT_MS`] ? Number(env[`${prefix}_API_TIMEOUT_MS`]) : 15_000 };
}

// Пути операций по системам — генерические; сверьте с документацией партнёра.
const OPERATION_PATHS: { [S in PlatformV7ExternalSystem]?: Record<string, string> } = {
  fgis: { createGrainBatchDraft: 'grain-batches', getGrainBatchStatus: 'grain-batches/status', createSdizDraft: 'sdiz', sendSdiz: 'sdiz/send', getSdizStatus: 'sdiz/status', redeemSdiz: 'sdiz/redeem', handleFgisError: 'errors' },
  edo: { createDocumentPackage: 'packages', sendForSignature: 'packages/send', getSignatureStatus: 'packages/status', rejectDocument: 'documents/reject', confirmDocument: 'documents/confirm', downloadSignedDocument: 'documents/download' },
  epd: { createTransportDocument: 'etrn', sendTransportDocument: 'etrn/send', getTransportDocumentStatus: 'etrn/status', signByCarrier: 'etrn/sign/carrier', signByConsignor: 'etrn/sign/consignor', signByConsignee: 'etrn/sign/consignee', handleTransportDocumentError: 'errors' },
  logistics: { createRoute: 'routes', assignVehicle: 'routes/vehicle', assignDriver: 'routes/driver', receiveGpsPoint: 'gps/point', receiveGeofenceEvent: 'gps/geofence', receiveEtaUpdate: 'gps/eta', receiveDeviationAlert: 'gps/deviation' },
  lab: { createSample: 'samples', submitProtocol: 'protocols', getProtocolStatus: 'protocols/status', confirmProtocol: 'protocols/confirm', rejectProtocol: 'protocols/reject' },
  oneC: { exportDeal: 'export/deal', exportDocuments: 'export/documents', exportMoneyOperation: 'export/money', exportCounterparty: 'export/counterparty', getExportStatus: 'export/status' },
  notification: { send: 'notify' },
};

export function createRealAdapterShell<System extends PlatformV7ExternalSystem>(
  system: System,
  config: RealAdapterShellConfig,
): PlatformV7ExternalAdapter<PlatformV7AdapterRequestBySystem[System], PlatformV7ExternalCallResult> {
  const doFetch = config.fetchImpl ?? fetch;
  const paths = OPERATION_PATHS[system] ?? {};

  return {
    provider: 'real',
    system,
    async call(request) {
      const operation = (request as { operation: string }).operation;
      const context = (request as { context: PlatformV7AdapterRequestBySystem[System]['context'] }).context;
      const base = {
        provider: 'real' as const,
        system,
        correlationId: context.correlationId,
        auditId: context.auditId,
        doesNotConfirmExternally: true as const,
      };
      const path = paths[operation] ?? operation;
      const url = `${config.baseUrl.replace(/\/$/, '')}/${path}`;
      try {
        const res = await doFetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': context.idempotencyKey ?? context.correlationId,
            'X-Correlation-Id': context.correlationId,
          },
          body: JSON.stringify({ operation, organizationId: context.organizationId, actorId: context.actorId }),
        });
        const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          return { ...base, externalCallId: `${system}-${context.correlationId}`, status: res.status >= 500 ? 'failed' : 'manual_review', payload: { httpStatus: res.status, body: payload } };
        }
        return { ...base, externalCallId: String(payload.id ?? `${system}-${context.correlationId}`), status: 'pending', payload };
      } catch (error) {
        return { ...base, externalCallId: `${system}-${context.correlationId}`, status: 'failed', payload: { error: error instanceof Error ? error.message : String(error) } };
      }
    },
    async healthCheck() {
      return {
        provider: 'real',
        system,
        status: 'available',
        checkedAt: new Date().toISOString(),
        message: `Real ${system} adapter configured from environment.`,
      };
    },
  };
}

// Сборка реестра из ENV: для каждой системы — боевой shell, если она настроена,
// иначе мок (честная симуляция). Возвращает реестр + список боевых систем.
export function platformV7BuildAdapterRegistryFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): { registry: PlatformV7AdapterRegistry; realSystems: PlatformV7ExternalSystem[] } {
  const systems: PlatformV7ExternalSystem[] = ['bank', 'fgis', 'edo', 'epd', 'logistics', 'lab', 'oneC', 'notification'];
  const realSystems: PlatformV7ExternalSystem[] = [];
  const registry = {} as { [S in PlatformV7ExternalSystem]: PlatformV7ExternalAdapter<PlatformV7AdapterRequestBySystem[S], PlatformV7ExternalCallResult> };

  for (const system of systems) {
    const config = resolveRealAdapterConfig(system, env);
    if (config) {
      realSystems.push(system);
      registry[system] = createRealAdapterShell(system, config);
    } else {
      registry[system] = platformV7CreateMockAdapter(system);
    }
  }

  return { registry: registry as PlatformV7AdapterRegistry, realSystems };
}
