import type { AdapterMode, HealthStatus, IntegrationAdapter } from '../adapter.interface';
import type { HttpIntegrationClient } from './http-integration-client';

/**
 * Base for live adapters: wires the shared HTTP client and satisfies the
 * `IntegrationAdapter` contract (name/version/mode/execute/healthCheck). Concrete
 * adapters add their domain methods (e.g. `createEscrow`) on top.
 */
export abstract class LiveAdapterBase implements IntegrationAdapter {
  readonly mode: AdapterMode = 'live';
  abstract readonly name: string;
  abstract readonly version: string;
  /** Path used by the default health check (override per vendor if different). */
  protected readonly healthPath: string = '/health';

  constructor(protected readonly http: HttpIntegrationClient) {}

  /** Generic passthrough; typed domain methods are preferred. */
  async execute(request: { method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string; body?: unknown; query?: Record<string, string | number | boolean | undefined> }): Promise<unknown> {
    return this.http.request(request);
  }

  async healthCheck(): Promise<HealthStatus> {
    return this.http.healthCheck(this.healthPath);
  }
}
