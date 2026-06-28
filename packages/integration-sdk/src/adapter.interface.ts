export type AdapterMode = 'mock' | 'sandbox' | 'live';

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  latencyMs?: number;
  lastCheckedAt: string;
  detail?: string;
}

export interface IntegrationAdapter<TReq = unknown, TRes = unknown> {
  readonly name: string;
  readonly version: string;
  readonly mode: AdapterMode;

  execute(request: TReq): Promise<TRes>;
  healthCheck(): Promise<HealthStatus>;
}

export interface IntegrationEvent {
  eventId: string;
  eventType: string;
  payload: unknown;
  receivedAt: string;
  adapterName: string;
}

export abstract class BaseMockAdapter<TReq, TRes> implements IntegrationAdapter<TReq, TRes> {
  readonly mode: AdapterMode = 'mock';

  abstract readonly name: string;
  abstract readonly version: string;
  abstract execute(request: TReq): Promise<TRes>;

  async healthCheck(): Promise<HealthStatus> {
    return { status: 'ok', latencyMs: 0, lastCheckedAt: new Date().toISOString(), detail: 'mock' };
  }
}
